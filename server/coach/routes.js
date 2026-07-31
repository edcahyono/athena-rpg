/**
 * Coach-only content management API. Gated by COACH_MODE (see server.js) —
 * set COACH_MODE=false in .env before giving learners access to the app,
 * so the editing surface is not exposed.
 *
 * Endpoints (all under /api/coach):
 *   POST   /chunks        — add a chunk
 *   PUT    /chunks/:id    — update a chunk
 *   DELETE /chunks/:id    — remove a chunk
 *   GET    /chunks        — full chunk list + the 15 folders with counts/files
 *   POST   /upload        — file INTO a folder (x-folder header); extraction job
 *   POST   /commit/:jobId — file every extracted pair into that job's folder
 *   DELETE /files         — drop one uploaded document from one folder
 *   POST   /ingest        — rebuild all persona stores and hot-reload retrieval
 *
 * Every write first snapshots qa.source.json into data/qa/backups/.
 */
import fs from "node:fs";
import path from "node:path";
import express from "express";
import mammoth from "mammoth";
import { FOLDERS, FOLDER_IDS } from "../../shared/folders.js";
import { runIngestion, SOURCE_PATH } from "../rag/ingestCore.js";
import { loadStores } from "../rag/retriever.js";
import { loadGatekeeperKnowledge } from "../game/trackKnowledge.js";
import { callAnthropicRaw, CHAT_MODEL } from "../anthropic.js";

const router = express.Router();
// Every filing target is a folder now — the seven executives, their seven
// gatekeepers, and the shared general corpus. See shared/folders.js.
const VALID_IDS = FOLDER_IDS;
const BACKUP_DIR = path.join(path.dirname(SOURCE_PATH), "backups");

const readSource = () => JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));

function writeSource(data) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(SOURCE_PATH, path.join(BACKUP_DIR, `qa.source.${stamp}.json`));
  fs.writeFileSync(SOURCE_PATH, JSON.stringify(data, null, 2));
}

function validateChunk(c, existingIds, isUpdate = false) {
  const errors = [];
  if (!isUpdate) {
    if (!c.id || !/^[a-z0-9-]+$/.test(c.id)) errors.push("id is required (lowercase letters, digits, hyphens)");
    else if (existingIds.has(c.id)) errors.push(`id "${c.id}" already exists`);
  }
  if (!Array.isArray(c.personas) || c.personas.length === 0) errors.push("a folder must be chosen");
  else if (c.personas.some((p) => !VALID_IDS.has(p))) errors.push("unknown folder id");
  const hasZhA = !!c.answer_zh?.trim(), hasEnA = !!c.answer_en?.trim();
  if (!c.question_zh?.trim() && !c.question_en?.trim()) errors.push("a question is required (中文 or English)");
  // At least one answer is required, and every answer that exists must be paired
  // with a question in its OWN language (a 中文 answer needs a 中文 question, etc.).
  if (!hasZhA && !hasEnA) errors.push("an answer is required");
  if (hasZhA && !c.question_zh?.trim()) errors.push("the 中文 answer needs a 中文 question");
  if (hasEnA && !c.question_en?.trim()) errors.push("the English answer needs an English question");
  return errors;
}

function cleanChunk(c) {
  return {
    id: c.id.trim(),
    personas: [...new Set(c.personas)],
    keywords: (Array.isArray(c.keywords) ? c.keywords : String(c.keywords || "").split(/[,，;；]/))
      .map((k) => String(k).trim())
      .filter(Boolean),
    question_zh: c.question_zh?.trim() || "",
    question_en: c.question_en?.trim() || "",
    answer_zh: c.answer_zh?.trim() || "",
    ...(c.answer_en?.trim() ? { answer_en: c.answer_en.trim() } : {}),
    // Which upload this came from, so a folder can show its files and drop one
    // whole document again. Absent on the hand-authored originals.
    ...(c.source?.trim?.() ? { source: c.source.trim() } : {}),
  };
}

/**
 * The whole bank plus the folder index. The corpus is a few hundred chunks, so
 * the console filters client-side rather than paging — one round trip, and
 * switching folders is instant.
 */
router.get("/chunks", (_req, res) => {
  const data = readSource();
  const counts = {};
  const files = {};
  for (const c of data.chunks) {
    for (const p of c.personas) {
      counts[p] = (counts[p] || 0) + 1;
      if (c.source) ((files[p] ||= new Set())).add(c.source);
    }
  }
  res.json({
    chunks: data.chunks,
    folders: FOLDERS.map((f) => ({
      id: f.id,
      kind: f.kind,
      title_en: f.title.en,
      title_zh: f.title.zh,
      count: counts[f.id] || 0,
      files: [...(files[f.id] || [])].sort(),
    })),
  });
});

router.post("/chunks", (req, res) => {
  const data = readSource();
  const existingIds = new Set(data.chunks.map((c) => c.id));
  const errors = validateChunk(req.body, existingIds);
  if (errors.length) return res.status(400).json({ errors });
  data.chunks.push(cleanChunk(req.body));
  writeSource(data);
  res.json({ ok: true, count: data.chunks.length });
});

router.put("/chunks/:id", (req, res) => {
  const data = readSource();
  const idx = data.chunks.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ errors: ["chunk not found"] });
  const errors = validateChunk({ ...req.body, id: req.params.id }, new Set(), true);
  if (errors.length) return res.status(400).json({ errors });
  data.chunks[idx] = cleanChunk({ ...req.body, id: req.params.id });
  writeSource(data);
  res.json({ ok: true });
});

router.delete("/chunks/:id", (req, res) => {
  const data = readSource();
  const before = data.chunks.length;
  data.chunks = data.chunks.filter((c) => c.id !== req.params.id);
  if (data.chunks.length === before) return res.status(404).json({ errors: ["chunk not found"] });
  writeSource(data);
  res.json({ ok: true, count: data.chunks.length });
});

/**
 * DELETE /files — remove every chunk one upload put into one folder.
 *
 * Scoped to the folder rather than the filename alone: the same document can be
 * filed into several folders deliberately, and clearing the CFO's copy must not
 * silently empty the CEO's.
 */
router.delete("/files", (req, res) => {
  const { folder, source } = req.body || {};
  if (!VALID_IDS.has(folder)) return res.status(400).json({ errors: ["unknown folder id"] });
  if (!source) return res.status(400).json({ errors: ["source filename is required"] });

  const data = readSource();
  let removed = 0;
  data.chunks = data.chunks.filter((c) => {
    if (c.source !== source || !c.personas.includes(folder)) return true;
    // Filed in other folders too — take it out of this one and keep the rest.
    if (c.personas.length > 1) {
      c.personas = c.personas.filter((p) => p !== folder);
      removed++;
      return true;
    }
    removed++;
    return false;
  });
  if (!removed) return res.status(404).json({ errors: ["no chunks matched that file in that folder"] });
  writeSource(data);
  res.json({ ok: true, removed, count: data.chunks.length });
});

router.post("/ingest", async (_req, res) => {
  try {
    const lines = [];
    const result = await runIngestion({ log: (m) => lines.push(m) });
    loadStores();              // executives: hot-reload retrieval
    loadGatekeeperKnowledge(); // gatekeepers: hot-reload the compiled corpus
    res.json({ ok: true, ...result, log: lines });
  } catch (e) {
    res.status(500).json({ errors: [e.message] });
  }
});

/* ------------------------- file import (upload) ------------------------ */

const EXTRACT_MODEL = CHAT_MODEL;
const MAX_DOC_CHARS = 200000;
const SEGMENT_CHARS = 3800; // small: extraction OUTPUT (verbatim + translations + JSON) exceeds input size for dense Q&A

async function fileToText(buf, filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  // The CCNAP case material ships as PDF, so accept it too — pdf-parse is
  // already a dependency for the in-game deck upload.
  if (ext === "pdf") {
    const { default: pdfParse } = await import("pdf-parse");
    const { text } = await pdfParse(buf);
    return text;
  }
  if (["txt", "md", "json", "csv"].includes(ext)) {
    return buf.toString("utf8");
  }
  throw Object.assign(
    new Error(`Unsupported file type ".${ext}" — use .pdf, .docx, .txt, .md, .json, or .csv`),
    { status: 400 }
  );
}

/** Split document text into segments on paragraph boundaries. */
function segmentText(text) {
  const paras = text.split(/\n{2,}/);
  const segments = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > SEGMENT_CHARS) {
      segments.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur.trim()) segments.push(cur);
  return segments;
}

async function extractSegment(segText, idPrefix) {
  // Goes through the shared helper rather than a raw fetch, so extraction
  // tokens land in the same usage/cost ledger the /usage dashboard reads.
  // MUST be the Raw variant: callAnthropic() keeps only text blocks, so the
  // tool_use block this whole function depends on was being thrown away.
  const data = await callAnthropicRaw({
      model: EXTRACT_MODEL,
      max_tokens: 16000,
      // Structured tool output forces clean JSON with no preamble/fences and no
      // assistant prefill (which Sonnet 5 rejects).
      tools: [
        {
          name: "record_chunks",
          description: "Record every Q&A pair extracted from the document excerpt.",
          input_schema: {
            type: "object",
            properties: {
              chunks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "kebab-case ascii id starting with the given prefix" },
                    keywords: { type: "array", items: { type: "string" } },
                    question_zh: { type: "string" },
                    question_en: { type: "string" },
                    answer_zh: { type: "string" },
                    answer_en: { type: "string" },
                  },
                  required: ["id", "keywords", "question_zh", "question_en", "answer_zh", "answer_en"],
                },
              },
            },
            required: ["chunks"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "record_chunks" },
      system:
        "You extract Q&A pairs from a Nike-China training document excerpt. Call record_chunks with one object per distinct question-and-answer. Rules: " +
        "(1) Preserve each answer VERBATIM in its original language — never summarize, reword, or translate the answer body. " +
        "(2) Detect the answer's language: put the verbatim answer in answer_zh if it is Chinese, or in answer_en if it is English; set the other answer field to an empty string. " +
        "(3) Fill BOTH question_zh and question_en (translate only the short question, never the answer). " +
        "(4) keywords: 3-8 short retrieval terms mixing Chinese and English. " +
        "(5) id: kebab-case ascii beginning with '" + idPrefix + "'. " +
        // Filing is no longer the model's job. The coach uploaded this file INTO
        // a folder, so every pair it yields belongs to that folder — there is
        // nothing left to infer and nothing left to get wrong.
        "(6) Ignore document titles, section headers, and any item obviously cut off at the very start or end of the excerpt.",
      messages: [{ role: "user", content: "ID prefix: " + idPrefix + "\n\nExcerpt:\n\n" + segText }],
  });
  const toolUse = (data.content || []).find((b) => b.type === "tool_use");
  if (toolUse && toolUse.input && Array.isArray(toolUse.input.chunks)) {
    const items = toolUse.input.chunks;
    if (data.stop_reason === "max_tokens") items._truncated = true;
    return items;
  }
  throw new Error("Model did not return structured chunks for one segment");
}

/* Background job store — large documents are processed segment by segment so
   no single HTTP request ever has to stay open for minutes. */
const jobs = new Map(); // jobId -> { status, done, total, proposals, warnings, ts }

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, j] of jobs) if (j.ts < cutoff) jobs.delete(id);
}, 5 * 60 * 1000).unref?.();

async function runExtractionJob(jobId, segments, idPrefix) {
  const job = jobs.get(jobId);
  const existing = new Set(readSource().chunks.map((c) => c.id));
  let n = 1;
  for (let i = 0; i < segments.length; i++) {
    try {
      const raw = await extractSegment(segments[i], `${idPrefix}`);
      if (raw._truncated) job.warnings.push(`Part ${i + 1}: output was truncated — the last item may be missing.`);
      for (const p of raw) {
        if (!p || !(p.answer_zh?.trim() || p.answer_en?.trim())) continue;
        let id = String(p.id || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        if (!id || !id.startsWith(idPrefix)) id = `${idPrefix}-${String(n).padStart(3, "0")}`;
        while (existing.has(id)) id = `${id}-x`;
        existing.add(id);
        n++;
        job.proposals.push({
          id,
          keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
          question_zh: String(p.question_zh || "").trim(),
          question_en: String(p.question_en || "").trim(),
          answer_zh: String(p.answer_zh || "").trim(),
          answer_en: String(p.answer_en || "").trim(),
        });
      }
    } catch (e) {
      job.warnings.push(`Part ${i + 1}: ${e.message}`);
    }
    job.done = i + 1;
    job.ts = Date.now();
  }
  job.status = job.proposals.length > 0 || job.warnings.length === 0 ? "done" : "error";
}

/**
 * POST /api/coach/upload — raw file body + x-filename header.
 * Returns { jobId, total } immediately; extraction runs in the background.
 * Poll GET /api/coach/upload/status/:jobId until status is "done".
 * NOTHING is saved automatically — the coach reviews the proposals in the UI.
 */
router.post(
  "/upload",
  express.raw({ type: () => true, limit: "8mb" }),
  async (req, res) => {
    try {
      const filename = decodeURIComponent(req.headers["x-filename"] || "upload.txt");
      // The folder is the whole point: it is chosen before the file is read, so
      // there is no inference step and no way for a document to land somewhere
      // the coach did not put it.
      const folder = String(req.headers["x-folder"] || "").trim();
      if (!VALID_IDS.has(folder)) {
        return res.status(400).json({ errors: ["Upload into a folder — none was given, or it is not a known folder."] });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ errors: ["Empty file"] });
      }
      let text = await fileToText(req.body, filename);
      text = text.replace(/\r/g, "").trim();
      if (!text) return res.status(400).json({ errors: ["No readable text found in the file"] });
      let truncated = false;
      if (text.length > MAX_DOC_CHARS) {
        text = text.slice(0, MAX_DOC_CHARS);
        truncated = true;
      }

      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return res.status(500).json({ errors: ["Server is missing ANTHROPIC_API_KEY."] });

      const idPrefix = filename
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24) || "import";

      const segments = segmentText(text);
      const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      jobs.set(jobId, {
        status: "running",
        done: 0,
        total: segments.length,
        folder,
        filename,
        proposals: [],
        warnings: truncated ? ["File exceeded the size limit — the tail was skipped."] : [],
        ts: Date.now(),
      });
      runExtractionJob(jobId, segments, idPrefix); // fire and forget
      res.json({ jobId, total: segments.length });
    } catch (e) {
      res.status(e.status || 500).json({ errors: [e.message] });
    }
  }
);

/** POST /api/coach/commit/:jobId — save all of a finished job's proposals to
 *  the question bank in one write, tagged with the given personas. */
router.post("/commit/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ errors: ["Unknown or expired job"] });
  if (job.status !== "done") return res.status(409).json({ errors: ["Job is not finished yet"] });

  const src = readSource();
  const existing = new Set(src.chunks.map((c) => c.id));
  let added = 0;
  const skipped = [];
  for (const p of job.proposals) {
    let id = p.id;
    while (existing.has(id)) id = id + "-x";
    const chunk = {
      id,
      // Everything from this upload belongs to the folder it was uploaded into.
      personas: [job.folder],
      source: job.filename,
      keywords: Array.isArray(p.keywords) ? p.keywords : String(p.keywords || "").split(",").map((k) => k.trim()).filter(Boolean),
      question_zh: p.question_zh || "",
      question_en: p.question_en || "",
      answer_zh: p.answer_zh || "",
      answer_en: p.answer_en || "",
    };
    const errs = validateChunk(chunk, existing);
    if (errs.length) { skipped.push(`${id}: ${errs[0]}`); continue; }
    src.chunks.push(chunk);
    existing.add(id);
    added++;
  }
  writeSource(src);
  res.json({ added, skipped });
});

router.get("/upload/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ errors: ["Unknown or expired job"] });
  const { status, done, total, warnings } = job;
  res.json({
    status, done, total, warnings,
    proposals: status === "done" ? job.proposals : undefined,
  });
});

export default router;

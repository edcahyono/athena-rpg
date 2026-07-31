/**
 * Core ingestion logic, callable both from the CLI (`npm run ingest`) and
 * in-process from the coach tool ("Save & re-ingest" button).
 */
import fs from "node:fs";
import path from "node:path";
import { QA_SOURCE_FILE, RAG_STORE_DIR } from "../paths.js";
import { tokenize } from "./tokenize.js";
import {
  EXEC_FOLDERS,
  GATEKEEPER_FOLDERS,
  GENERAL_ID,
} from "../../shared/folders.js";

export { GENERAL_ID };

export const SOURCE_PATH = QA_SOURCE_FILE;
const OUT_DIR = RAG_STORE_DIR;

/** Compiled gatekeeper corpora, read back by server/game/trackKnowledge.js. */
export const GATEKEEPER_FILE = path.join(RAG_STORE_DIR, "gatekeeper-knowledge.json");

/**
 * A gatekeeper's whole corpus is fed into their system prompt AND into the
 * 5-MCQ generator. Past that size the quiz prompt starts crowding out its own
 * instructions, so say so rather than truncating a coach's uploads silently.
 */
const GATEKEEPER_SOFT_CAP = 60000;

/** Render one folder's chunks as the plain Q&A text a gatekeeper reads. */
function compileKnowledge(list) {
  return list
    .map((c) => {
      const q = c.question_en || c.question_zh || "";
      const a = [c.answer_en, c.answer_zh].filter(Boolean).join("\n");
      return `Q: ${q}\nA: ${a}`;
    })
    .join("\n\n");
}

function chunkText(c) {
  return [c.question_zh, c.question_en, (c.keywords || []).join(" "), c.answer_zh, c.answer_en]
    .filter(Boolean)
    .join("\n");
}

async function embedBatch(texts, key, model) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: texts, input_type: "document" }),
  });
  if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data.map((d) => d.embedding);
}

export async function runIngestion({ log = console.log } = {}) {
  const VOYAGE_KEY = process.env.VOYAGE_API_KEY || "";
  const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-3.5";

  const { chunks } = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const byFolder = {};
  for (const c of chunks) {
    for (const pid of c.personas) (byFolder[pid] ||= []).push(c);
  }

  // Gatekeeper folders leave the retrieval path here: their content is compiled
  // whole rather than indexed, so it never reaches a store. Pulled out BEFORE
  // the general fold, because a gatekeeper reading company-wide background is a
  // separate editorial decision the coach makes by filing it there.
  const gatekeeperChunks = {};
  for (const f of GATEKEEPER_FOLDERS) {
    gatekeeperChunks[f.trackId] = byFolder[f.id] || [];
    delete byFolder[f.id];
  }

  // Fold the shared corpus into EVERY persona's index. Keeping it in its own
  // store and merging at query time reads cleaner, but BM25 statistics are not
  // comparable across separate indexes: a small general store gets a near-zero
  // idf and can never outscore a large specialist one, so shared content simply
  // never surfaced. One index per persona gives correct relevance for free.
  //
  // This does NOT weaken isolation — a persona's index still contains only
  // their own material plus the shared corpus, never another persona's.
  const generalChunks = byFolder[GENERAL_ID] || [];
  if (generalChunks.length) {
    for (const f of EXEC_FOLDERS) (byFolder[f.id] ||= []); // reach personas with no own content yet
    for (const pid of Object.keys(byFolder)) {
      if (pid === GENERAL_ID) continue;
      const own = new Set(byFolder[pid].map((c) => c.id));
      byFolder[pid] = [...byFolder[pid], ...generalChunks.filter((c) => !own.has(c.id))];
    }
  }

  // Only chunks that actually land in a store need a vector. Gatekeeper-only
  // material is never retrieved, so embedding it would burn quota for nothing.
  const retrievable = [...new Map(
    Object.values(byFolder).flat().map((c) => [c.id, c])
  ).values()];

  let embeddingsById = null;
  let embeddingError = null;
  if (VOYAGE_KEY) {
    log(`Embedding ${retrievable.length} chunks with ${VOYAGE_MODEL}...`);
    try {
      embeddingsById = {};
      const BATCH = 32;
      for (let i = 0; i < retrievable.length; i += BATCH) {
        const batch = retrievable.slice(i, i + BATCH);
        const vecs = await embedBatch(batch.map(chunkText), VOYAGE_KEY, VOYAGE_MODEL);
        batch.forEach((c, j) => (embeddingsById[c.id] = vecs[j]));
      }
    } catch (err) {
      // Degrade, don't die. This used to throw straight out of runIngestion,
      // so a coach clicking "Apply to personas" behind a VPN got a hard failure
      // and kept serving their previous content with no idea why. BM25 is a
      // fully working retrieval mode — build that and say so loudly.
      embeddingError = err.cause?.code || err.message;
      embeddingsById = null;
      log(`WARNING: embedding failed (${embeddingError}) — building BM25-only index instead.`);
      log("WARNING: retrieval will use keyword matching until you re-run this with the embedding service reachable.");
    }
  } else {
    log("VOYAGE_API_KEY not set — building BM25-only index (fully functional fallback).");
  }

  const counts = {};
  for (const [pid, list] of Object.entries(byFolder)) {
    const docs = list.map((c) => {
      const tokens = tokenize(chunkText(c));
      const tf = {};
      for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
      return {
        id: c.id,
        question_zh: c.question_zh,
        question_en: c.question_en,
        answer_zh: c.answer_zh,
        answer_en: c.answer_en || null,
        tf,
        len: tokens.length,
        embedding: embeddingsById ? embeddingsById[c.id] : null,
      };
    });
    const df = {};
    for (const d of docs) for (const t of Object.keys(d.tf)) df[t] = (df[t] || 0) + 1;
    const avgLen = docs.length ? docs.reduce((s, d) => s + d.len, 0) / docs.length : 0;
    fs.writeFileSync(
      path.join(OUT_DIR, `${pid}.json`),
      JSON.stringify({ personaId: pid, docs, df, avgLen, n: docs.length })
    );
    counts[pid] = docs.length;
    log(`  ${pid}: ${docs.length} chunks`);
  }

  // Gatekeepers: compile, don't index. Every track gets a key even when its
  // folder is empty, so the overlay can tell "coach added nothing" apart from
  // "ingest has never run".
  const warnings = [];
  const gkCounts = {};
  const tracks = {};
  for (const f of GATEKEEPER_FOLDERS) {
    const list = gatekeeperChunks[f.trackId] || [];
    tracks[f.trackId] = compileKnowledge(list);
    gkCounts[f.id] = list.length;
    if (tracks[f.trackId].length > GATEKEEPER_SOFT_CAP) {
      warnings.push(
        `${f.id}: ${tracks[f.trackId].length} characters of knowledge — large enough to crowd out the quiz generator's own instructions. Consider trimming this folder.`
      );
    }
    log(`  ${f.id}: ${list.length} chunks compiled (${tracks[f.trackId].length} chars)`);
  }
  fs.writeFileSync(
    GATEKEEPER_FILE,
    JSON.stringify({ builtAt: new Date().toISOString(), tracks }, null, 2)
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "meta.json"),
    JSON.stringify({
      builtAt: new Date().toISOString(),
      embeddings: VOYAGE_KEY ? VOYAGE_MODEL : "none (BM25 fallback)",
      personas: Object.keys(byFolder),
      gatekeepers: Object.keys(gkCounts),
      totalChunks: chunks.length,
    }, null, 2)
  );
  for (const w of warnings) log(`WARNING: ${w}`);
  log("Ingestion complete → " + OUT_DIR);
  return {
    counts,
    gatekeepers: gkCounts,
    warnings,
    totalChunks: chunks.length,
    embedded: !!embeddingsById,
    embeddingError,
  };
}

/**
 * Core ingestion logic, callable both from the CLI (`npm run ingest`) and
 * in-process from the coach tool ("Save & re-ingest" button).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "./tokenize.js";
import { PERSONAS } from "../../shared/personas.config.js";

/** Shared corpus id — kept in step with retriever.js. */
export const GENERAL_ID = "general";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE_PATH = path.join(__dirname, "..", "data", "qa", "qa.source.json");
const OUT_DIR = path.join(__dirname, "store");

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

  const byPersona = {};
  for (const c of chunks) {
    for (const pid of c.personas) (byPersona[pid] ||= []).push(c);
  }

  // Fold the shared corpus into EVERY persona's index. Keeping it in its own
  // store and merging at query time reads cleaner, but BM25 statistics are not
  // comparable across separate indexes: a small general store gets a near-zero
  // idf and can never outscore a large specialist one, so shared content simply
  // never surfaced. One index per persona gives correct relevance for free.
  //
  // This does NOT weaken isolation — a persona's index still contains only
  // their own material plus the shared corpus, never another persona's.
  const generalChunks = byPersona[GENERAL_ID] || [];
  if (generalChunks.length) {
    for (const p of PERSONAS) (byPersona[p.id] ||= []); // reach personas with no own content yet
    for (const pid of Object.keys(byPersona)) {
      if (pid === GENERAL_ID) continue;
      const own = new Set(byPersona[pid].map((c) => c.id));
      byPersona[pid] = [...byPersona[pid], ...generalChunks.filter((c) => !own.has(c.id))];
    }
  }

  let embeddingsById = null;
  let embeddingError = null;
  if (VOYAGE_KEY) {
    log(`Embedding ${chunks.length} chunks with ${VOYAGE_MODEL}...`);
    try {
      embeddingsById = {};
      const BATCH = 32;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
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
  for (const [pid, list] of Object.entries(byPersona)) {
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

  fs.writeFileSync(
    path.join(OUT_DIR, "meta.json"),
    JSON.stringify({
      builtAt: new Date().toISOString(),
      embeddings: VOYAGE_KEY ? VOYAGE_MODEL : "none (BM25 fallback)",
      personas: Object.keys(byPersona),
      totalChunks: chunks.length,
    }, null, 2)
  );
  log("Ingestion complete → " + OUT_DIR);
  return { counts, totalChunks: chunks.length, embedded: !!embeddingsById, embeddingError };
}

/**
 * Core ingestion logic, callable both from the CLI (`npm run ingest`) and
 * in-process from the coach tool ("Save & re-ingest" button).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "./tokenize.js";

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

  let embeddingsById = null;
  if (VOYAGE_KEY) {
    log(`Embedding ${chunks.length} chunks with ${VOYAGE_MODEL}...`);
    embeddingsById = {};
    const BATCH = 32;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const vecs = await embedBatch(batch.map(chunkText), VOYAGE_KEY, VOYAGE_MODEL);
      batch.forEach((c, j) => (embeddingsById[c.id] = vecs[j]));
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
    const avgLen = docs.reduce((s, d) => s + d.len, 0) / docs.length;
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
  return { counts, totalChunks: chunks.length };
}

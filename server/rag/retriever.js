/**
 * Retrieval module. Interface: retrieve(personaId, query) -> chunks[]
 *
 * Loads per-persona stores (built by ingest.js) once at server startup.
 * If stores contain Voyage embeddings AND VOYAGE_API_KEY is available at runtime,
 * queries are embedded and ranked by cosine similarity; otherwise a bilingual
 * BM25 ranking is used. Both paths apply a minimum-relevance threshold —
 * if nothing clears it, an empty array is returned (never force irrelevant
 * content into the prompt).
 */
import fs from "node:fs";
import path from "node:path";
import { RAG_STORE_DIR } from "../paths.js";
import { tokenize } from "./tokenize.js";

const STORE_DIR = RAG_STORE_DIR;

const TOP_N = Number(process.env.RAG_TOP_N || 3);
const BM25_MIN_SCORE = Number(process.env.RAG_BM25_MIN_SCORE || 2.0);
const COSINE_MIN_SCORE = Number(process.env.RAG_COSINE_MIN_SCORE || 0.35);
/**
 * The shared corpus EVERY persona may draw on, alongside their own. Content
 * filed here is company-wide context — the case brief, market background,
 * engagement logistics — not one function's specialist detail.
 */
export const GENERAL_ID = "general";

const K1 = 1.5;
const B = 0.75;

const stores = new Map();
let hasEmbeddings = false;

export function loadStores() {
  stores.clear();
  if (!fs.existsSync(STORE_DIR)) {
    console.warn("[rag] store directory missing — run `npm run ingest` first. Retrieval disabled.");
    return;
  }
  for (const f of fs.readdirSync(STORE_DIR)) {
    // Only persona indexes live here. meta.json is build metadata and
    // gatekeeper-knowledge.json is compiled prose for the gatekeeper prompts —
    // neither has a `docs` array, so parsing them as stores throws.
    if (!f.endsWith(".json") || f === "meta.json" || f === "gatekeeper-knowledge.json") continue;
    const data = JSON.parse(fs.readFileSync(path.join(STORE_DIR, f), "utf8"));
    if (!data?.personaId || !Array.isArray(data.docs)) {
      console.warn(`[rag] ignoring ${f} — not a persona store.`);
      continue;
    }
    stores.set(data.personaId, data);
    if (data.docs.some((d) => d.embedding)) hasEmbeddings = true;
  }
  const mode = hasEmbeddings && process.env.VOYAGE_API_KEY ? "embeddings (Voyage)" : "BM25";
  const shared = stores.has(GENERAL_ID) ? ", incl. shared general" : "";
  console.log(`[rag] loaded ${stores.size} stores${shared} — retrieval mode: ${mode}`);
}

function bm25Scores(store, query) {
  const qTokens = [...new Set(tokenize(query))];
  return store.docs.map((doc) => {
    let score = 0;
    for (const t of qTokens) {
      const tf = doc.tf[t];
      if (!tf) continue;
      const df = store.df[t] || 0;
      const idf = Math.log(1 + (store.n - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * doc.len) / store.avgLen)));
    }
    return { doc, score };
  });
}

async function embedQuery(query) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.VOYAGE_MODEL || "voyage-3.5",
      input: [query],
      input_type: "query",
    }),
  });
  if (!res.ok) throw new Error(`Voyage query embedding failed: ${res.status}`);
  return (await res.json()).data[0].embedding;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/**
 * retrieve(personaId, query) -> [{ id, question_zh, question_en, answer_zh, answer_en }]
 *
 * One index per persona, containing their own material plus the shared general
 * corpus (folded in at ingest — see ingestCore.js). No other persona's store is
 * ever consulted, so the CFO cannot surface the CTO's material however the
 * question is phrased. That isolation is structural, not a prompt instruction
 * that could be talked around.
 */
export async function retrieve(personaId, query) {
  // `general` is a coach-side filing bucket, not a speaking role — never serve
  // it as if it were a persona.
  if (!query?.trim() || personaId === GENERAL_ID) return [];
  const store = stores.get(personaId);
  if (!store) return [];

  let scored;
  if (hasEmbeddings && process.env.VOYAGE_API_KEY) {
    try {
      const qVec = await embedQuery(query);
      scored = store.docs
        .filter((d) => d.embedding)
        .map((doc) => ({ doc, score: cosine(qVec, doc.embedding) }))
        .filter((s) => s.score >= COSINE_MIN_SCORE);
    } catch (err) {
      console.warn("[rag] embedding query failed, falling back to BM25:", err.message);
      scored = bm25Scores(store, query).filter((s) => s.score >= BM25_MIN_SCORE);
    }
  } else {
    scored = bm25Scores(store, query).filter((s) => s.score >= BM25_MIN_SCORE);
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
    .map(({ doc }) => ({
      id: doc.id,
      question_zh: doc.question_zh,
      question_en: doc.question_en,
      answer_zh: doc.answer_zh,
      answer_en: doc.answer_en,
    }));
}

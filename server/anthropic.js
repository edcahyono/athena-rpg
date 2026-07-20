/**
 * Thin Anthropic Messages API helper — server-side only.
 * Every call records token usage + estimated cost to server/data/usage.json
 * (powers the in-game usage dashboard).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE_FILE = path.join(__dirname, "data", "usage.json");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Sonnet 5 everywhere — dialogue, grading, routing, classification.
export const CHAT_MODEL = process.env.CHAT_MODEL || "claude-sonnet-5";
export const LIGHT_MODEL = process.env.LIGHT_MODEL || "claude-sonnet-5";

// USD per million tokens — update if pricing changes.
const PRICING = {
  "claude-sonnet-5": { in: 3, out: 15 },
  _default: { in: 3, out: 15 },
};

/* ----------------------------- usage store ----------------------------- */

let usage = { total: { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 }, byModel: {}, byDay: {} };
try {
  if (fs.existsSync(USAGE_FILE)) usage = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
} catch { /* start fresh */ }

let usageTimer = null;
function persistUsage() {
  clearTimeout(usageTimer);
  usageTimer = setTimeout(() => {
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify(usage));
    } catch (e) {
      console.warn("[usage] persist failed:", e.message);
    }
  }, 1000);
}

function recordUsage(model, inputTokens, outputTokens) {
  const price = PRICING[model] || PRICING._default;
  const cost = (inputTokens * price.in + outputTokens * price.out) / 1e6;
  const day = new Date().toISOString().slice(0, 10);
  const bump = (slot) => {
    slot.calls += 1;
    slot.inputTokens += inputTokens;
    slot.outputTokens += outputTokens;
    slot.costUSD += cost;
  };
  bump(usage.total);
  usage.byModel[model] = usage.byModel[model] || { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 };
  bump(usage.byModel[model]);
  usage.byDay[day] = usage.byDay[day] || { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 };
  bump(usage.byDay[day]);
  persistUsage();
}

export function getUsage() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: usage.total,
    byModel: usage.byModel,
    byDay: usage.byDay,
    today: usage.byDay[today] || { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 },
  };
}

/* ------------------------------ API call ------------------------------- */

function apiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("Server is missing ANTHROPIC_API_KEY."), { status: 500 });
  return key;
}

/**
 * Tolerant JSON extraction from a model reply — models sometimes emit raw
 * newlines inside JSON strings or wrap output in code fences, which breaks
 * strict JSON.parse and silently drops the payload.
 */
export function parseModelJson(out) {
  const cleaned = (out || "").replace(/```(json)?/g, "");
  // Prefer a complete {...}; fall back to an opening brace with no close
  // (truncated output — the model hit max_tokens mid-string).
  const m = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned.match(/\{[\s\S]*/)?.[0];
  if (!m) return {};
  try { return JSON.parse(m); } catch { /* try repairs */ }
  const nl = m.replace(/\r?\n/g, "\\n");
  try { return JSON.parse(nl); } catch { /* try truncation salvage */ }
  // Salvage a truncated object: close a dangling string, then any open braces.
  let t = nl;
  if (((t.match(/"/g) || []).length) % 2 === 1) t += '"';
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  t += "}".repeat(Math.max(0, opens - closes));
  try { return JSON.parse(t); } catch { return {}; }
}

export async function callAnthropic(body) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Model call failed (${res.status})`);
    err.status = res.status === 429 ? 429 : 502;
    err.detail = detail.slice(0, 300);
    throw err;
  }
  const data = await res.json();
  if (data.usage) recordUsage(body.model, data.usage.input_tokens || 0, data.usage.output_tokens || 0);
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Thin Anthropic Messages API helper — server-side only.
 * Every call records token usage + estimated cost to server/data/usage.json
 * (powers the in-game usage dashboard).
 */
import fs from "node:fs";
import { USAGE_FILE } from "./paths.js";

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

/**
 * Statuses worth a second attempt. 529 is Anthropic's "overloaded" — capacity,
 * not a bad request — and 429/5xx are the same story. A 4xx that is NOT 429
 * means the request itself is wrong, and repeating it just burns time.
 */
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One model request, retried through transient upstream failure.
 *
 * Without this a single 529 surfaced to the learner mid-interview as
 * "connection hiccup — try again", which reads as the game being broken. The
 * quiz generator already retried for the same reason; conversation did not.
 */
async function requestWithRetry(body) {
  for (let attempt = 1; ; attempt++) {
    let res, netErr;
    try {
      res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      netErr = e; // DNS blip, socket reset, VPN drop — all worth one more try
    }

    if (res?.ok) return res;

    const status = res?.status ?? 0;
    const retryable = netErr ? true : RETRYABLE.has(status);
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      if (netErr) throw Object.assign(netErr, { status: 502 });
      const detail = await res.text().catch(() => "");
      const err = new Error(`Model call failed (${status})`);
      err.status = status === 429 ? 429 : 502;
      err.detail = detail.slice(0, 300);
      throw err;
    }

    // Honour Retry-After when the API sends one; otherwise back off with a
    // little jitter so concurrent players don't retry in lockstep.
    const ra = Number(res?.headers?.get("retry-after"));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 500 * 2 ** (attempt - 1) + Math.random() * 250;
    console.warn(
      `[anthropic] ${netErr ? netErr.message : status} on attempt ${attempt}/${MAX_ATTEMPTS} — retrying in ${Math.round(wait)}ms`
    );
    await sleep(wait);
  }
}

/**
 * The full parsed response. Needed by anything reading tool_use blocks or
 * stop_reason — callAnthropic() flattens to text and drops both.
 */
export async function callAnthropicRaw(body) {
  const res = await requestWithRetry(body);
  const data = await res.json();
  if (data.usage) recordUsage(body.model, data.usage.input_tokens || 0, data.usage.output_tokens || 0);
  return data;
}

const textOf = (data) =>
  (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

/**
 * One model request, flattened to text.
 *
 * There used to be a continuation loop here: on `stop_reason: "max_tokens"` it
 * fed the partial answer back as a prefilled assistant turn so the model could
 * resume mid-sentence. That is the documented pattern, and it is unusable on
 * the model this game runs on — Sonnet 5 rejects assistant prefill with a hard
 * 400 ("This model does not support assistant message prefill"), so every
 * truncated reply became a 502 and the as-is gate became impossible to pass.
 * Catching the 400 made it merely useless: a guaranteed-failing extra API round
 * trip on exactly the requests that were already in trouble.
 *
 * It is gone rather than reimplemented because the only prefill-free
 * alternative — re-asking with the partial text as a user turn — cannot resume
 * mid-token and tends to restate what it already said. The structural answer is
 * not to repair truncation but to avoid it: anything whose output must PARSE
 * now goes through callAnthropicTool(), where the answer arrives as a validated
 * tool_use block instead of JSON embedded in a prose stream. What still calls
 * this helper is prose — dialogue, a manager's debrief — where the ceiling is
 * generous and a rare clipped sentence is cosmetic rather than a silently wrong
 * grade.
 */
export async function callAnthropic(body) {
  const data = await callAnthropicRaw(body);
  if (data.stop_reason === "max_tokens") {
    console.warn(`[anthropic] reply hit max_tokens (${body.max_tokens}) — returning partial text`);
  }
  return textOf(data).trim();
}

/**
 * One model request whose answer must PARSE — resolves to the tool input
 * object, or null when the model did not produce a usable one.
 *
 * Free-form "reply with ONLY JSON" in the text stream is not safe on this
 * model, for two compounding reasons. It emits `thinking` blocks
 * unpredictably — measured on the same prompt: present in one call, absent in
 * the next — and those blocks are billed against the SAME max_tokens ceiling as
 * the answer, so a budget that fits the JSON on a quiet run stops mid-array on
 * a thinky one. And the failure is silent: parseModelJson() hands back {}, the
 * caller falls through to its default, and the learner reads that default as a
 * grade they actually earned.
 *
 * A forced tool call fixes the parse half outright — the API validates the
 * input against the schema, so it arrives whole or not at all. Give it real
 * headroom anyway: a truncated tool_use block is still truncated, and it is
 * reported here as failure (null) rather than as a half-filled object, so
 * callers can tell "the model judged this harshly" from "the model never
 * answered".
 */
export async function callAnthropicTool({ name, description, schema, ...body }) {
  const data = await callAnthropicRaw({
    ...body,
    tools: [{ name, description, input_schema: schema }],
    tool_choice: { type: "tool", name },
  });
  const block = (data.content || []).find((b) => b.type === "tool_use" && b.name === name);
  if (!block || !block.input || typeof block.input !== "object") {
    console.error(`[anthropic] ${name}: no tool_use block (stop_reason=${data.stop_reason})`);
    return null;
  }
  // A tool call cut off by the ceiling can still surface as a block holding
  // whatever fields it managed to emit — trusting that is how a partial answer
  // becomes a confident wrong verdict. Raise max_tokens instead of accepting it.
  if (data.stop_reason === "max_tokens") {
    console.error(`[anthropic] ${name}: truncated at max_tokens=${body.max_tokens} — discarding partial input`);
    return null;
  }
  return block.input;
}

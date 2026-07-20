/**
 * Server-authoritative game session store.
 *
 * The server is the source of truth for credibility, consumed C-suite
 * interactions, timers, task outcomes and quest-log entries — the client is
 * never trusted for these (prevents reload/tab-pause cheating).
 *
 * Persistence: in-memory Map + debounced JSON snapshot to disk, so sessions
 * survive server restarts without needing a database for v1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PERSONAS, MID_PERSONAS } from "../../shared/personas.config.js";
import { GAME_CONFIG } from "../../shared/gameConfig.js";
import { TRACKS } from "../../shared/gameContent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "data", "sessions.json");

const sessions = new Map();
let saveTimer = null;

export function loadSessions() {
  try {
    if (fs.existsSync(FILE)) {
      const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
      for (const [id, s] of Object.entries(data)) sessions.set(id, s);
      console.log(`[sessions] restored ${sessions.size} session(s)`);
    }
  } catch (e) {
    console.warn("[sessions] could not restore:", e.message);
  }
}

export function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(sessions)));
    } catch (e) {
      console.warn("[sessions] persist failed:", e.message);
    }
  }, 500);
}

function newSession(id) {
  const personas = {};
  // Mid-level personas share the same state shape; their chats are untimed and
  // unlimited so `used`/`active` simply stay 0/null — interview counts and the
  // board gate only ever see used>0 on the seven executives.
  for (const p of [...PERSONAS, ...MID_PERSONAS]) {
    personas[p.id] = {
      used: 0, // consumed interview sessions
      warmth: 0, // shallow questions decrease, substantive increase
      active: null, // { startedAt, expiresAt } while an interview is live
      transcript: [], // [{ role: "learner"|"persona", personaId?, text }]
    };
  }
  const gatekeepers = {};
  for (const trackId of Object.keys(TRACKS)) {
    gatekeepers[trackId] = {
      transcript: [], // [{ role: "learner"|"gatekeeper", text }] — unlimited, untimed
      quiz: null, // { questions: [{en,zh}, {en,zh}] } generated from the transcript on leave
      knownGaps: [], // topic strings already logged to the notebook (dedup)
    };
  }
  return {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    credibility: 0,
    flags: { metSupervisor: false, interimDone: false, boardDone: false, debriefDone: false },
    tasks: {}, // taskId -> { status: "passed"|"partial"|"failed", delta, feedback }
    personas,
    gatekeepers,
    board: { active: null, transcript: [], done: false },
    questLog: [], // [{ t, type, title, body }]
    notes: "", // player's own prep notes / queued questions
    selectedMission: null, // trackId chosen on the mission board
    profile: null, // character appearance (cosmetic)
    client: { floor: GAME_CONFIG.startFloor, x: 0, y: 0 }, // untrusted convenience
  };
}

export function getSession(id, create = true) {
  if (!id || typeof id !== "string" || id.length > 64) {
    throw Object.assign(new Error("Invalid sessionId"), { status: 400 });
  }
  let s = sessions.get(id);
  if (!s && create) {
    s = newSession(id);
    sessions.set(id, s);
    persist();
  }
  if (!s) throw Object.assign(new Error("Unknown session"), { status: 404 });
  // Migrate sessions persisted before the gatekeeper-conversation model.
  if (!s.gatekeepers) {
    s.gatekeepers = {};
    for (const trackId of Object.keys(TRACKS)) s.gatekeepers[trackId] = { transcript: [], quiz: null, knownGaps: [] };
  }
  if (s.flags.interimDone === undefined) s.flags.interimDone = false;
  // Migrate sessions persisted before the mid-level roster existed.
  for (const p of MID_PERSONAS) {
    if (!s.personas[p.id]) s.personas[p.id] = { used: 0, warmth: 0, active: null, transcript: [] };
  }
  return s;
}

/** Wipe a session so the next /session call rebuilds it from scratch. */
export function resetSession(id) {
  sessions.delete(id);
  persist();
}

export function touch(s) {
  s.updatedAt = Date.now();
  persist();
}

export function addQuestEntry(s, type, title, body) {
  s.questLog.push({ t: Date.now(), type, title, body: String(body || "").slice(0, 1200) });
  if (s.questLog.length > 400) s.questLog.splice(0, s.questLog.length - 400);
}

export function addCredibility(s, delta, reason) {
  if (!delta) return;
  s.credibility = Math.max(0, s.credibility + delta);
  addQuestEntry(s, "credibility", `Credibility ${delta > 0 ? "+" : ""}${delta} → ${s.credibility}`, reason);
}

/** Public view sent to the client — strips transcripts down to what the UI needs. */
export function publicState(s) {
  const personas = {};
  for (const [pid, p] of Object.entries(s.personas)) {
    personas[pid] = {
      used: p.used,
      warmth: p.warmth,
      active: p.active ? { expiresAt: p.active.expiresAt } : null,
    };
  }
  const gatekeepers = {};
  for (const [tid, g] of Object.entries(s.gatekeepers)) {
    gatekeepers[tid] = { hasTalked: g.transcript.length > 0 };
  }
  return {
    id: s.id,
    updatedAt: s.updatedAt, // powers the "welcome back" panel after a break
    credibility: s.credibility,
    flags: s.flags,
    tasks: s.tasks,
    personas,
    gatekeepers,
    board: { done: s.board.done, active: s.board.active ? { expiresAt: s.board.active.expiresAt } : null },
    questLog: s.questLog,
    notes: s.notes,
    selectedMission: s.selectedMission || null,
    profile: s.profile || null,
    client: s.client,
    config: {
      csuite: GAME_CONFIG.csuite,
      boardMeeting: GAME_CONFIG.boardMeeting,
    },
  };
}

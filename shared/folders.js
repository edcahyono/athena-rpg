/**
 * THE FIFTEEN COACH FOLDERS — single source of truth.
 *
 * The coach console files content into folders, one per speaking role, and a
 * shared one. A folder is a filing location, not a new concept in the game:
 * everything here already existed, scattered across two config modules and a
 * pair of duplicated string constants.
 *
 *   7 exec folders        (kind "exec")        -> one RAG store each
 *   7 gatekeeper folders  (kind "gatekeeper")  -> compiled into track.knowledge
 *   1 general folder      (kind "shared")      -> folded into every exec store
 *
 * WHY THE TWO KINDS BEHAVE DIFFERENTLY. Executives retrieve: their corpus is
 * large and a question maps to a few relevant Q&A pairs. Gatekeepers do not —
 * their knowledge string is fed WHOLE into two places, the gatekeeper system
 * prompt and the 5-MCQ generator. Retrieving three fragments for the MCQ
 * generator would quietly narrow the material every quiz is written from, so
 * gatekeeper folders compile instead. See server/rag/ingestCore.js.
 *
 * Folder ids share one namespace with chunk.personas[], so gatekeeper ids are
 * prefixed to keep them clear of the exec ids (`ops` vs `coo` etc.).
 */
import { PERSONAS } from "./personas.config.js";
import { TRACKS } from "./gameContent.js";

/** The shared corpus every executive can also draw on. Not a speaking role. */
export const GENERAL_ID = "general";

/** Distinguishes a gatekeeper folder id from its TRACKS key. */
export const GK_PREFIX = "gk-";

export const EXEC_FOLDERS = PERSONAS.map((p) => ({
  id: p.id,
  kind: "exec",
  title: { en: p.title.en, zh: p.title.zh },
}));

export const GATEKEEPER_FOLDERS = Object.entries(TRACKS).map(([trackId, t]) => ({
  id: GK_PREFIX + trackId,
  kind: "gatekeeper",
  trackId,
  title: {
    en: `${t.name.en} — gatekeeper`,
    zh: `${t.name.zh} — 关卡负责人`,
  },
}));

export const GENERAL_FOLDER = {
  id: GENERAL_ID,
  kind: "shared",
  title: { en: "General — every role", zh: "通用 — 所有角色" },
};

/** Display order in the console: executives, their gatekeepers, then general. */
export const FOLDERS = [...EXEC_FOLDERS, ...GATEKEEPER_FOLDERS, GENERAL_FOLDER];

export const FOLDER_IDS = new Set(FOLDERS.map((f) => f.id));

export const folderById = (id) => FOLDERS.find((f) => f.id === id) || null;

export const isGatekeeperFolder = (id) => String(id || "").startsWith(GK_PREFIX);

/** Gatekeeper folder id -> its key in TRACKS, or null for any other folder. */
export const trackIdForFolder = (id) =>
  isGatekeeperFolder(id) ? String(id).slice(GK_PREFIX.length) : null;

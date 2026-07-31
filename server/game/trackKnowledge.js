/**
 * Coach-uploaded gatekeeper knowledge, overlaid onto the hardcoded baseline.
 *
 * `track.knowledge` in shared/gameContent.js is the authored floor — roughly
 * 500 characters per track, written to be correct on its own. Anything a coach
 * files into that gatekeeper's folder is APPENDED to it, never replaces it, so
 * an empty folder leaves every gatekeeper behaving exactly as before and a
 * mis-ingest degrades to the shipped content rather than to nothing.
 *
 * Consumed by both places that read track.knowledge — the gatekeeper system
 * prompt and the 5-MCQ generator — so uploaded material reaches the quiz as
 * well as the conversation. That is the whole point of compiling rather than
 * retrieving: the generator sees the entire corpus, not three fragments.
 */
import fs from "node:fs";
import { GATEKEEPER_FILE } from "../rag/ingestCore.js";

const HEADER =
  "ADDITIONAL MATERIAL FILED BY YOUR ENGAGEMENT COACH (treat as equally authoritative):";

/** trackId -> compiled text. Empty until the first load; never null. */
let compiled = {};

/**
 * (Re)read the compiled file. Called at boot and again after a coach re-ingest
 * so uploads go live without a restart, mirroring loadStores() for retrieval.
 */
export function loadGatekeeperKnowledge() {
  try {
    if (!fs.existsSync(GATEKEEPER_FILE)) {
      compiled = {};
      console.log("[gatekeeper] no compiled knowledge yet — using authored baseline only.");
      return;
    }
    const { tracks } = JSON.parse(fs.readFileSync(GATEKEEPER_FILE, "utf8"));
    compiled = tracks && typeof tracks === "object" ? tracks : {};
    const filled = Object.values(compiled).filter((t) => t && t.trim()).length;
    console.log(`[gatekeeper] loaded coach knowledge for ${filled}/${Object.keys(compiled).length} tracks`);
  } catch (err) {
    // Never let a malformed file take the gatekeepers down: the baseline alone
    // is a fully working game, so degrade to it and say so loudly.
    compiled = {};
    console.warn(`[gatekeeper] could not read compiled knowledge (${err.message}) — using authored baseline only.`);
  }
}

/** TRACKS entries carry no id of their own; taskId is always `track-<key>`. */
const trackKeyOf = (track) => String(track?.taskId || "").replace(/^track-/, "");

/**
 * resolveTrack(track) -> track with coach material folded into `knowledge`.
 *
 * Returns the SAME object when there is nothing to add, so the common path
 * allocates nothing and callers can wrap unconditionally.
 */
export function resolveTrack(track) {
  if (!track) return track;
  const extra = compiled[trackKeyOf(track)];
  if (!extra || !extra.trim()) return track;
  return { ...track, knowledge: `${track.knowledge}\n\n${HEADER}\n${extra}` };
}

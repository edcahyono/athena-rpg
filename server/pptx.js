/**
 * PowerPoint (.pptx) validation and text extraction for the Final Presentation.
 *
 * The final deliverable is deliberately a hard spec — a .pptx of EXACTLY ten
 * slides — and it is refused at the door rather than graded leniently, because
 * "fit the argument into ten slides" is itself the exercise. A PDF export, a
 * Word document or an eleven-slide deck never reaches an executive.
 *
 * A .pptx is an OPC package: a ZIP whose slides live at ppt/slides/slideN.xml,
 * one entry per slide. Counting those entries is exact — unlike a PDF, where
 * "pages" depends on the renderer — which is the other reason the spec is
 * PowerPoint-only.
 */
import JSZip from "jszip";

/** The deck spec. Both are hard requirements; neither is negotiable in-game. */
export const REQUIRED_EXT = ".pptx";
export const REQUIRED_SLIDES = 10;

/** Matches ppt/slides/slide<N>.xml but NOT ppt/slides/_rels/... or layouts. */
const SLIDE_RE = /^ppt\/slides\/slide(\d+)\.xml$/;

/** Strip XML tags to plain text, collapsing whitespace. */
function xmlToText(xml) {
  return xml
    // Replace tags with a space rather than nothing, so text from adjacent
    // runs doesn't fuse into a single unreadable word.
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate the upload and, if it passes, return the deck's text slide by slide.
 *
 * Returns { ok: true, slides: string[], text } or { ok: false, reason, detail }
 * where `reason` is a machine-readable code the client turns into a localised
 * message: "ext" (not a .pptx), "corrupt" (not a readable ZIP/OPC package), or
 * "slides" (wrong slide count — detail carries the number actually found).
 */
export async function readDeck(filename, buffer) {
  const name = String(filename || "");
  if (!name.toLowerCase().endsWith(REQUIRED_EXT)) {
    return { ok: false, reason: "ext", detail: name.split(".").pop() || "unknown" };
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    // A .pptx that isn't a valid ZIP is either corrupt or renamed from another
    // format — both are the learner's to fix, and both need saying plainly.
    return { ok: false, reason: "corrupt" };
  }

  const slideFiles = Object.keys(zip.files)
    .filter((p) => SLIDE_RE.test(p))
    // slide10 must sort after slide9, so order numerically, not lexically.
    .sort((a, b) => Number(a.match(SLIDE_RE)[1]) - Number(b.match(SLIDE_RE)[1]));

  if (!slideFiles.length) return { ok: false, reason: "corrupt" };
  if (slideFiles.length !== REQUIRED_SLIDES) {
    return { ok: false, reason: "slides", detail: slideFiles.length };
  }

  const slides = [];
  for (const path of slideFiles) {
    const xml = await zip.files[path].async("string");
    slides.push(xmlToText(xml));
  }

  const text = slides
    .map((s, i) => `--- Slide ${i + 1} ---\n${s || "(no text on this slide)"}`)
    .join("\n\n");

  return { ok: true, slides, text };
}

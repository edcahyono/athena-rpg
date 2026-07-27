/**
 * Font stacks, shared by the DOM (via CSS custom properties in styles.css) and
 * by Phaser's canvas text. Space Mono carries the interface, Pixelify Sans the
 * dialogue; neither ships Chinese glyphs, so Zpix — a pixel font for simplified
 * Chinese — closes both stacks and supplies every CJK codepoint.
 */
export const FONT_UI = '"Space Mono", "Zpix", ui-monospace, monospace';
export const FONT_DLG = '"Pixelify Sans", "Zpix", ui-monospace, monospace';

/**
 * Canvas text does NOT re-render when a webfont finishes loading — Phaser
 * rasterises each label once, so a label built before the font arrives is
 * stuck in the fallback face for the life of the scene. Await this before
 * booting the game. Zpix is ~940KB, so it is requested but not waited on past
 * the timeout; worst case the first Chinese labels fall back for a moment.
 */
export async function loadFonts(timeoutMs = 3000): Promise<void> {
  if (!document.fonts?.load) return;
  const faces = [
    '400 16px "Space Mono"', '700 16px "Space Mono"',
    '400 16px "Pixelify Sans"', '700 16px "Pixelify Sans"',
    '400 16px "Zpix"',
  ];
  // document.fonts.load only fetches what the sample text needs, and the
  // default sample is Latin — so Zpix has to be probed with a Chinese sample.
  const pending = faces.map((f) => document.fonts.load(f, f.includes("Zpix") ? "汉字" : "Ag"));
  await Promise.race([
    Promise.all(pending).catch(() => undefined),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);
}

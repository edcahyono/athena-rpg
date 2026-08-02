/**
 * Character portraits for the DOM, keyed by NpcDef.color.
 *
 * The cast is drawn procedurally into Phaser's texture manager at boot, so the
 * sprites live on the canvas side and the HTML panels cannot reference them.
 * BootScene exports each one to a data URI here once, and the directory renders
 * them as ordinary <img>. Populated before any panel can open, since BootScene
 * runs first.
 */
export const FACES = new Map<number, string>();

/** Portrait for an NPC colour, or "" if boot hasn't run yet. */
export const faceFor = (color: number): string => FACES.get(color) || "";

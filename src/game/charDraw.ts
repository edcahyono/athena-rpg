/**
 * Pixel character renderer — one draw routine consumed by BOTH Phaser texture
 * generation (BootScene) and the 2D-canvas preview in the character creator.
 * Canvas size: 20 x 28.
 *
 * Hairstyles are PARAMETRIC (fringe × length × texture × updo) so 20 distinct,
 * named presets per gender (40 total) come from one renderer instead of 40
 * hand-authored sprites. Clothing has real type variety (business-casual and
 * smart-casual tops/bottoms), each with its own silhouette details, plus an
 * independent color choice.
 */
export const DIRS = ["down", "up", "left", "right"] as const;
export type Dir = (typeof DIRS)[number];
export type Gender = "male" | "female";

export type Fringe = "full" | "side" | "middle" | "none";
export type Length = "buzz" | "short" | "medium" | "long" | "veryLong";
export type Texture = "straight" | "wavy" | "curly" | "spiky";
export type Updo = "none" | "ponytailHigh" | "ponytailLow" | "bunTop" | "twinTails" | "braidSingle";

export interface HairPreset {
  key: string;
  en: string;
  zh: string;
  fringe: Fringe;
  length: Length;
  texture: Texture;
  updo: Updo;
}

export type TopType = "dressShirt" | "blouse" | "polo" | "sweater" | "cardigan" | "blazer";
export type BottomType = "dressPants" | "chinos" | "shorts" | "pencilSkirt" | "aLineSkirt";

export interface CharOpts {
  gender: Gender;
  skin: number;
  hairKey: string; // key into HAIRSTYLES_MALE / HAIRSTYLES_FEMALE
  hair: number; // color index
  topType: TopType;
  topColor: number;
  bottomType: BottomType;
  bottomColor: number;
  shoes: number;
}

export const SKIN_TONES = [0xf5d6b8, 0xe8bb90, 0xc98d5e, 0x8d5a3a];
export const HAIR_COLORS = [0x2a2a35, 0x5a3a22, 0x8a6a3a, 0x7a3a4a, 0xd8c090, 0x1a1a1a];
export const TOP_COLORS = [0x1d7a74, 0x2a6e46, 0x8a3b5c, 0x3b5c8a, 0xb8862d, 0x4a4a5c, 0xf4f0e4, 0x7a2f3a];
export const BOTTOM_COLORS = [0x35354a, 0x4a3a2e, 0x2e4a3a, 0x555565, 0x1a1a24, 0x6e5a42];
export const SHOE_COLORS = [0x23232f, 0x6e4a2b, 0xd8d8e0];

export const TOP_TYPES: { key: TopType; en: string; zh: string; group: string }[] = [
  { key: "dressShirt", en: "Dress Shirt", zh: "衬衫", group: "business" },
  { key: "blazer", en: "Blazer", zh: "西装外套", group: "business" },
  { key: "cardigan", en: "Cardigan", zh: "开衫", group: "business" },
  { key: "blouse", en: "Blouse", zh: "女式衬衫", group: "business" },
  { key: "polo", en: "Polo", zh: "Polo衫", group: "smart" },
  { key: "sweater", en: "Sweater", zh: "毛衣", group: "smart" },
];

export const BOTTOM_TYPES: { key: BottomType; en: string; zh: string; group: string }[] = [
  { key: "dressPants", en: "Dress Pants", zh: "西裤", group: "business" },
  { key: "pencilSkirt", en: "Pencil Skirt", zh: "铅笔裙", group: "business" },
  { key: "chinos", en: "Chinos", zh: "休闲裤", group: "smart" },
  { key: "aLineSkirt", en: "A-Line Skirt", zh: "A字裙", group: "smart" },
  { key: "shorts", en: "Shorts", zh: "短裤", group: "smart" },
];

// Wardrobe lists offered per gender — skirts and the blouse are female-only.
const MALE_EXCLUDED_TOPS: TopType[] = ["blouse"];
const MALE_EXCLUDED_BOTTOMS: BottomType[] = ["pencilSkirt", "aLineSkirt"];

export function topTypesFor(gender: Gender) {
  return gender === "male" ? TOP_TYPES.filter((t) => !MALE_EXCLUDED_TOPS.includes(t.key)) : TOP_TYPES;
}

export function bottomTypesFor(gender: Gender) {
  return gender === "male" ? BOTTOM_TYPES.filter((t) => !MALE_EXCLUDED_BOTTOMS.includes(t.key)) : BOTTOM_TYPES;
}

/* ------------------------------ hairstyles ------------------------------ */

export const HAIRSTYLES_MALE: HairPreset[] = [
  { key: "m-buzz", en: "Buzz Cut", zh: "寸头", fringe: "none", length: "buzz", texture: "straight", updo: "none" },
  { key: "m-crew", en: "Crew Cut", zh: "平头", fringe: "full", length: "short", texture: "straight", updo: "none" },
  { key: "m-sidepart", en: "Side Part", zh: "偏分", fringe: "side", length: "short", texture: "straight", updo: "none" },
  { key: "m-crop", en: "Textured Crop", zh: "碎发短发", fringe: "side", length: "short", texture: "spiky", updo: "none" },
  { key: "m-quiff", en: "Quiff", zh: "飞机头", fringe: "full", length: "short", texture: "spiky", updo: "none" },
  { key: "m-pomp", en: "Pompadour", zh: "蓬帕杜", fringe: "side", length: "medium", texture: "straight", updo: "none" },
  { key: "m-slick", en: "Slicked Back", zh: "背头", fringe: "none", length: "medium", texture: "straight", updo: "none" },
  { key: "m-undercut", en: "Undercut", zh: "侧剃寸头", fringe: "side", length: "short", texture: "straight", updo: "none" },
  { key: "m-curlycrop", en: "Curly Crop", zh: "卷发短发", fringe: "full", length: "short", texture: "curly", updo: "none" },
  { key: "m-messy", en: "Messy Spiky", zh: "凌乱刺猬头", fringe: "full", length: "short", texture: "spiky", updo: "none" },
  { key: "m-layered", en: "Medium Layered", zh: "中长层次", fringe: "middle", length: "medium", texture: "wavy", updo: "none" },
  { key: "m-bun", en: "Man Bun", zh: "丸子头", fringe: "side", length: "long", texture: "straight", updo: "bunTop" },
  { key: "m-pony", en: "Ponytail", zh: "低马尾", fringe: "side", length: "long", texture: "straight", updo: "ponytailLow" },
  { key: "m-highpony", en: "High Ponytail", zh: "高马尾", fringe: "full", length: "long", texture: "straight", updo: "ponytailHigh" },
  { key: "m-longwavy", en: "Long Wavy", zh: "长卷发", fringe: "middle", length: "long", texture: "wavy", updo: "none" },
  { key: "m-braid", en: "Braided", zh: "编发", fringe: "side", length: "medium", texture: "straight", updo: "braidSingle" },
  { key: "m-afro", en: "Afro", zh: "爆炸头", fringe: "full", length: "short", texture: "curly", updo: "none" },
  { key: "m-mohawk", en: "Mohawk", zh: "莫西干头", fringe: "none", length: "buzz", texture: "spiky", updo: "none" },
  { key: "m-receding", en: "Receding", zh: "谢顶", fringe: "none", length: "buzz", texture: "straight", updo: "none" },
  { key: "m-longstraight", en: "Long Straight", zh: "长直发", fringe: "middle", length: "veryLong", texture: "straight", updo: "none" },
];

export const HAIRSTYLES_FEMALE: HairPreset[] = [
  { key: "f-pixie", en: "Pixie", zh: "精灵短发", fringe: "side", length: "buzz", texture: "straight", updo: "none" },
  { key: "f-bob", en: "Short Bob", zh: "波波头", fringe: "full", length: "short", texture: "straight", updo: "none" },
  { key: "f-curlybob", en: "Curly Bob", zh: "卷波波头", fringe: "full", length: "short", texture: "curly", updo: "none" },
  { key: "f-sidepart", en: "Side Part Short", zh: "偏分短发", fringe: "side", length: "short", texture: "straight", updo: "none" },
  { key: "f-wavybob", en: "Wavy Bob", zh: "微卷波波头", fringe: "full", length: "short", texture: "wavy", updo: "none" },
  { key: "f-medstraight", en: "Medium Straight", zh: "中长直发", fringe: "middle", length: "medium", texture: "straight", updo: "none" },
  { key: "f-medcurly", en: "Medium Curly", zh: "中长卷发", fringe: "middle", length: "medium", texture: "curly", updo: "none" },
  { key: "f-shoulderwavy", en: "Shoulder Wavy", zh: "披肩卷发", fringe: "side", length: "medium", texture: "wavy", updo: "none" },
  { key: "f-highpony", en: "High Ponytail", zh: "高马尾", fringe: "full", length: "long", texture: "straight", updo: "ponytailHigh" },
  { key: "f-lowpony", en: "Low Ponytail", zh: "低马尾", fringe: "side", length: "long", texture: "straight", updo: "ponytailLow" },
  { key: "f-twintails", en: "Twin Tails", zh: "双马尾", fringe: "full", length: "medium", texture: "straight", updo: "twinTails" },
  { key: "f-braidedtwin", en: "Braided Twin", zh: "双编发", fringe: "middle", length: "medium", texture: "straight", updo: "twinTails" },
  { key: "f-braid", en: "Single Braid", zh: "单辫子", fringe: "side", length: "long", texture: "straight", updo: "braidSingle" },
  { key: "f-topbun", en: "Top Bun", zh: "丸子头", fringe: "full", length: "long", texture: "straight", updo: "bunTop" },
  { key: "f-longstraight", en: "Long Straight", zh: "长直发", fringe: "middle", length: "veryLong", texture: "straight", updo: "none" },
  { key: "f-longwavy", en: "Long Wavy", zh: "长卷发", fringe: "side", length: "veryLong", texture: "wavy", updo: "none" },
  { key: "f-longcurly", en: "Long Curly", zh: "长卷发（大波浪）", fringe: "full", length: "veryLong", texture: "curly", updo: "none" },
  { key: "f-blunt", en: "Blunt Bangs Long", zh: "齐刘海长发", fringe: "full", length: "long", texture: "straight", updo: "none" },
  { key: "f-halfup", en: "Half-Up", zh: "半扎发", fringe: "middle", length: "medium", texture: "wavy", updo: "ponytailHigh" },
  { key: "f-curtain", en: "Curtain Bangs", zh: "中分刘海中长发", fringe: "side", length: "medium", texture: "wavy", updo: "none" },
];

export function hairstylesFor(gender: Gender): HairPreset[] {
  return gender === "female" ? HAIRSTYLES_FEMALE : HAIRSTYLES_MALE;
}

export function findHairstyle(gender: Gender, key: string): HairPreset {
  return hairstylesFor(gender).find((h) => h.key === key) || hairstylesFor(gender)[0];
}

export const DEFAULT_PLAYER: CharOpts = {
  gender: "female",
  skin: 0,
  hairKey: HAIRSTYLES_FEMALE[1].key,
  hair: 0,
  topType: "dressShirt",
  topColor: 0,
  bottomType: "dressPants",
  bottomColor: 0,
  shoes: 0,
};

type Rect = (x: number, y: number, w: number, h: number, color: number, alpha?: number) => void;

const OUTLINE = 0x1a1420;
const clampY = (y: number) => Math.max(0, y);

/* -------------------------------- hair ---------------------------------- */

function drawHair(rect: Rect, dir: Dir, preset: HairPreset, hairColor: number) {
  const { fringe, length, texture, updo } = preset;

  if (fringe === "full") {
    rect(4, 1, 12, 4, hairColor);
  } else if (fringe === "side") {
    rect(4, 1, 7, 5, hairColor);
    rect(11, 1, 5, 3, hairColor);
  } else if (fringe === "middle") {
    rect(4, 1, 5, 4, hairColor);
    rect(11, 1, 5, 4, hairColor);
    rect(4, 3, 12, 1, hairColor);
  } else {
    rect(4, 1, 12, 2, hairColor); // none — buzzed hairline only
  }

  if (texture === "spiky") {
    rect(4, clampY(-1), 2, 3, hairColor);
    rect(7, clampY(-2), 2, 3, hairColor);
    rect(10, clampY(-2), 2, 3, hairColor);
    rect(13, clampY(-1), 2, 3, hairColor);
  } else if (texture === "curly") {
    rect(3, 1, 2, 3, hairColor);
    rect(15, 1, 2, 3, hairColor);
    rect(6, clampY(0), 3, 2, hairColor);
    rect(10, clampY(0), 3, 2, hairColor);
  } else if (texture === "wavy") {
    rect(3, 4, 2, 2, hairColor);
    rect(15, 4, 2, 2, hairColor);
  }

  const sideLen = { buzz: 0, short: 5, medium: 9, long: 14, veryLong: 20 }[length];
  if (sideLen > 0) {
    rect(3, 2, 2, Math.min(sideLen, 25), hairColor);
    rect(15, 2, 2, Math.min(sideLen, 25), hairColor);
  }

  if (updo === "ponytailHigh") {
    rect(9, clampY(-1), 3, 3, hairColor);
    rect(16, 3, 3, 8, hairColor);
  } else if (updo === "ponytailLow") {
    rect(9, 9, 3, 3, hairColor);
    rect(16, 10, 3, 10, hairColor);
  } else if (updo === "bunTop") {
    rect(7, clampY(-2), 6, 4, hairColor);
  } else if (updo === "twinTails") {
    rect(0, 3, 3, 10, hairColor);
    rect(17, 3, 3, 10, hairColor);
  } else if (updo === "braidSingle") {
    rect(9, 10, 3, 3, hairColor);
    rect(9, 13, 3, 3, hairColor);
    rect(9, 16, 3, 3, hairColor);
  }

  if (dir === "up") rect(4, 1, 12, 9, hairColor);
  if (dir === "left" && length !== "buzz") rect(11, 1, 5, 8, hairColor);
  if (dir === "right" && length !== "buzz") rect(4, 1, 5, 8, hairColor);
}

/* -------------------------------- tops ----------------------------------- */

function drawTop(rect: Rect, dir: Dir, type: TopType, color: number) {
  rect(3, 11, 14, 10, color);
  rect(14, 11, 3, 10, OUTLINE, 0.22); // shade for volume
  if (dir !== "right") rect(1, 12, 3, 8, color);
  if (dir !== "left") rect(16, 12, 3, 8, color);

  if (type === "blazer") {
    rect(6, 11, 2, 5, OUTLINE, 0.35); // left lapel
    rect(12, 11, 2, 5, OUTLINE, 0.35); // right lapel
    rect(9, 13, 2, 6, 0xf4f0e4, 0.85); // shirt sliver underneath
  } else if (type === "cardigan") {
    rect(9, 11, 2, 10, OUTLINE, 0.3); // open front seam
    rect(8, 15, 1, 1, 0xf4f0e4); rect(8, 18, 1, 1, 0xf4f0e4); // buttons
  } else if (type === "polo") {
    rect(8, 11, 4, 2, 0xf4f0e4, 0.9); // open collar wedge
    rect(9, 14, 1, 1, 0xf4f0e4);
  } else if (type === "sweater") {
    rect(3, 19, 14, 2, OUTLINE, 0.25); // ribbed hem
    rect(7, 11, 6, 2, OUTLINE, 0.2); // crew neckline
  } else if (type === "blouse") {
    rect(4, 11, 12, 1, 0xffffff, 0.35); // soft ruffled top edge
  }
  // dressShirt: plain block is the base look — small collar hint
  if (type === "dressShirt") rect(8, 11, 4, 1, 0xf4f0e4, 0.7);
}

/* ------------------------------- bottoms ---------------------------------- */

function drawBottoms(rect: Rect, dir: Dir, frame: number, type: TopBottomFrame, color: number, skin: number, shoe: number) {
  if (type === "pencilSkirt") {
    rect(5, 20, 10, 5, color);
    rect(6, 25, 3, 1, skin); rect(11, 25, 3, 1, skin);
    if (frame === 0) { rect(5, 26, 4, 2, shoe); rect(11, 26, 4, 2, shoe); }
    else { rect(4, 26, 4, 2, shoe); rect(12, 25, 4, 2, shoe); }
    return;
  }
  if (type === "aLineSkirt") {
    rect(6, 20, 8, 3, color);
    rect(4, 22, 12, 3, color); // flare
    rect(6, 25, 3, 1, skin); rect(11, 25, 3, 1, skin);
    if (frame === 0) { rect(5, 26, 4, 2, shoe); rect(11, 26, 4, 2, shoe); }
    else { rect(4, 26, 4, 2, shoe); rect(12, 25, 4, 2, shoe); }
    return;
  }

  const hemY = type === "shorts" ? 24 : 26;
  if (frame === 0) { rect(5, 21, 4, hemY - 21, color); rect(11, 21, 4, hemY - 21, color); }
  else if (dir === "left" || dir === "right") { rect(4, 21, 4, hemY - 21, color); rect(12, 20, 4, hemY - 20, color); }
  else { rect(5, 20, 4, hemY - 20 + 1, color); rect(11, 22, 4, hemY - 22, color); }

  if (type === "shorts") {
    rect(5, hemY, 4, 2, skin); rect(11, hemY, 4, 2, skin); // bare shin
  }
  if (frame === 0) { rect(5, 26, 4, 2, shoe); rect(11, 26, 4, 2, shoe); }
  else { rect(4, 26, 4, 2, shoe); rect(12, 25, 4, 2, shoe); }
}
type TopBottomFrame = BottomType;

/** Draw one frame of the character via a rect callback (Phaser or canvas2D).
 *  `topColorOverride`/`bottomColorOverride` let NPCs use arbitrary hex colors. */
export function drawCharacter(
  rect: Rect, dir: Dir, frame: number, o: CharOpts,
  topColorOverride?: number,
) {
  const skin = SKIN_TONES[o.skin % SKIN_TONES.length];
  const hairColor = HAIR_COLORS[o.hair % HAIR_COLORS.length];
  const topColor = topColorOverride ?? TOP_COLORS[o.topColor % TOP_COLORS.length];
  const bottomColor = BOTTOM_COLORS[o.bottomColor % BOTTOM_COLORS.length];
  const shoeColor = SHOE_COLORS[o.shoes % SHOE_COLORS.length];
  const preset = findHairstyle(o.gender, o.hairKey);

  // outline silhouette
  rect(3, 0, 14, 13, OUTLINE);
  rect(2, 10, 16, 13, OUTLINE);
  rect(4, 20, 12, 8, OUTLINE);
  if (dir !== "right") rect(0, 11, 4, 10, OUTLINE);
  if (dir !== "left") rect(16, 11, 4, 10, OUTLINE);

  // shoes drawn under legs first is unnecessary — bottoms handle their own shoes
  drawBottoms(rect, dir, frame, o.bottomType, bottomColor, skin, shoeColor);
  drawTop(rect, dir, o.topType, topColor);

  // head
  rect(4, 1, 12, 11, skin);
  drawHair(rect, dir, preset, hairColor);

  // eyes
  const eye = 0x1a1a1a;
  if (dir === "down") { rect(6, 7, 2, 2, eye); rect(12, 7, 2, 2, eye); }
  if (dir === "left") rect(5, 7, 2, 2, eye);
  if (dir === "right") rect(13, 7, 2, 2, eye);
}

/** Convenience: draw onto a 2D canvas context at integer scale. */
export function drawToCanvas(ctx: CanvasRenderingContext2D, dir: Dir, frame: number, o: CharOpts, scale: number) {
  ctx.clearRect(0, 0, 20 * scale, 28 * scale);
  drawCharacter((x, y, w, h, color, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.round(w * scale), Math.round(h * scale));
    ctx.globalAlpha = 1;
  }, dir, frame, o);
}

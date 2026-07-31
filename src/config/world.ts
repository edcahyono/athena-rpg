/**
 * World definition — floor layouts + NPC placement. All player-facing text is
 * bilingual {en, zh}; resolve with L() from i18n at render time.
 *
 * Layout chars: '#' wall · '.' floor · 'd' desk · 'p' plant · 't' table
 *               'E' elevator (interactable) · 'r' reception desk · 'c' carpet
 *               'k' water cooler (comedic prop) · 'o' copier (comedic prop)
 */
import { PERSONAS, MID_PERSONAS } from "../../shared/personas.config.js";
import type { BL } from "../i18n";

export const TILE = 32;
// "X" — the F15 executive office doorway — is deliberately NOT here. It is a
// gap in the wall you walk through, in and out, like any other doorway. It used
// to block, with E teleporting you across it, which meant the only way out of a
// room competed with talking to the executive standing in it. Walking is the
// mechanic; nothing needs to arbitrate.
export const BLOCKING = new Set(["#", "d", "p", "t", "E", "r", "k", "o", "W", "D", "n", "N", "G", "B", "F"]);

// Palette for the decorative filler workers that fill the open floors.
export const FILLER_COLORS = [0x76808f, 0x8f7680, 0x7f8f76, 0x76778f, 0x8f8676, 0x6f8087];

// Elevator now sits LEFT-CENTER (col 1, rows 7-8) on every floor, mirroring the
// real building where you step out of the lift into a corridor and the offices
// extend to the right. The scripted walk-out (OfficeScene) steps RIGHT.
// F12 reception: staff behind a counter, a small waiting area, a pantry, and
// three sealed glass MEETING ROOMS (decorative — they fill the floor and echo
// the real building's "Room" suites; you can't enter them).
const LOBBY = [
  "#################################",
  "#......................GGGGGGGGG#",
  "#......................GBBBBBBBG#",
  "#......................G.......G#",
  "#......................G.......G#",
  "#......................GBBBBBBBG#",
  "#......................G.......G#",
  "#E.....................F.......G#",
  "#E.....................G.......G#",
  "#......................G.......G#",
  "#......................GBBBBBBBG#",
  "#......................G.......G#",
  "#......................G.......G#",
  "#......................GBBBBBBBG#",
  "#......................GGGGGGGGG#",
  "#################################",
];

// Open floors: the old fixed 'd' desk clusters are gone — cubicles are now
// placed procedurally (real NPCs + decorative filler workers) in neat rows,
// so desks never overlap an NPC's own workstation.
const OFFICE = [
  "#################################",
  "#p.............................p#",
  "#...............................#",
  "#...............................#",
  "#...............................#",
  "#...............................#",
  "#...............................#",
  "#E..............................#",
  "#E..............................#",
  "#...............................#",
  "#...............................#",
  "#...............................#",
  "#...............................#",
  "#...............................#",
  "#p.............................p#",
  "#################################",
];

// Floor 15 — the executive floor. Seven individual, walled corner offices
// (W = executive wall/glass partition, D = executive desk, g = plush carpet)
// open onto a central corridor. Four along the top, three along the bottom.
// Floor 15 — fully-enclosed private executive offices. Each office is sealed
// (W walls, N glass backs) with a single door tile X: press E at the door to
// enter/exit; the interior is frosted over until you're inside. The CEO's
// office sits alone on the left, center — and is the biggest.
// Floor 15 — seven identical private executive offices (all the same size).
// Each is a small room walled in GLASS (G) with a simple BLACK interior (b) and
// a single door (X): press E at the door to step inside/out. Frosted over until
// you enter. Three offices along the top, four along the bottom.
// Floor 15 glass meeting-room suite (real building: Rooms 1501-1504). Seven
// sealed private offices in GLASS (G) with BLACK interiors (b) and a single
// door (X); shifted right so the LEFT-CENTER elevator (col 1, rows 7-8) opens
// onto the central corridor (row 8). Three offices along the top, four below.
const EXEC = [
  "#################################",
  "#.......GGGGG.GGGGG.GGGGG.GGGGG.#",
  "#.......GbbbG.GbbbG.GbbbG.GbbbG.#",
  "#.......GbbbG.GbbbG.GbbbG.GbbbG.#",
  "#.......GbbbG.GbbbG.GbbbG.GbbbG.#",
  "#.......GGXGG.GGXGG.GGXGG.GGXGG.#",
  "#...............................#",
  "#E..r...........................#",
  "#E..............................#",
  "#...............................#",
  "#.......GGXGG...GGXGG...GGXGG...#",
  "#.......GbbbG...GbbbG...GbbbG...#",
  "#.......GbbbG...GbbbG...GbbbG...#",
  "#.......GbbbG...GbbbG...GbbbG...#",
  "#.......GGGGG...GGGGG...GGGGG...#",
  "#################################",
];

const BOARDROOM = [
  "#################################",
  "#p.............................p#",
  "#...............................#",
  "#...............................#",
  "#.......ttttttttttttttttt.......#",
  "#.......ttttttttttttttttt.......#",
  "#.......ttttttttttttttttt.......#",
  "#E..............................#",
  "#E..............................#",
  "#...............................#",
  "#...............................#",
  "#....p.....................p....#",
  "#...............................#",
  "#...............................#",
  "#p.............................p#",
  "#################################",
];

export interface NpcDef {
  id: string;
  name: BL;
  role: BL;
  floor: number;
  tx: number; // tile coords
  ty: number;
  color: number;
  kind: "supervisor" | "task" | "flavor" | "persona" | "midpersona" | "board" | "prop";
  taskId?: string;
  personaId?: string;
  trackId?: string;
  lines?: BL[];
  /** Initial facing for a seated/standing NPC (default "down"). */
  facing?: "down" | "up" | "left" | "right";
}

const personaColors: Record<string, number> = {};
for (const p of PERSONAS) personaColors[p.id] = parseInt(p.accent.slice(1), 16);

// Executive display names (persona cards); CPO card has no personal name.
const PERSONA_NAMES: Record<string, BL> = {
  ceo: { en: "Chen Wei", zh: "陈韦" },
  cfo: { en: "Zhou Mingyuan", zh: "周明远" },
  cmo: { en: "Zhang Aiwei", zh: "张艾薇" },
  coo: { en: "Zhao Zhengping", zh: "赵正平" },
  chro: { en: "Shen Ruolin", zh: "沈若琳" },
  cto: { en: "Lin Zhiyao", zh: "林知遥" },
  cpo: { en: "CPO", zh: "首席产品官" },
};

export const NPCS: NpcDef[] = [
  // ---- Floor 12: Front desk — Supervisor + flavor ----
  // Deloitte roles follow the real ladder: Analyst → Consultant → Senior
  // Consultant → Manager → Senior Manager, with real offering names.
  { id: "supervisor", name: { en: "Manager Lin", zh: "林经理" }, role: { en: "Manager · Consumer Industry, Deloitte", zh: "经理 · 德勤消费品行业" }, floor: 12, tx: 12, ty: 3, color: 0x2a6e46, kind: "supervisor" },
  { id: "reception", name: { en: "Xiao Mei", zh: "小美" }, role: { en: "Receptionist", zh: "前台" }, floor: 12, tx: 4, ty: 3, color: 0xc06a8a, kind: "flavor",
    lines: [
      { en: "Welcome to Deloitte! Badge, please… oh, you're the new analyst. Manager Lin is waiting for you.", zh: "欢迎来到德勤！请出示工卡……哦，你是新来的分析师吧。林经理正等着你呢。" },
      { en: "The elevators are behind me. Some floors need… seniority.", zh: "电梯在我身后。有些楼层嘛……得有点资历才进得去。" },
      { en: "Coffee machine on 10 is broken again. Don't tell anyone I told you.", zh: "10层的咖啡机又坏了。别说是我告诉你的。" },
    ] },
  // Posted by the file room, well clear of the central hallway: his old spot
  // (12,9) sat directly under the day-one briefing, so he ended up standing on
  // top of the player and hiding their sprite.
  { id: "guard", name: { en: "Lao Zhang", zh: "老张" }, role: { en: "Security", zh: "保安" }, floor: 12, tx: 20, ty: 7, color: 0x445566, kind: "flavor",
    lines: [
      { en: "I've guarded this lobby for 15 years. Seen a thousand analysts. You look… adequately terrified.", zh: "我在这个大堂守了15年，见过上千个分析师。你看起来……紧张得恰到好处。" },
      { en: "No, you can't take the executive elevator. Yes, everyone asks.", zh: "不行，高管电梯你不能坐。对，每个人都这么问。" },
    ] },
  { id: "intern-1", name: { en: "Kevin", zh: "凯文" }, role: { en: "Summer Intern · Deloitte", zh: "暑期实习生 · 德勤" }, floor: 12, tx: 4, ty: 11, color: 0x8a8a3b, kind: "flavor",
    lines: [
      { en: "I heard the Nike executives on 15 only talk to people vouched for by the engagement team.", zh: "听说15层的耐克高管只见项目组担保过的人。" },
      { en: "Rumor is the CFO can smell an unprepared question from across the room.", zh: "传言说CFO隔着整个房间都能闻出一个没准备好的问题。" },
      { en: "I've been fetching coffee for three months. Living the dream.", zh: "我端了三个月咖啡了。梦想成真，就是这个味儿。" },
    ] },

  // ---- Floor 10: Assurance & Advisory engagement floor — the seven Deloitte
  // gatekeepers all sit here together, plus IT support and floor staff. ----
  { id: "it-guy", name: { en: "Ah Qiang", zh: "阿强" }, role: { en: "IT Support · Deloitte Technology", zh: "IT支持 · 德勤科技" }, floor: 10, tx: 4, ty: 11, color: 0x3b5c8a, kind: "flavor",
    lines: [
      { en: "Have you tried turning it off and on again?", zh: "你试过重启吗？" },
      { en: "Someone upstairs asked me to 'install more RAM into the strategy'. I need a vacation.", zh: "楼上有人让我「给战略加根内存条」。我需要休假。" },
      { en: "The Wi-Fi password is on the sticky note. The one that says 'do not share'.", zh: "Wi-Fi密码在便利贴上。就是写着「严禁外传」的那张。" },
    ] },
  { id: "it-aunty", name: { en: "Aunty Hong", zh: "红姨" }, role: { en: "Office Aunty", zh: "办公室阿姨" }, floor: 10, tx: 8, ty: 11, color: 0xa05a3b, kind: "flavor",
    lines: [
      { en: "Aiyah, you look thin! Take a mooncake from the pantry.", zh: "哎呀，你怎么这么瘦！去茶水间拿块月饼吃。" },
      { en: "In my day, consultants wrote strategies on PAPER. Uphill. Both ways.", zh: "我们那个年代，咨询师都是用纸写战略的。还得爬楼送稿，来回都是上坡。" },
    ] },

  // ---- Floor 11: Nike China middle management (VP / Sr Director / Sr Mgr / Mgr) ----
  // One mid-level digital human per C-suite line — unlocked together with
  // their boss's track. Untimed, unlimited conversations: this is where the
  // frontline detail lives (real projects interview far more middle managers
  // than executives). Dave stays; he just has more company now.
  { id: "lost-consultant", name: { en: "Dave", zh: "戴夫" }, role: { en: "Senior Consultant · (hiding)", zh: "高级顾问 ·（躲清静中）" }, floor: 11, tx: 28, ty: 11, color: 0x777777, kind: "flavor",
    lines: [
      { en: "This used to be the quiet floor. Then Nike's middle managers moved in. Now everyone wants 'a quick sync'.", zh: "这层以前是清静楼层。后来耐克的中层管理团队搬了进来。现在人人都想「快速对齐一下」。" },
      { en: "Pro tip: the middle managers have unlimited time and the real numbers. The executives upstairs have neither.", zh: "小建议：中层经理们有的是时间，还有真实数据。楼上的高管俩样都没有。" },
      { en: "Shhh. If they can't find you, they can't staff you.", zh: "嘘。他们找不到你，就没法把你派到项目上。" },
    ] },

  // ---- Floor 10: the seven Deloitte gatekeepers (Product, Marketing, Tech,
  // Strategy, Finance, Ops, HR) sit together across the engagement floor, in
  // two neat desk rows. Pass a gatekeeper and the matching Nike exec on 15
  // takes your meeting. ----
  { id: "gk-product", name: { en: "Chen Jing", zh: "陈静" }, role: { en: "Consultant · Consumer Products", zh: "顾问 · 消费品行业" }, floor: 10, tx: 12, ty: 3, color: 0x3b8a6e, kind: "task", taskId: "track-product", trackId: "product" },
  { id: "gk-marketing", name: { en: "Marcus", zh: "马克" }, role: { en: "Manager · Customer & Marketing", zh: "经理 · 客户与营销" }, floor: 10, tx: 16, ty: 3, color: 0x8a5c3b, kind: "task", taskId: "track-marketing", trackId: "marketing" },
  { id: "gk-tech", name: { en: "Ryan Xu", zh: "徐锐" }, role: { en: "Manager · Enterprise Technology & Performance", zh: "经理 · 企业技术与绩效" }, floor: 10, tx: 20, ty: 3, color: 0x3b6e9a, kind: "task", taskId: "track-tech", trackId: "tech" },
  { id: "tnt-flavor", name: { en: "Wen", zh: "小文" }, role: { en: "Analyst · Consumer Industry", zh: "分析师 · 消费品行业" }, floor: 10, tx: 12, ty: 11, color: 0x999944, kind: "flavor",
    lines: [
      { en: "Third all-nighter this week. The deck is 214 slides and the client wants 'something punchier'.", zh: "这周第三个通宵了。PPT已经214页，客户还想要「更有冲击力一点的」。" },
      { en: "Pick whichever track you like — there's no set order. That's the one nice thing about this place.", zh: "想走哪条线就走哪条——没有固定顺序。这地方唯一的好处就是这个。" },
    ] },

  { id: "cleaner", name: { en: "Auntie Mei", zh: "梅姨" }, role: { en: "Cleaning Service", zh: "保洁" }, floor: 10, tx: 20, ty: 9, color: 0x9a5a7b, kind: "flavor",
    lines: [
      { en: "Mind your feet — just mopped there. You consultants never look down.", zh: "看着点脚下——刚拖过。你们这些顾问从来不看地。" },
      { en: "I clean this floor every night. The things I could tell you about who works late…", zh: "这层我每天晚上都打扫。谁老加班，我可有的说……" },
      { en: "Aiyah, so many empty coffee cups. Strategy runs on caffeine, hm?", zh: "哎呀，这么多空咖啡杯。战略都是咖啡因撑起来的吧？" },
    ] },

  { id: "gk-strategy", name: { en: "Wu Jianguo", zh: "吴建国" }, role: { en: "Senior Manager · Strategy & Business Design", zh: "高级经理 · 战略与业务设计" }, floor: 10, tx: 4, ty: 3, color: 0x2f4f6f, kind: "task", taskId: "track-strategy", trackId: "strategy" },
  { id: "gk-finance", name: { en: "Priya", zh: "普莉亚" }, role: { en: "Senior Consultant · Finance Transformation", zh: "高级顾问 · 财务转型" }, floor: 10, tx: 8, ty: 3, color: 0x6e3b8a, kind: "task", taskId: "track-finance", trackId: "finance" },
  { id: "gk-ops", name: { en: "Sarah Deng", zh: "邓莎拉" }, role: { en: "Senior Manager · Core Business Operations", zh: "高级经理 · 核心业务运营" }, floor: 10, tx: 24, ty: 3, color: 0x6f2f4f, kind: "task", taskId: "track-ops", trackId: "ops" },
  { id: "gk-hr", name: { en: "Coco Ye", zh: "叶可可" }, role: { en: "Manager · Human Capital", zh: "经理 · 人力资本" }, floor: 10, tx: 28, ty: 3, color: 0x7a5c8a, kind: "task", taskId: "track-hr", trackId: "hr" },
  { id: "sm-ea", name: { en: "Joyce", zh: "乔伊丝" }, role: { en: "Team Assistant · Deloitte", zh: "团队助理 · 德勤" }, floor: 10, tx: 16, ty: 11, color: 0xb08a9a, kind: "flavor",
    lines: [
      { en: "Everyone here bills by the six-minute increment. Make it count.", zh: "这里每个人都是按六分钟一个计费单元收费的。别浪费。" },
      { en: "Pass a manager's check and the matching executive upstairs takes your meeting. Any order you like.", zh: "通过一位经理的考核，楼上对应的那位高管就会见你。顺序随你。" },
    ] },

  // ---- Floor 16: Boardroom ----
  { id: "board-table", name: { en: "Boardroom", zh: "董事会会议室" }, role: { en: "Final pitch", zh: "最终汇报" }, floor: 16, tx: 16, ty: 7, color: 0x333333, kind: "board" },
  { id: "board-ea", name: { en: "Ms. Guan", zh: "关女士" }, role: { en: "Board Secretary", zh: "董事会秘书" }, floor: 16, tx: 5, ty: 10, color: 0x8a7a5a, kind: "flavor",
    lines: [
      { en: "All seven executives, one room, one pitch. Interview them all before you walk in — cold rooms are unforgiving.", zh: "七位高管，一个房间，一次汇报。进场前把他们都访谈一遍——冷场的会议室是不留情面的。" },
      { en: "When you're ready, take your place at the table.", zh: "准备好了，就到桌前就座吧。" },
    ] },
];

// Floor 11: the seven Nike mid-level digital humans, spread across the open
// office (names from the mid-level character cards).
const MID_NAMES: Record<string, BL> = {
  vpfin: { en: "Karen Lin", zh: "林嘉怡" },
  brand: { en: "Su Qing", zh: "苏晴" },
  scops: { en: "Legend Wang", zh: "王立群" },
  digital: { en: "Howard Chen", zh: "陈昊" },
  merch: { en: "Vivian Li", zh: "李蔚然" },
  talent: { en: "Cindy Zhao", zh: "赵欣" },
  stratplan: { en: "Hans Zhou", zh: "周子涵" },
};
// On the shared cubicle grid: upper band ty=3, lower band ty=11.
const midSpots: [number, number][] = [[4, 3], [12, 3], [20, 3], [28, 3], [4, 11], [12, 11], [20, 11]];
/** The lower cubicle band turns to face UP, so the two rows look at each other
 *  across the central aisle instead of both facing the camera. Applied here
 *  rather than on each NPC so hand-authored and generated workers agree, and so
 *  `facing` stays the single source of truth — the walk back to a desk after a
 *  conversation reads it too. */
function faceLowerBandUp() {
  for (const n of NPCS) {
    if (n.ty >= 11 && !n.facing && n.kind !== "persona" && [10, 11, 12].includes(n.floor)) {
      n.facing = "up";
    }
  }
}
MID_PERSONAS.forEach((p: any, i: number) => {
  const [tx, ty] = midSpots[i % midSpots.length];
  NPCS.push({
    id: `mid-${p.id}`,
    name: MID_NAMES[p.id] || { en: p.shortTitle.en, zh: p.shortTitle.zh },
    role: { en: `${p.shortTitle.en} · Nike China`, zh: `${p.shortTitle.zh} · 耐克中国` },
    floor: 11, tx, ty,
    color: parseInt(p.accent.slice(1), 16),
    kind: "midpersona",
    personaId: p.id,
  });
});
// Every desk worker on floors 10-12 now exists, so turn the lower band around.
faceLowerBandUp();

// Floor 15: the seven Nike C-suite personas, each seated INSIDE their sealed
// office (persona order: ceo, cfo, cmo, coo, chro, cto, cpo) — see EXEC layout
// + EXEC_OFFICES. CEO in the big left-center office.
// Must match EXEC_OFFICES seats, in PERSONAS order (ceo,cfo,cmo,coo,chro,cto,cpo).
// Seats must match EXEC_OFFICES below, in PERSONAS order
// (ceo, cfo, cmo, coo, chro, cto, cpo) — otherwise executives stand outside
// their own rooms.
// Seated against the BACK wall of each room, not the middle. Mid-room put the
// executive within talking reach of the doorway tile, so walking in or out
// meant brushing past them. Against the back wall the doorway is clear.
//
// In PERSONAS order (ceo, cfo, cmo, coo, chro, cto, cpo) and MUST stay in step
// with EXEC_OFFICES[].seat, or executives stand outside their own rooms. CEO,
// CFO and CPO occupy the three larger bottom rooms; CHRO and CTO took their
// former places along the top.
const execSpots: [number, number][] = [[10, 13], [18, 13], [22, 2], [28, 2], [10, 2], [16, 2], [26, 13]];
PERSONAS.forEach((p: any, i: number) => {
  const [tx, ty] = execSpots[i % execSpots.length];
  NPCS.push({
    id: `persona-${p.id}`,
    name: PERSONA_NAMES[p.id] || { en: p.shortTitle.en, zh: p.shortTitle.zh },
    role: { en: `${p.shortTitle.en} · Nike China`, zh: `${p.shortTitle.zh} · 耐克中国` },
    floor: 15, tx, ty,
    color: personaColors[p.id] || 0x555555,
    kind: "persona",
    personaId: p.id,
  });
});
NPCS.push({
  // Executive-suite gatekeeper: sits at the front desk beside the lift, facing
  // it, so she greets (and screens) everyone stepping off the elevator.
  id: "exec-ea", name: { en: "Vivian", zh: "薇薇安" }, role: { en: "Front Desk · Executive Suite", zh: "前台 · 高管区" }, floor: 15, tx: 5, ty: 7, color: 0x5a8a7a, kind: "flavor", facing: "left",
  lines: [
    { en: "Each executive only sees analysts vouched for by their Deloitte counterpart downstairs. Calendars here are brutally tight.", zh: "每位高管只见楼下德勤对口经理担保过的分析师。这里的日程紧得不近人情。" },
    { en: "When a meeting slot is spent, it's spent. There's no 'do-over' at this level.", zh: "会面额度用掉就是用掉了。到了这个层级，没有「重来一次」。" },
  ],
});

// Floor 15 executive offices — sealed, frosted private rooms. From the corridor
// you see only frosted glass, the door, and a role label; press E at the door
// to step inside (and again to leave). tx/ty/w/h are tile bounds (walls
// included); door is the X tile; inside/outside are the teleport spots.
// The CEO office (left, center) is the biggest.
export interface ExecOffice {
  execId: string; label: BL; tx: number; ty: number; w: number; h: number;
  door: { tx: number; ty: number }; inside: { tx: number; ty: number }; outside: { tx: number; ty: number };
}
export interface ExecOfficeSeat { tx: number; ty: number }
export const EXEC_OFFICES: (ExecOffice & { seat: ExecOfficeSeat })[] = [
  // Square 5x5 rooms (3x3 interior). Four along the top, three below, all doors
  // opening onto the central corridor.
  { execId: "chro", label: { en: "CHRO", zh: "首席人力官" }, tx: 8, ty: 1, w: 5, h: 5,
    door: { tx: 10, ty: 5 }, inside: { tx: 10, ty: 4 }, outside: { tx: 10, ty: 6 }, seat: { tx: 10, ty: 2 } },
  { execId: "cto",  label: { en: "CTO", zh: "首席技术官" }, tx: 14, ty: 1, w: 5, h: 5,
    door: { tx: 16, ty: 5 }, inside: { tx: 16, ty: 4 }, outside: { tx: 16, ty: 6 }, seat: { tx: 16, ty: 2 } },
  { execId: "cmo",  label: { en: "CMO", zh: "首席营销官" }, tx: 20, ty: 1, w: 5, h: 5,
    door: { tx: 22, ty: 5 }, inside: { tx: 22, ty: 4 }, outside: { tx: 22, ty: 6 }, seat: { tx: 22, ty: 2 } },
  { execId: "coo",  label: { en: "COO", zh: "首席运营官" }, tx: 26, ty: 1, w: 5, h: 5,
    door: { tx: 28, ty: 5 }, inside: { tx: 28, ty: 4 }, outside: { tx: 28, ty: 6 }, seat: { tx: 28, ty: 2 } },
  { execId: "ceo",  label: { en: "CEO", zh: "首席执行官" }, tx: 8, ty: 10, w: 5, h: 5,
    door: { tx: 10, ty: 10 }, inside: { tx: 10, ty: 11 }, outside: { tx: 10, ty: 9 }, seat: { tx: 10, ty: 13 } },
  { execId: "cfo",  label: { en: "CFO", zh: "首席财务官" }, tx: 16, ty: 10, w: 5, h: 5,
    door: { tx: 18, ty: 10 }, inside: { tx: 18, ty: 11 }, outside: { tx: 18, ty: 9 }, seat: { tx: 18, ty: 13 } },
  { execId: "cpo",  label: { en: "CPO", zh: "首席产品官" }, tx: 24, ty: 10, w: 5, h: 5,
    door: { tx: 26, ty: 10 }, inside: { tx: 26, ty: 11 }, outside: { tx: 26, ty: 9 }, seat: { tx: 26, ty: 13 } },
];

export const LAYOUTS: Record<number, string[]> = {
  10: OFFICE, 11: OFFICE, 12: LOBBY, 15: EXEC, 16: BOARDROOM,
};

// Only these props respond to E — everything else is scenery.
export const PROP_LINES: Record<string, BL[]> = {
  k: [
    { en: "The water cooler gurgles conspiratorially. It knows things about this office.", zh: "饮水机咕嘟咕嘟地冒着泡，一副知道很多内幕的样子。" },
    { en: "You drink some water. Hydration: a consultant's true competitive advantage.", zh: "你喝了口水。保持水分：咨询师真正的核心竞争力。" },
  ],
  o: [
    { en: "The copier displays: PC LOAD LETTER. Nobody knows what it means. Nobody ever has.", zh: "复印机显示：PC LOAD LETTER。没人知道这是什么意思。从来没人知道过。" },
    { en: "You press a button. It prints 40 copies of someone's gym membership form.", zh: "你按了个键。它打出了40份不知道谁的健身房会员申请表。" },
  ],
  E: [],
  X: [], // executive office door — handled specially (enter/exit teleport)
  // Filing-room door — permanently locked; it exists to make the floor read
  // like the real building (rooms you can see but never enter).
  F: [
    { en: "The badge reader blinks red. FILING ROOM — RESTRICTED. Your access level doesn't open this door.", zh: "刷卡器亮起红灯。档案室 — 限制进入。你的权限打不开这扇门。" },
    { en: "You peer through the glass: rows of bookshelves and archive boxes. Client files. Definitely not for new analysts.", zh: "你透过玻璃望进去：一排排书架和档案箱。客户档案。绝对不是给新分析师看的。" },
  ],
};

// Players arrive in the central hallway — the band rows either side are the
// cubicle rows, so the corridor is always kept clear.
export function spawnPoint(): { tx: number; ty: number } {
  return { tx: 16, ty: 9 };
}

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
export const BLOCKING = new Set(["#", "d", "p", "t", "E", "r", "k", "o", "W", "D", "n", "N"]);

const LOBBY = [
  "####nnnnnnnnnnnnnnnnn####",
  "#p.....EE......EE......p#",
  "#.......................#",
  "#.......................#",
  "#......rrrrrrrrr........#",
  "#.......................#",
  "#.......................#",
  "#..tt.............tt....#",
  "#..tt.....ccc.....tt....#",
  "#.........ccc...........#",
  "#.........ccc...........#",
  "#..pp.............pp....#",
  "#.......................#",
  "#.......k...............#",
  "#p.....................p#",
  "#########################",
];

const OFFICE = [
  "####nnnnnnnnnnnnnnnnn####",
  "#p.....EE......EE......p#",
  "#.......................#",
  "#..dd..dd....dd..dd.....#",
  "#..dd..dd....dd..dd.....#",
  "#.......................#",
  "#.......................#",
  "#..dd..dd....dd..dd..o..#",
  "#..dd..dd....dd..dd.....#",
  "#.......................#",
  "#.......................#",
  "#...tt........tt........#",
  "#...tt........tt........#",
  "#.......k...............#",
  "#p.....................p#",
  "#########################",
];

// Floor 15 — the executive floor. Seven individual, walled corner offices
// (W = executive wall/glass partition, D = executive desk, g = plush carpet)
// open onto a central corridor. Four along the top, three along the bottom.
const EXEC = [
  "###NNNNNNNNNNNNNNNNNNN###",
  "#p.....EE......EE......p#",
  "#WNNNW.WNNNW.WNNNW.WNNNW#",
  "#WDDDW.WDDDW.WDDDW.WDDDW#",
  "#WgggW.WgggW.WgggW.WgggW#",
  "#.......................#",
  "#.......................#",
  "#.......................#",
  "#.......................#",
  "#.......................#",
  "#.......................#",
  "#...WgggW.WgggW.WgggW...#",
  "#...WDDDW.WDDDW.WDDDW...#",
  "#...WNNNW.WNNNW.WNNNW...#",
  "#p.....................p#",
  "#########################",
];

const BOARDROOM = [
  "###NNNNNNNNNNNNNNNNNNN###",
  "#p.....EE......EE......p#",
  "#.......................#",
  "#.......................#",
  "#.....ttttttttttttt.....#",
  "#.....ttttttttttttt.....#",
  "#.....ttttttttttttt.....#",
  "#.......................#",
  "#.......................#",
  "#.......................#",
  "#.......................#",
  "#..pp...............pp..#",
  "#.......................#",
  "#.......................#",
  "#p.....................p#",
  "#########################",
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
  cpo: { en: "VP Product", zh: "产品副总裁" },
};

export const NPCS: NpcDef[] = [
  // ---- Floor 12: Front desk — Supervisor + flavor ----
  // Deloitte roles follow the real ladder: Analyst → Consultant → Senior
  // Consultant → Manager → Senior Manager, with real offering names.
  { id: "supervisor", name: { en: "Manager Lin", zh: "林经理" }, role: { en: "Manager · Consumer Industry, Deloitte", zh: "经理 · 德勤消费品行业" }, floor: 12, tx: 12, ty: 6, color: 0x2a6e46, kind: "supervisor" },
  { id: "reception", name: { en: "Xiao Mei", zh: "小美" }, role: { en: "Receptionist", zh: "前台" }, floor: 12, tx: 7, ty: 6, color: 0xc06a8a, kind: "flavor",
    lines: [
      { en: "Welcome to Deloitte! Badge, please… oh, you're the new analyst. Manager Lin is waiting for you.", zh: "欢迎来到德勤！请出示工卡……哦，你是新来的分析师吧。林经理正等着你呢。" },
      { en: "The elevators are behind me. Some floors need… seniority.", zh: "电梯在我身后。有些楼层嘛……得有点资历才进得去。" },
      { en: "Coffee machine on 13 is broken again. Don't tell anyone I told you.", zh: "13层的咖啡机又坏了。别说是我告诉你的。" },
    ] },
  { id: "guard", name: { en: "Lao Zhang", zh: "老张" }, role: { en: "Security", zh: "保安" }, floor: 12, tx: 20, ty: 12, color: 0x445566, kind: "flavor",
    lines: [
      { en: "I've guarded this lobby for 15 years. Seen a thousand analysts. You look… adequately terrified.", zh: "我在这个大堂守了15年，见过上千个分析师。你看起来……紧张得恰到好处。" },
      { en: "No, you can't take the executive elevator. Yes, everyone asks.", zh: "不行，高管电梯你不能坐。对，每个人都这么问。" },
    ] },
  { id: "intern-1", name: { en: "Kevin", zh: "凯文" }, role: { en: "Summer Intern · Deloitte", zh: "暑期实习生 · 德勤" }, floor: 12, tx: 4, ty: 9, color: 0x8a8a3b, kind: "flavor",
    lines: [
      { en: "I heard the Nike executives on 15 only talk to people vouched for by the engagement team.", zh: "听说15层的耐克高管只见项目组担保过的人。" },
      { en: "Rumor is the CFO can smell an unprepared question from across the room.", zh: "传言说CFO隔着整个房间都能闻出一个没准备好的问题。" },
      { en: "I've been fetching coffee for three months. Living the dream.", zh: "我端了三个月咖啡了。梦想成真，就是这个味儿。" },
    ] },

  // ---- Floor 10: IT ----
  { id: "it-guy", name: { en: "Ah Qiang", zh: "阿强" }, role: { en: "IT Support · Deloitte Technology", zh: "IT支持 · 德勤科技" }, floor: 10, tx: 5, ty: 5, color: 0x3b5c8a, kind: "flavor",
    lines: [
      { en: "Have you tried turning it off and on again?", zh: "你试过重启吗？" },
      { en: "Someone upstairs asked me to 'install more RAM into the strategy'. I need a vacation.", zh: "楼上有人让我「给战略加根内存条」。我需要休假。" },
      { en: "The Wi-Fi password is on the sticky note. The one that says 'do not share'.", zh: "Wi-Fi密码在便利贴上。就是写着「严禁外传」的那张。" },
    ] },
  { id: "it-aunty", name: { en: "Aunty Hong", zh: "红姨" }, role: { en: "Office Aunty", zh: "办公室阿姨" }, floor: 10, tx: 18, ty: 10, color: 0xa05a3b, kind: "flavor",
    lines: [
      { en: "Aiyah, you look thin! Take a mooncake from the pantry.", zh: "哎呀，你怎么这么瘦！去茶水间拿块月饼吃。" },
      { en: "In my day, consultants wrote strategies on PAPER. Uphill. Both ways.", zh: "我们那个年代，咨询师都是用纸写战略的。还得爬楼送稿，来回都是上坡。" },
    ] },

  // ---- Floor 11: Nike China middle management (VP / Sr Director / Sr Mgr / Mgr) ----
  // One mid-level digital human per C-suite line — unlocked together with
  // their boss's track. Untimed, unlimited conversations: this is where the
  // frontline detail lives (real projects interview far more middle managers
  // than executives). Dave stays; he just has more company now.
  { id: "lost-consultant", name: { en: "Dave", zh: "戴夫" }, role: { en: "Senior Consultant · (hiding)", zh: "高级顾问 ·（躲清静中）" }, floor: 11, tx: 12, ty: 13, color: 0x777777, kind: "flavor",
    lines: [
      { en: "This used to be the quiet floor. Then Nike's middle managers moved in. Now everyone wants 'a quick sync'.", zh: "这层以前是清静楼层。后来耐克的中层管理团队搬了进来。现在人人都想「快速对齐一下」。" },
      { en: "Pro tip: the middle managers have unlimited time and the real numbers. The executives upstairs have neither.", zh: "小建议：中层经理们有的是时间，还有真实数据。楼上的高管俩样都没有。" },
      { en: "Shhh. If they can't find you, they can't staff you.", zh: "嘘。他们找不到你，就没法把你派到项目上。" },
    ] },

  // ---- Floor 13: gatekeepers — Product, Marketing, Tech ----
  { id: "gk-product", name: { en: "Chen Jing", zh: "陈静" }, role: { en: "Consultant · Consumer Products", zh: "顾问 · 消费品行业" }, floor: 13, tx: 5, ty: 6, color: 0x3b8a6e, kind: "task", taskId: "track-product", trackId: "product" },
  { id: "gk-marketing", name: { en: "Marcus", zh: "马克" }, role: { en: "Manager · Customer & Marketing", zh: "经理 · 客户与营销" }, floor: 13, tx: 14, ty: 6, color: 0x8a5c3b, kind: "task", taskId: "track-marketing", trackId: "marketing" },
  { id: "gk-tech", name: { en: "Ryan Xu", zh: "徐锐" }, role: { en: "Manager · Enterprise Technology & Performance", zh: "经理 · 企业技术与绩效" }, floor: 13, tx: 18, ty: 12, color: 0x3b6e9a, kind: "task", taskId: "track-tech", trackId: "tech" },
  { id: "tnt-flavor", name: { en: "Wen", zh: "小文" }, role: { en: "Analyst · Consumer Industry", zh: "分析师 · 消费品行业" }, floor: 13, tx: 20, ty: 9, color: 0x999944, kind: "flavor",
    lines: [
      { en: "Third all-nighter this week. The deck is 214 slides and the client wants 'something punchier'.", zh: "这周第三个通宵了。PPT已经214页，客户还想要「更有冲击力一点的」。" },
      { en: "Pick whichever track you like — there's no set order. That's the one nice thing about this place.", zh: "想走哪条线就走哪条——没有固定顺序。这地方唯一的好处就是这个。" },
    ] },

  { id: "cleaner", name: { en: "Auntie Mei", zh: "梅姨" }, role: { en: "Cleaning Service", zh: "保洁" }, floor: 13, tx: 3, ty: 6, color: 0x9a5a7b, kind: "flavor",
    lines: [
      { en: "Mind your feet — just mopped there. You consultants never look down.", zh: "看着点脚下——刚拖过。你们这些顾问从来不看地。" },
      { en: "I clean this floor every night. The things I could tell you about who works late…", zh: "这层我每天晚上都打扫。谁老加班，我可有的说……" },
      { en: "Aiyah, so many empty coffee cups. Strategy runs on caffeine, hm?", zh: "哎呀，这么多空咖啡杯。战略都是咖啡因撑起来的吧？" },
    ] },

  // ---- Floor 14: gatekeepers — Strategy, Finance, Ops, HR ----
  { id: "gk-strategy", name: { en: "Wu Jianguo", zh: "吴建国" }, role: { en: "Senior Manager · Strategy & Business Design", zh: "高级经理 · 战略与业务设计" }, floor: 14, tx: 6, ty: 6, color: 0x2f4f6f, kind: "task", taskId: "track-strategy", trackId: "strategy" },
  { id: "gk-finance", name: { en: "Priya", zh: "普莉亚" }, role: { en: "Senior Consultant · Finance Transformation", zh: "高级顾问 · 财务转型" }, floor: 14, tx: 16, ty: 6, color: 0x6e3b8a, kind: "task", taskId: "track-finance", trackId: "finance" },
  { id: "gk-ops", name: { en: "Sarah Deng", zh: "邓莎拉" }, role: { en: "Senior Manager · Core Business Operations", zh: "高级经理 · 核心业务运营" }, floor: 14, tx: 6, ty: 10, color: 0x6f2f4f, kind: "task", taskId: "track-ops", trackId: "ops" },
  { id: "gk-hr", name: { en: "Coco Ye", zh: "叶可可" }, role: { en: "Manager · Human Capital", zh: "经理 · 人力资本" }, floor: 14, tx: 16, ty: 10, color: 0x7a5c8a, kind: "task", taskId: "track-hr", trackId: "hr" },
  { id: "sm-ea", name: { en: "Joyce", zh: "乔伊丝" }, role: { en: "Team Assistant · Deloitte", zh: "团队助理 · 德勤" }, floor: 14, tx: 11, ty: 11, color: 0xb08a9a, kind: "flavor",
    lines: [
      { en: "Everyone here bills by the six-minute increment. Make it count.", zh: "这里每个人都是按六分钟一个计费单元收费的。别浪费。" },
      { en: "Pass a manager's check and the matching executive upstairs takes your meeting. Any order you like.", zh: "通过一位经理的考核，楼上对应的那位高管就会见你。顺序随你。" },
    ] },

  // ---- Floor 16: Boardroom ----
  { id: "board-table", name: { en: "Boardroom", zh: "董事会会议室" }, role: { en: "Final pitch", zh: "最终汇报" }, floor: 16, tx: 12, ty: 7, color: 0x333333, kind: "board" },
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
const midSpots: [number, number][] = [[3, 5], [8, 5], [13, 5], [18, 5], [5, 9], [11, 9], [17, 9]];
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

// Floor 15: the seven Nike C-suite personas, each standing in the front of
// their own office (persona order: ceo, cfo, cmo, coo, chro, cto, cpo).
// Four top offices (ty=4), three bottom offices (ty=11) — see the EXEC layout.
const execSpots: [number, number][] = [[3, 4], [9, 4], [15, 4], [21, 4], [6, 11], [12, 11], [18, 11]];
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
  id: "exec-ea", name: { en: "Vivian", zh: "薇薇安" }, role: { en: "Front Desk · Executive Suite", zh: "前台 · 高管区" }, floor: 15, tx: 12, ty: 6, color: 0x5a8a7a, kind: "flavor",
  lines: [
    { en: "Each executive only sees analysts vouched for by their Deloitte counterpart downstairs. Calendars here are brutally tight.", zh: "每位高管只见楼下德勤对口经理担保过的分析师。这里的日程紧得不近人情。" },
    { en: "When a meeting slot is spent, it's spent. There's no 'do-over' at this level.", zh: "会面额度用掉就是用掉了。到了这个层级，没有「重来一次」。" },
  ],
});

export const LAYOUTS: Record<number, string[]> = {
  10: OFFICE, 11: OFFICE, 12: LOBBY, 13: OFFICE, 14: OFFICE, 15: EXEC, 16: BOARDROOM,
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
};

export function spawnPoint(): { tx: number; ty: number } {
  return { tx: 12, ty: 10 };
}

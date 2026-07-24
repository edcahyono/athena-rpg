/**
 * GAME TUNABLES — single place to adjust balance after playtesting.
 *
 * ⚠ PLACEHOLDER VALUES — per-check credibility, interaction counts and timers
 * have NOT been confirmed by the program owner. Tune freely.
 *
 * MISSION MODEL: no fixed order. Floors 13-15 open after onboarding; each
 * Nike executive unlocks by passing their Deloitte gatekeeper's check
 * (see shared/gameContent.js TRACKS); the boardroom (16) opens once all
 * seven executives have been interviewed at least once.
 */

export const GAME_CONFIG = {
  // C-suite interview limits (PLACEHOLDERS)
  csuite: {
    maxInteractions: 3, // interview sessions per persona, per playthrough
    timePerInteractionSeconds: 480, // 8 minutes per session
  },

  // Final board meeting (PLACEHOLDER)
  boardMeeting: {
    timeSeconds: 900, // 15 minutes
  },

  // Floors in scope for this build. Mirrors the real building — it has only
  // 10, 11, 12, 15, 16 (no 13/14). The seven Deloitte gatekeepers all sit
  // together on the Floor 10 engagement floor.
  floors: [10, 11, 12, 15, 16],
  startFloor: 12, // front desk / reception — the player's first day starts here

  floorInfo: {
    10: { name: { en: "Assurance & Advisory — Engagement Team", zh: "鉴证与咨询 — 项目组" }, tier: "open" },
    11: { name: { en: "Nike China — Middle Management", zh: "耐克中国 — 中层管理" }, tier: "open" },
    12: { name: { en: "Front Desk & Reception", zh: "前台与接待" }, tier: "open" },
    15: { name: { en: "Nike Greater China — Executive Floor", zh: "耐克大中华区 — 高管楼层" }, tier: "open" },
    16: { name: { en: "Boardroom", zh: "董事会会议室" }, tier: "board" }, // needs all 7 execs interviewed
  },
};

/** Floor lock check. `interviewedCount` = executives met at least once. */
export function unlockedFloor(floor, interviewedCount) {
  const info = GAME_CONFIG.floorInfo[floor];
  if (!info) return false;
  if (info.tier === "board") return interviewedCount >= 7;
  return true;
}

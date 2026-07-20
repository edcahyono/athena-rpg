/** API client + client-side session state mirror. Server is authoritative. */
import { lang } from "../i18n";

function uuid() {
  return "xxxxxxxxyxxx".replace(/[xy]/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  ) + Date.now().toString(36);
}

export const sessionId: string = (() => {
  let id = localStorage.getItem("athena-rpg-session");
  if (!id) {
    id = uuid();
    localStorage.setItem("athena-rpg-session", id);
  }
  return id;
})();

import type { CharOpts } from "../game/charDraw";
export type Profile = CharOpts;

export interface GameState {
  id: string;
  updatedAt: number;
  credibility: number;
  flags: { metSupervisor: boolean; interimDone: boolean; boardDone: boolean; debriefDone: boolean };
  tasks: Record<string, { status: string; delta: number; feedback?: string }>;
  personas: Record<string, { used: number; warmth: number; active: { expiresAt: number } | null }>;
  gatekeepers: Record<string, { hasTalked: boolean }>;
  board: { done: boolean; active: { expiresAt: number } | null };
  questLog: { t: number; type: string; title: string; body: string }[];
  notes: string;
  selectedMission: string | null;
  profile: Profile | null;
  client: { floor: number; x: number; y: number };
  config: {
    csuite: { maxInteractions: number; timePerInteractionSeconds: number };
    boardMeeting: { timeSeconds: number };
  };
}

export let state: GameState;

async function post(path: string, body: object = {}): Promise<any> {
  const res = await fetch(`/api/game/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, language: lang, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  if (data.credibility !== undefined) state = data; // any full-state payload refreshes the mirror
  return data;
}

export const api = {
  async init(): Promise<GameState> {
    state = await post("session");
    return state;
  },
  reset: () => post("reset"),
  save(client: { floor: number; x: number; y: number }, notes?: string, profile?: Profile) {
    return post("save", { client, notes, profile }).catch(() => {});
  },
  event: (type: string, extra: object = {}) => post("event", { type, ...extra }),
  selectMission: (trackId: string | null) => post("event", { type: "selectMission", trackId }),
  dialogueCheck: (taskId: string, choice: number) => post("dialogue-check", { taskId, choice }),
  gatekeeperChat: (trackId: string, text: string) => post("gatekeeper/chat", { trackId, text }),
  gatekeeperQuiz: (trackId: string) => post("gatekeeper/quiz", { trackId }),
  gatekeeperGrade: (trackId: string, answers: string[]) => post("gatekeeper/grade", { trackId, answers }),
  startInteraction: (personaId: string) => post("interaction/start", { personaId }),
  chat: (personaId: string, text: string) => post("chat", { personaId, text }),
  endInteraction: (personaId: string) => post("interaction/end", { personaId }),
  boardStart: () => post("board/start"),
  boardChat: (text: string) => post("board/chat", { text }),
  boardReviewDeck: (text: string) => post("board/review-deck", { text }),
  boardEnd: () => post("board/end"),
  interim: (answer: string) => post("interim", { answer }),
  reviewWork: (reviewerId: string, filename: string, text: string) => post("review-work", { reviewerId, filename, text }),
  extractText: (filename: string, fileBase64: string) => post("extract-text", { filename, fileBase64 }),
  debrief: () => post("debrief"),
};

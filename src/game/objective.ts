/**
 * Mission guidance — the player picks a track on the mission board (menu);
 * this derives the next concrete step of THAT track: gatekeeper briefing →
 * check → executive interview. With no active mission it points at the board
 * itself. Drives the HUD banner + in-world guide arrow.
 */
import { NPCS, NpcDef } from "../config/world";
import { TRACKS } from "../../shared/gameContent.js";
import { GameState } from "../net/api";
import { L, fmt, UI } from "../i18n";

export interface Objective {
  npcId: string | null; // target NPC (arrow points here); null = no target
  floor: number | null;
  label: string;
  why: string;
}

const npcById = (id: string): NpcDef | undefined => NPCS.find((n) => n.id === id);

export function computeObjective(state: GameState | undefined): Objective {
  if (!state) return { npcId: null, floor: null, label: "…", why: "" };

  if (!state.flags.metSupervisor) {
    return { npcId: "supervisor", floor: 12, label: L(UI.reportToLin), why: L(UI.reportToLinWhy) };
  }

  if (state.board.done) {
    if (!state.flags.debriefDone) {
      return { npcId: "supervisor", floor: 12, label: L(UI.debriefLin), why: L(UI.debriefLinWhy) };
    }
    return { npcId: null, floor: null, label: L(UI.engagementDone), why: L(UI.engagementDoneWhy) };
  }

  const interviewed = Object.values(state.personas).filter((p) => p.used > 0).length;

  // All seven done: the interim readout is the hard prerequisite for the
  // board, so it takes priority only here — otherwise it must not shadow
  // an unlocked executive the player could go see right now.
  if (interviewed >= 7) {
    if (!state.flags.interimDone) {
      return { npcId: "supervisor", floor: 12, label: L(UI.interimObjective), why: fmt(UI.interimObjectiveWhy, { n: interviewed }) };
    }
    return { npcId: "board-table", floor: 16, label: L(UI.boardObjective), why: L(UI.boardObjectiveWhy) };
  }

  // Active mission → next step on that track.
  const track = state.selectedMission ? (TRACKS as any)[state.selectedMission] : null;
  if (track) {
    const gk = npcById(track.npcId)!;
    const exec = npcById(`persona-${track.personaId}`)!;
    const t = state.tasks[track.taskId];
    const passed = t && (t.status === "passed");
    if (!passed) {
      return {
        npcId: gk.id, floor: gk.floor,
        label: fmt(UI.seeGatekeeper, { name: L(gk.name), floor: gk.floor }),
        why: fmt(UI.gatekeeperWhy, { name: L(gk.name), track: L(track.name), exec: L(exec.name) }),
      };
    }
    if (state.personas[track.personaId]?.used === 0) {
      return {
        npcId: exec.id, floor: 15,
        label: fmt(UI.interviewExec, { name: L(exec.name) }),
        why: L(UI.interviewExecWhy),
      };
    }
    // track fully done → fall through to the between-missions guidance
  }

  // Between missions: nudge toward the interim readout once 3+ interviews are
  // in (it unlocks the board later), otherwise pick the next track.
  if (!state.flags.interimDone && interviewed >= 3) {
    return { npcId: "supervisor", floor: 12, label: L(UI.interimObjective), why: fmt(UI.interimObjectiveWhy, { n: interviewed }) };
  }
  return { npcId: null, floor: null, label: L(UI.pickMission), why: L(UI.pickMissionWhy) };
}

/**
 * Mission guidance — the player picks a track on the mission board (menu);
 * this derives the next concrete step of THAT track: gatekeeper briefing →
 * check → executive interview. With no active mission it points at the board
 * itself. Drives the HUD banner + in-world guide arrow.
 */
import { NPCS, NpcDef, DESIGN_REVIEW_FLOOR } from "../config/world";
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

/**
 * Is the Design Review convened right now?
 *
 * The single source of truth for it, because four things have to agree: the
 * waypoint, the F12 door collider, whether the seven managers are at their
 * desks or around the table, and whether the table accepts a draft. Deriving it
 * separately in each place is how you get a room full of managers behind a
 * locked door, or an arrow pointing at an empty table.
 *
 * All seven interviews are part of the condition, not just the as-is sign-off:
 * the team reviews a strategy built on the whole diagnosis, and the server
 * refuses the submission otherwise.
 */
export function designReviewDue(state: GameState | undefined): boolean {
  if (!state) return false;
  const interviewed = Object.values(state.personas).filter((p) => p.used > 0).length;
  return !!state.engagement?.alignments?.asis?.agreed
    && !state.engagement?.designReview?.done
    && interviewed >= 7;
}

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
  const checksPassed = Object.values(TRACKS)
    .filter((t: any) => state.tasks[t.taskId]?.status === "passed").length;

  // All seven domain checks are in, but the C-suite still won't take a
  // meeting — Manager Lin has to debrief the diagnostic first (server-enforced
  // in requireTrackPassed()). This sits above the As-Is branch below because
  // that debrief is the gate on F15 itself, not on the diagnosis document.
  if (checksPassed >= 7 && !state.flags.execBriefingDone) {
    return { npcId: "supervisor", floor: 12, label: L(UI.execBriefingObjective), why: L(UI.execBriefingObjectiveWhy) };
  }

  // As-Is alignment. Once every domain check is behind you the diagnosis is the
  // next thing owed, and it is owed to Manager Lin — not to another executive.
  // There was no branch for this at all: a player who passed all seven checks
  // fell through every case below and the guidance stopped pointing anywhere,
  // which is the "nothing happens" wall. It sits above the interview-driven
  // branches because the gate is the diagnosis, not a meeting count.
  if (checksPassed >= 7 && !state.engagement?.alignments?.asis?.agreed) {
    return { npcId: "supervisor", floor: 12, label: L(UI.asisObjective), why: L(UI.asisObjectiveWhy) };
  }

  // Design Review — the phase that replaced Benchmark Alignment. It is held by
  // the seven Deloitte managers, NOT by Lin. It used to point at whichever
  // gatekeeper happened to be declared first on F10, which meant knocking on an
  // arbitrary desk to convene a meeting of seven people. The team now sits in
  // the room on F12, so the arrow points at the table they are sitting around.
  if (designReviewDue(state)) {
    return {
      npcId: "design-table", floor: DESIGN_REVIEW_FLOOR,
      label: L(UI.designObjective), why: L(UI.designObjectiveWhy),
    };
  }

  // All seven done: the interim readout is the hard prerequisite for the
  // board, so it takes priority only here — otherwise it must not shadow
  // an unlocked executive the player could go see right now.
  if (interviewed >= 7) {
    if (!state.flags.workDocDone) {
      return { npcId: "supervisor", floor: 12, label: L(UI.workDocObjective), why: L(UI.workDocObjectiveWhy) };
    }
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
    // This track's check is passed, but no executive opens their door until
    // EVERY domain check has (see requireTrackPassed() server-side), so there
    // is nothing further to do on THIS track right now.
    //
    // Deliberately does NOT auto-advance to the next unpassed track. The order
    // of TRACKS is a declaration order, not a curriculum: taking the next one
    // off it told the player "now go see Priya" purely because finance happens
    // to be declared second, which reads as a required sequence in a phase
    // whose whole point is that the order is yours. Hand the choice back to
    // the mission board instead.
    const totalTracks = Object.keys(TRACKS).length;
    if (checksPassed < totalTracks) {
      return { npcId: null, floor: null, label: L(UI.pickMission), why: fmt(UI.pickNextMissionWhy, { done: checksPassed, total: totalTracks }) };
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
  // The working-document review comes before the interim readout: Lin asks for
  // it first, and it's read as your synthesis when the alignments are graded.
  if (!state.flags.workDocDone && interviewed >= 3) {
    return { npcId: "supervisor", floor: 12, label: L(UI.workDocObjective), why: L(UI.workDocObjectiveWhy) };
  }
  if (!state.flags.interimDone && interviewed >= 3) {
    return { npcId: "supervisor", floor: 12, label: L(UI.interimObjective), why: fmt(UI.interimObjectiveWhy, { n: interviewed }) };
  }
  return { npcId: null, floor: null, label: L(UI.pickMission), why: L(UI.pickMissionWhy) };
}

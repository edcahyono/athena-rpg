/** Character profile — appearance only, persisted locally and echoed to the
 *  server session (cosmetic; server never trusts it for progress). */
import { CharOpts, DEFAULT_PLAYER } from "./charDraw";

export type PlayerProfile = CharOpts;

const KEY = "athena-profile";

export function loadProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PLAYER, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: PlayerProfile) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export const hasProfile = () => !!localStorage.getItem(KEY);

export function clearProfile() {
  localStorage.removeItem(KEY);
}

import Phaser from "phaser";
import BootScene from "./scenes/BootScene";
import IntroScene from "./scenes/IntroScene";
import OfficeScene from "./scenes/OfficeScene";
import { api, state } from "./net/api";
import { toast, setQuitHandler } from "./ui/ui";
import { chooseLanguage, characterCreator, mainMenu } from "./ui/startScreen";
import { fmt, UI } from "./i18n";

/* ---- fit the fixed 800px game column to the viewport (fullscreen-friendly) ---- */

const BASE_W = 816, BASE_H = 650;

function fitScale() {
  const root = document.getElementById("game-root")!;
  const s = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H, 2);
  root.style.transform = `scale(${Math.max(0.5, s)})`;
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}

window.addEventListener("resize", fitScale);
document.addEventListener("fullscreenchange", fitScale);

/* --------------------------------- boot --------------------------------- */

// "Quit to menu" reloads into the main-menu landing (never replays the intro).
setQuitHandler(() => {
  sessionStorage.setItem("athena-to-menu", "1");
  location.reload();
});

async function start() {
  fitScale();
  await chooseLanguage(); // EN / 中文 — first-run only
  const profile = await characterCreator(); // appearance — first-run only

  try {
    await api.init(); // create/resume server-side session before the game boots
    api.save(state.client, undefined, profile); // echo profile to the session (cosmetic)
  } catch (err: any) {
    document.getElementById("hud-floor")!.textContent = "⚠ server offline";
    toast(fmt(UI.serverOffline, { e: err.message }));
  }

  // Title / main-menu landing for returning players (progress made or seen the
  // intro), and always after a "quit to menu". Fresh players skip straight to
  // the opening cutscene.
  const quitting = sessionStorage.getItem("athena-to-menu") === "1";
  sessionStorage.removeItem("athena-to-menu");
  // In-game language switch reloads for fresh Phaser labels — skip the title
  // screen and drop the player straight back into the office.
  const skipMenu = sessionStorage.getItem("athena-skip-menu") === "1";
  sessionStorage.removeItem("athena-skip-menu");
  const returning = !!state?.flags?.metSupervisor || !!localStorage.getItem("athena-seen-intro");
  if (!skipMenu && (quitting || returning)) {
    await mainMenu(returning);
  }

  (window as any).__game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "phaser",
    width: 800,
    height: 512,
    pixelArt: true,
    backgroundColor: "#181820",
    physics: { default: "arcade", arcade: { debug: false } },
    scene: [BootScene, IntroScene, OfficeScene],
  });
}

start();

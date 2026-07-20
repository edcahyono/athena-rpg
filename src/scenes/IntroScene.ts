/**
 * IntroScene — animated pixel cutscene: how you got into Deloitte.
 * Four colorful vignettes (2 a.m. application → interviews → the offer →
 * day one), each with light animation. Click / E advances; caption text
 * renders in the retro band at the bottom (DOM #cutscene).
 */
import Phaser from "phaser";
import { L, UI } from "../i18n";

const W = 800, H = 512;

export default class IntroScene extends Phaser.Scene {
  private sceneIndex = 0;
  private advancing = false;

  constructor() {
    super("intro");
  }

  create() {
    const band = document.getElementById("cutscene")!;
    band.hidden = false;
    (band.querySelector(".cs-hint") as HTMLElement).textContent = L(UI.csHint);

    this.sceneIndex = 0;
    this.showVignette(0);

    const next = () => {
      if (this.advancing) return;
      this.advancing = true;
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.sceneIndex++;
        if (this.sceneIndex > 3) {
          band.hidden = true;
          localStorage.setItem("athena-seen-intro", "1"); // never replay the vignettes
          this.scene.start("office");
          return;
        }
        this.showVignette(this.sceneIndex);
        this.cameras.main.fadeIn(220, 0, 0, 0);
        this.advancing = false;
      });
    };
    this.input.on("pointerdown", next);
    band.onclick = next;
    this.input.keyboard!.on("keydown-E", next);
    this.input.keyboard!.on("keydown-SPACE", next);
    this.input.keyboard!.on("keydown-ENTER", next);
  }

  /** Pixelated "Deloitte." wordmark: drawn once at tiny size on a canvas so
   *  the letterforms alias into chunky pixels, then displayed scaled up with
   *  nearest-neighbor filtering (pixelArt mode). White text, signature green
   *  period — matching real Deloitte building signage. */
  private deloitteWordmark(): string {
    const key = "deloitte-wordmark";
    if (this.textures.exists(key)) return key;
    const c = document.createElement("canvas");
    c.width = 46; c.height = 9;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f4f4f2";
    ctx.font = "bold 8px Helvetica, Arial, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Deloitte", 1, 7);
    const w = Math.round(ctx.measureText("Deloitte").width);
    ctx.fillStyle = "#86bc25"; // Deloitte green
    ctx.fillRect(Math.min(c.width - 3, w + 2), 5, 2, 2); // the period
    this.textures.addCanvas(key, c);
    return key;
  }

  private caption(key: keyof typeof UI) {
    document.getElementById("cutscene-text")!.textContent = L(UI[key] as any);
  }

  private clearAll() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll();
  }

  private g() {
    return this.add.graphics();
  }

  private showVignette(i: number) {
    this.clearAll();
    if (i === 0) this.vNight();
    if (i === 1) this.vInterview();
    if (i === 2) this.vOffer();
    if (i === 3) this.vDayOne();
  }

  /* -- 1: 2 a.m., the application ---------------------------------------- */
  private vNight() {
    this.caption("cs1");
    const g = this.g();
    g.fillStyle(0x101a33); g.fillRect(0, 0, W, H); // night
    g.fillStyle(0x1a2947); g.fillRect(0, H - 140, W, 140); // floor
    // stars
    for (let s = 0; s < 60; s++) {
      const star = this.add.rectangle(Math.random() * W, Math.random() * (H - 200), 2, 2, 0xd9e6ff).setAlpha(0.4 + Math.random() * 0.6);
      this.tweens.add({ targets: star, alpha: 0.15, duration: 700 + Math.random() * 1500, yoyo: true, repeat: -1 });
    }
    // moon
    const moon = this.g();
    moon.fillStyle(0xf5edc8); moon.fillCircle(660, 90, 38);
    moon.fillStyle(0x101a33); moon.fillCircle(676, 80, 30);
    // window frame
    const win = this.g();
    win.lineStyle(6, 0x2c3a5c); win.strokeRect(520, 40, 220, 160);
    win.lineBetween(630, 40, 630, 200); win.lineBetween(520, 120, 740, 120);
    // desk + laptop
    const desk = this.g();
    desk.fillStyle(0x4a3423); desk.fillRect(240, 330, 320, 22);
    desk.fillStyle(0x33251a); desk.fillRect(255, 352, 18, 60); desk.fillRect(527, 352, 18, 60);
    desk.fillStyle(0x2c313d); desk.fillRect(360, 296, 90, 36); // laptop base+screen
    const screen = this.add.rectangle(405, 312, 78, 26, 0x9fd8ef);
    this.tweens.add({ targets: screen, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 }); // screen glow flicker
    // glow pool on desk
    const glow = this.add.ellipse(405, 335, 180, 30, 0x9fd8ef, 0.18);
    this.tweens.add({ targets: glow, alpha: 0.08, duration: 900, yoyo: true, repeat: -1 });
    // you, at the desk
    const you = this.add.sprite(405, 372, "player-up-0").setScale(2);
    this.tweens.add({ targets: you, y: 370, duration: 1200, yoyo: true, repeat: -1, ease: "sine.inOut" }); // breathing
    // "send" ping flying off the laptop
    this.time.addEvent({
      delay: 1800, loop: true, callback: () => {
        const dot = this.add.rectangle(405, 300, 6, 6, 0x7ee787);
        this.tweens.add({ targets: dot, y: 60, x: 620, alpha: 0, duration: 1300, ease: "cubic.out", onComplete: () => dot.destroy() });
      },
    });
  }

  /* -- 2: the interviews -------------------------------------------------- */
  private vInterview() {
    this.caption("cs2");
    const g = this.g();
    g.fillStyle(0xe8dcc2); g.fillRect(0, 0, W, H); // room
    g.fillStyle(0x8fa8b8); g.fillRect(0, 0, W, 150); // wall band
    g.fillStyle(0x6b8494); g.fillRect(0, 144, W, 6);
    // deloitte-ish plaque
    g.fillStyle(0x2a6e46); g.fillRect(330, 50, 140, 56);
    g.fillStyle(0x7ee787); g.fillRect(348, 74, 104, 10);
    // table
    g.fillStyle(0x9a6b40); g.fillRect(280, 300, 240, 26);
    g.fillStyle(0x7a5230); g.fillRect(290, 326, 16, 70); g.fillRect(494, 326, 16, 70);
    g.fillStyle(0xf4f0e4); g.fillRect(380, 288, 40, 14); // papers on table
    // interviewer (left) & you (right)
    const interviewer = this.add.sprite(300, 260, `char-${0x2a6e46}-right-0`).setScale(2); // Manager Lin's palette
    const you = this.add.sprite(505, 268, "player-left-0").setScale(2);
    // interviewer "talks" — bobbing + speech pips
    this.tweens.add({ targets: interviewer, y: 257, duration: 500, yoyo: true, repeat: -1, ease: "sine.inOut" });
    this.time.addEvent({
      delay: 1100, loop: true, callback: () => {
        const q = this.add.text(340, 210, "?", { fontFamily: "Courier New", fontSize: "24px", color: "#20242e", fontStyle: "bold" });
        this.tweens.add({ targets: q, y: 180, alpha: 0, duration: 1000, onComplete: () => q.destroy() });
      },
    });
    // you nod (tiny frame swap)
    this.time.addEvent({
      delay: 700, loop: true, callback: () => {
        you.setTexture(you.texture.key.endsWith("-0") ? "player-left-1" : "player-left-0");
      },
    });
    // round counter cards flipping: 一面 二面 三面 / R1 R2 R3
    const rounds = ["R1", "R2", "R3"];
    rounds.forEach((r, i) => {
      const card = this.add.rectangle(120 + i * 70, 420, 56, 40, 0xf4f0e4).setStrokeStyle(3, 0x20242e).setAlpha(0);
      const label = this.add.text(120 + i * 70, 420, r, { fontFamily: "Courier New", fontSize: "16px", color: "#20242e", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: [card, label], alpha: 1, delay: 500 + i * 800, duration: 350 });
    });
  }

  /* -- 3: the offer -------------------------------------------------------- */
  private vOffer() {
    this.caption("cs3");
    const g = this.g();
    g.fillStyle(0x1e4a34); g.fillRect(0, 0, W, H);
    g.fillStyle(0x24593c); g.fillRect(0, H - 120, W, 120);
    // radiating rays
    const rays = this.g();
    rays.fillStyle(0x2a6e46, 0.5);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rays.slice(400, 230, 520, a, a + 0.13);
      rays.fillPath();
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });
    rays.setPosition(0, 0);
    // the offer letter
    const letter = this.add.container(400, 240);
    const paper = this.add.rectangle(0, 0, 260, 180, 0xf8f4e8).setStrokeStyle(4, 0x20242e);
    const head = this.add.rectangle(0, -62, 260, 40, 0x2a6e46);
    const t1 = this.add.rectangle(-40, -20, 150, 8, 0xb8b0a0);
    const t2 = this.add.rectangle(-20, 2, 190, 8, 0xb8b0a0);
    const t3 = this.add.rectangle(-55, 24, 120, 8, 0xb8b0a0);
    const offerTxt = this.add.text(0, -62, "OFFER", { fontFamily: "Courier New", fontSize: "20px", color: "#f8f4e8", fontStyle: "bold" }).setOrigin(0.5);
    const seal = this.add.circle(85, 52, 26, 0x2a6e46).setStrokeStyle(3, 0x1a3626);
    const check = this.add.text(85, 52, "✓", { fontFamily: "Courier New", fontSize: "28px", color: "#7ee787", fontStyle: "bold" }).setOrigin(0.5);
    letter.add([paper, head, t1, t2, t3, offerTxt, seal, check]);
    letter.setScale(0);
    this.tweens.add({ targets: letter, scale: 1, duration: 500, ease: "back.out" });
    this.tweens.add({ targets: letter, y: 232, duration: 1400, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 500 });
    // confetti
    const colors = [0x7ee787, 0xffd75e, 0xff9d5e, 0x9fd8ef, 0xc06a8a];
    this.time.addEvent({
      delay: 120, loop: true, callback: () => {
        const c = this.add.rectangle(Math.random() * W, -10, 6, 10, colors[Math.floor(Math.random() * colors.length)]);
        this.tweens.add({
          targets: c, y: H + 20, x: c.x + (Math.random() * 120 - 60), angle: Math.random() * 720 - 360,
          duration: 2400 + Math.random() * 1600, onComplete: () => c.destroy(),
        });
      },
    });
    // you, celebrating below
    const you = this.add.sprite(400, 420, "player-down-0").setScale(2.5);
    this.tweens.add({ targets: you, y: 405, duration: 320, yoyo: true, repeat: -1, ease: "sine.out" }); // jumping
  }

  /* -- 4: day one ----------------------------------------------------------- */
  private vDayOne() {
    this.caption("cs4");
    const g = this.g();
    // sunrise bands
    const bands = [0x2c3a5c, 0x6b5a7a, 0xb87a6a, 0xe8a06a, 0xf5c878];
    bands.forEach((c, i) => { g.fillStyle(c); g.fillRect(0, i * 70, W, 70); });
    g.fillStyle(0xf5c878); g.fillRect(0, 350, W, H - 350);
    // sun rising
    const sun = this.add.circle(400, 360, 44, 0xffe08a);
    this.tweens.add({ targets: sun, y: 290, duration: 4000, ease: "sine.out" });
    const halo = this.add.circle(400, 360, 60, 0xffe08a, 0.25);
    this.tweens.add({ targets: halo, y: 290, scale: 1.2, alpha: 0.12, duration: 4000, ease: "sine.out" });
    // street
    const street = this.g().setDepth(3);
    street.fillStyle(0x4a4a5c); street.fillRect(0, 430, W, H - 430);
    street.fillStyle(0x8a8a9a); street.fillRect(0, 430, W, 4);
    // tower silhouette
    const tower = this.g().setDepth(2);
    tower.fillStyle(0x20242e); tower.fillRect(300, 90, 200, 344);
    tower.fillStyle(0x2c313d); tower.fillRect(320, 70, 160, 20);
    // lit windows flicking on
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 5; c++) {
        if (Math.random() < 0.4) continue;
        const wdw = this.add.rectangle(325 + c * 36, 110 + r * 31, 20, 14, 0xffd75e, 0).setDepth(2);
        this.tweens.add({ targets: wdw, fillAlpha: 0.85, delay: Math.random() * 3000, duration: 200 });
      }
    }
    // building signage — the Deloitte wordmark (white + green dot), rendered
    // tiny then scaled up nearest-neighbor so it pixelates like the rest of
    // the scene instead of looking like crisp vector type.
    const sign = this.add.rectangle(400, 105, 150, 30, 0x14161c).setDepth(3).setStrokeStyle(2, 0x2c313d);
    void sign;
    this.add.image(400, 105, this.deloitteWordmark()).setScale(3).setDepth(4);
    // doorway
    const door = this.g().setDepth(3);
    door.fillStyle(0xffd75e, 0.9); door.fillRect(380, 385, 40, 49);
    door.fillStyle(0x20242e); door.fillRect(398, 385, 4, 49);
    // you, walking to the door
    const you = this.add.sprite(120, 452, "player-right-0").setScale(2).setDepth(5);
    this.tweens.add({ targets: you, x: 400, duration: 3800, ease: "linear" });
    this.time.addEvent({
      delay: 160, loop: true, callback: () => {
        you.setTexture(you.texture.key.endsWith("-0") ? "player-right-1" : "player-right-0");
      },
    });
  }
}

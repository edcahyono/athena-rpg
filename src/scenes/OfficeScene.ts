/** OfficeScene — one floor at a time; elevator restarts the scene with a new floor. */
import Phaser from "phaser";
import { TILE, BLOCKING, LAYOUTS, NPCS, NpcDef, PROP_LINES, spawnPoint } from "../config/world";
import { api, state } from "../net/api";
import { ui, updateHUD, updateObjectiveBanner, elevatorPanel, questLogPanel, workspacePanel, menuPanel, toast, applyStaticLabels, welcomePanel, setRelabelHandler } from "../ui/ui";
import { interact, interactProp } from "../game/interactions";
import { computeObjective, Objective } from "../game/objective";
import { L, fmt, UI } from "../i18n";
import { toggleFullscreen } from "../main";

const TEX: Record<string, string> = {
  "#": "tile-wall", d: "tile-desk", t: "tile-table", p: "tile-plant",
  E: "tile-elevator", r: "tile-reception", c: "tile-carpet", k: "tile-cooler", o: "tile-copier",
  // Floor 15 executive offices
  W: "tile-exec-wall", D: "tile-exec-desk", g: "tile-exec-carpet",
};

// Walkable rug tiles render under the player (low depth) instead of at row depth.
const RUG = new Set(["c", "g"]);

// Module-level so floor changes (scene restarts) don't re-show the panel.
let welcomeShown = false;

export default class OfficeScene extends Phaser.Scene {
  private floor = 12;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private npcs: { def: NpcDef; sprite: Phaser.GameObjects.Sprite }[] = [];
  private npcLabels: { def: NpcDef; name: Phaser.GameObjects.Text; role: Phaser.GameObjects.Text }[] = [];
  private props: { char: string; x: number; y: number }[] = [];
  private elevators: { x: number; y: number }[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private guideArrow!: Phaser.GameObjects.Image;
  private guideDist!: Phaser.GameObjects.Text;
  private dir: "down" | "up" | "left" | "right" = "down";
  private lastSave = 0;
  private objective: Objective = { npcId: null, floor: null, label: "", why: "" };

  constructor() {
    super("office");
  }

  init(data: { floor?: number }) {
    this.floor = data.floor ?? state?.client?.floor ?? 12;
  }

  create() {
    this.npcs = [];
    this.npcLabels = [];
    this.props = [];
    this.elevators = [];
    const layout = LAYOUTS[this.floor];
    const walls = this.physics.add.staticGroup();

    layout.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        const ch = row[tx];
        const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
        this.add.image(x, y, "tile-floor").setDepth(0);
        if (TEX[ch]) {
          this.add.image(x, y, TEX[ch]).setDepth(RUG.has(ch) ? 1 : y);
          if (BLOCKING.has(ch)) {
            const body = walls.create(x, y, TEX[ch]) as Phaser.Physics.Arcade.Sprite;
            body.setVisible(false).refreshBody();
            // Only elevators + a couple of comedic props respond to E.
            if (PROP_LINES[ch]) this.props.push({ char: ch, x, y });
            if (ch === "E") this.elevators.push({ x, y });
          }
          if (ch === "p") {
            const bodyP = walls.create(x, y + 6, TEX[ch]) as Phaser.Physics.Arcade.Sprite;
            bodyP.setVisible(false).setSize(24, 20).refreshBody();
          }
        }
      }
    });

    // Player — new hires enter the lobby from the bottom; otherwise resume position.
    const sp = spawnPoint();
    const firstDay = state && !state.flags.metSupervisor && this.floor === 12;
    let startX = sp.tx * TILE + TILE / 2, startY = sp.ty * TILE + TILE / 2;
    if (firstDay) startY = 13 * TILE + TILE / 2;
    else if (state && state.client.floor === this.floor && state.client.x > 0 && state.client.y > 0) {
      startX = state.client.x; startY = state.client.y;
    }
    this.player = this.physics.add.sprite(startX, startY, "player-down-0");
    this.player.setSize(16, 12).setOffset(2, 16).setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walls);
    this.physics.world.setBounds(0, 0, layout[0].length * TILE, layout.length * TILE);

    // NPCs on this floor — name + role title stacked above each sprite.
    for (const def of NPCS.filter((n) => n.floor === this.floor)) {
      if (def.kind === "board") {
        this.npcs.push({ def, sprite: this.add.sprite(def.tx * TILE + TILE / 2, def.ty * TILE + TILE / 2, "shadow").setAlpha(0.01) });
        continue;
      }
      const x = def.tx * TILE + TILE / 2, y = def.ty * TILE + TILE / 2;
      this.add.image(x, y + 10, "shadow").setDepth(y - 1);
      const s = this.add.sprite(x, y, `char-${def.color}-down-0`).setDepth(y);
      const body = walls.create(x, y, `char-${def.color}-down-0`) as Phaser.Physics.Arcade.Sprite;
      body.setVisible(false).setSize(20, 20).refreshBody();
      const nameText = this.add.text(x, y - 30, L(def.name), {
        fontFamily: "Courier New", fontSize: "11px", fontStyle: "bold", color: "#ffffff",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10000);
      const roleText = this.add.text(x, y - 19, L(def.role), {
        fontFamily: "Courier New", fontSize: "9px", color: "#b8e4c8",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10000);
      this.npcs.push({ def, sprite: s });
      this.npcLabels.push({ def, name: nameText, role: roleText });
    }

    this.prompt = this.add.text(0, 0, "[E]", {
      fontFamily: "Courier New", fontSize: "12px", color: "#ffd75e",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10001).setVisible(false);

    // Objective guide — arrow orbiting the player + distance readout.
    this.guideArrow = this.add.image(0, 0, "guide-arrow").setDepth(10002).setVisible(false);
    this.guideDist = this.add.text(0, 0, "", {
      fontFamily: "Courier New", fontSize: "10px", color: "#ffd75e",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10002).setVisible(false);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D,E,Q,M") as any;
    // Phaser preventDefault-captures its registered keys GLOBALLY, which
    // swallows W/A/S/D/E/Q/M (and arrows) inside DOM inputs — "ANTA" typed
    // into the notebook became "NT". Movement still works without capture
    // because update() ignores input while ui.busy.
    this.input.keyboard!.disableGlobalCapture();

    this.input.keyboard!.on("keydown-E", () => this.tryInteract());
    this.input.keyboard!.on("keydown-Q", () => { if (!ui.busy) questLogPanel(); });
    this.input.keyboard!.on("keydown-B", () => { if (!ui.busy) workspacePanel(); });
    this.input.keyboard!.on("keydown-M", () => { if (!ui.busy) menuPanel(this.objective); });
    this.input.keyboard!.on("keydown-F", () => toggleFullscreen());
    document.getElementById("hud-menu")!.onclick = () => { if (!ui.busy) menuPanel(this.objective); };
    document.getElementById("hud-notebook")!.onclick = () => { if (!ui.busy) questLogPanel(); };
    document.getElementById("hud-binder")!.onclick = () => { if (!ui.busy) workspacePanel(); };
    document.getElementById("hud-fullscreen")!.onclick = () => toggleFullscreen();

    applyStaticLabels();
    updateHUD(this.floor);
    // Re-render Phaser labels in place when the language switches — no reload.
    setRelabelHandler(() => {
      for (const l of this.npcLabels) { l.name.setText(L(l.def.name)); l.role.setText(L(l.def.role)); }
      applyStaticLabels();
      updateHUD(this.floor);
    });

    // "Welcome back" after a real break (once per page load, before autosave
    // overwrites updatedAt) — a returning analyst gets their bearings back.
    const awayMs = state ? Date.now() - state.updatedAt : 0;
    if (!firstDay && !welcomeShown && state?.flags.metSupervisor && awayMs > 30 * 60 * 1000) {
      welcomeShown = true;
      const hours = Math.round(awayMs / 3600000);
      const awayLabel = hours >= 48 ? fmt(UI.awayDays, { n: Math.round(hours / 24) }) : fmt(UI.awayHours, { n: Math.max(1, hours) });
      welcomePanel(awayLabel, computeObjective(state).label);
    }
    welcomeShown = true;

    api.save({ floor: this.floor, x: this.player.x, y: this.player.y });

    if (firstDay) this.runIntroCutscene();
  }

  /** Day one: Athena walks in from the entrance straight to her supervisor. */
  private async runIntroCutscene() {
    ui.cutscene = true;
    try {
      const lin = NPCS.find((n) => n.id === "supervisor")!;
      await this.walkTo(lin.tx * TILE + TILE / 2, (lin.ty + 1) * TILE + TILE / 2);
      this.player.setTexture("player-up-0");
      ui.cutscene = false;
      await interact(lin, this.floor);
    } finally {
      ui.cutscene = false;
      updateHUD(this.floor);
    }
  }

  private walkTarget: { x: number; y: number; resolve: () => void } | null = null;

  /** Physics-driven scripted walk (tweens don't move arcade-physics sprites). */
  private walkTo(x: number, y: number): Promise<void> {
    return new Promise((resolve) => { this.walkTarget = { x, y, resolve }; });
  }

  private nearestNpc(): { def: NpcDef; sprite: Phaser.GameObjects.Sprite } | null {
    let best: any = null, bestD = 46;
    for (const n of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
      const reach = n.def.kind === "board" ? 80 : 46;
      if (d < Math.max(bestD, reach) && d < reach) { best = n; bestD = d; }
    }
    return best;
  }

  private nearestProp(): { char: string; x: number; y: number } | null {
    let best: any = null, bestD = 40;
    for (const p of this.props) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  private async tryInteract() {
    if (ui.busy || !state) return;
    const npc = this.nearestNpc();
    if (npc) {
      npc.sprite.setTexture(`char-${npc.def.color}-${this.faceMe(npc.sprite)}-0`);
      await interact(npc.def, this.floor);
      updateHUD(this.floor);
      return;
    }
    const prop = this.nearestProp();
    if (!prop) return;
    if (prop.char === "E") {
      const target = await elevatorPanel(this.floor);
      if (target !== null) {
        await api.save({ floor: target, x: 0, y: 0 });
        toast(fmt(UI.floorToast, { n: target }));
        this.scene.restart({ floor: target });
      }
      return;
    }
    await interactProp(prop.char);
  }

  private faceMe(other: { x: number; y: number }): string {
    const dx = this.player.x - other.x, dy = this.player.y - other.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  }

  /** Point the guide arrow at the objective NPC (or the elevator when it's on another floor). */
  private updateGuide() {
    this.objective = computeObjective(state);
    updateObjectiveBanner(this.objective.label ? `${this.objective.label}` : "", this.objective.why);

    if (!this.objective.npcId || ui.busy) {
      this.guideArrow.setVisible(false);
      this.guideDist.setVisible(false);
      return;
    }
    let tx: number, ty: number, offFloor = false;
    if (this.objective.floor === this.floor) {
      const n = this.npcs.find((n) => n.def.id === this.objective.npcId);
      if (!n) { this.guideArrow.setVisible(false); this.guideDist.setVisible(false); return; }
      tx = n.sprite.x; ty = n.sprite.y;
    } else {
      const ev = this.elevators.reduce((a, b) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) <
        Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y) ? a : b);
      tx = ev.x; ty = ev.y + 20; // aim just below the doors
      offFloor = true;
    }
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, tx, ty);
    if (dist < 52 && !offFloor) {
      // standing next to them — marker overhead instead of pointing
      this.guideArrow.setVisible(false);
      this.guideDist.setPosition(tx, ty - 44).setText(L({ en: "HERE", zh: "这里" })).setVisible(true);
      return;
    }
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, tx, ty);
    const ox = this.player.x + Math.cos(angle) * 34;
    const oy = this.player.y - 6 + Math.sin(angle) * 34;
    this.guideArrow.setPosition(ox, oy).setRotation(angle).setVisible(true);
    this.guideDist
      .setPosition(ox + Math.cos(angle) * 16, oy + Math.sin(angle) * 16 - 10)
      .setText(offFloor ? `🛗 F${this.objective.floor}` : `${Math.round(dist / TILE)}m`)
      .setVisible(true);
  }

  update(time: number) {
    if (!this.player) return;
    const speed = 150;
    let vx = 0, vy = 0;

    if (this.walkTarget) {
      // scripted walk (cutscene) — axis-aligned, y first for a natural path
      const { x, y, resolve } = this.walkTarget;
      const dx = x - this.player.x, dy = y - this.player.y;
      if (Math.abs(dy) > 4) vy = Math.sign(dy) * 120;
      else if (Math.abs(dx) > 4) vx = Math.sign(dx) * 120;
      else { this.walkTarget = null; resolve(); }
    } else if (!ui.busy) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -speed;
      else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = speed;
      if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -speed;
      else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = speed;
    }
    this.player.setVelocity(vx, vy);

    if (vx < 0) this.dir = "left";
    else if (vx > 0) this.dir = "right";
    else if (vy < 0) this.dir = "up";
    else if (vy > 0) this.dir = "down";

    if (!ui.cutscene || this.walkTarget) {
      const moving = vx !== 0 || vy !== 0;
      const frame = moving ? (Math.floor(time / 160) % 2) : 0;
      this.player.setTexture(`player-${this.dir}-${frame}`);
    }
    this.player.setDepth(this.player.y);

    // interaction prompt
    const near = this.nearestNpc() || this.nearestProp();
    if (near && !ui.busy) {
      const nx = (near as any).sprite?.x ?? (near as any).x;
      const ny = (near as any).sprite?.y ?? (near as any).y;
      this.prompt.setPosition(nx, ny - 36).setVisible(true);
    } else this.prompt.setVisible(false);

    this.updateGuide();

    // periodic autosave of position
    if (time - this.lastSave > 20000 && state) {
      this.lastSave = time;
      api.save({ floor: this.floor, x: this.player.x, y: this.player.y });
    }
  }
}

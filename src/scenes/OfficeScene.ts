/** OfficeScene — one floor at a time; elevator restarts the scene with a new floor. */
import Phaser from "phaser";
import { TILE, BLOCKING, LAYOUTS, NPCS, NpcDef, PROP_LINES, spawnPoint, EXEC_OFFICES, FILLER_COLORS } from "../config/world";
import { api, state } from "../net/api";
import { ui, updateHUD, updateObjectiveBanner, elevatorPanel, elevatorClose, elevatorOpen, questLogPanel, workspacePanel, menuPanel, toast, applyStaticLabels, welcomePanel, setRelabelHandler } from "../ui/ui";
import { interact, interactProp } from "../game/interactions";
import { computeObjective, Objective } from "../game/objective";
import { L, fmt, UI } from "../i18n";
import { toggleFullscreen } from "../main";
import { FONT_UI } from "../ui/fonts";

const TEX: Record<string, string> = {
  "#": "tile-wall", d: "tile-desk", t: "tile-table", p: "tile-plant",
  E: "tile-elevator", r: "tile-reception", c: "tile-carpet", k: "tile-cooler", o: "tile-copier",
  // Floor 15 executive offices
  W: "tile-exec-wall", D: "tile-exec-desk", g: "tile-exec-carpet",
  // Matte-glass windows (n = standard grey wall, N = executive walnut)
  n: "tile-window", N: "tile-exec-window",
  // Executive office door (press E to enter/exit)
  X: "tile-exec-door",
  // Executive private office: G = glass wall, b = black interior floor
  G: "tile-glass", b: "tile-black",
  // Filing room: B = bookshelf, F = locked badge-controlled door
  B: "tile-bookshelf", F: "tile-filing-door",
};

// Walkable rug tiles render under the player (low depth) instead of at row depth.
const RUG = new Set(["c", "g", "b"]);

// Ambient NPCs that stay on their feet (they stroll/clean rather than sit at a
// desk). Everyone else is seated in an office chair at their station.
const STANDING = new Set(["guard", "cleaner"]);

// Ambient NPCs that stroll/clean along a fixed patrol route (tile coords).
const WANDER = new Set(["guard", "cleaner"]);
const PATROLS: Record<string, [number, number][]> = {
  // Both ambient staff pace the empty central hallway, never the cubicle bands.
  // Right-hand stretch of the corridor only (col 23 is the file-room door, so
  // the route stops at 22) — keeps him out of the central briefing space.
  guard: [[16, 7], [22, 7]],
  cleaner: [[5, 9], [26, 9]],
};

// Module-level so floor changes (scene restarts) don't re-show the panel.
let welcomeShown = false;

export default class OfficeScene extends Phaser.Scene {
  private floor = 12;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private npcs: { def: NpcDef; sprite: Phaser.GameObjects.Sprite }[] = [];
  private npcLabels: { def: NpcDef; name: Phaser.GameObjects.Text; role: Phaser.GameObjects.Text }[] = [];
  private wanderers: { def: NpcDef; sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; role: Phaser.GameObjects.Text; path: { x: number; y: number }[]; idx: number; dir: string; pauseUntil: number; mop?: Phaser.GameObjects.Image }[] = [];
  private deskAnims: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private execOffices: { execId: string; bounds: Phaser.Geom.Rectangle; cover: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; meta: (typeof EXEC_OFFICES)[number] }[] = [];
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

  init(data: { floor?: number; viaElevator?: boolean }) {
    this.floor = data.floor ?? state?.client?.floor ?? 12;
    (this as any).viaElevator = !!data.viaElevator;
  }

  create() {
    this.npcs = [];
    this.npcLabels = [];
    this.wanderers = [];
    this.deskAnims = [];
    this.execOffices = [];
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
          // Boardroom: the long table is drawn as ONE polished slab below (a
          // tiled table sprite reads as a wall of cabinets), so skip the tiles.
          const boardTable = this.floor === 16 && ch === "t";
          if (!boardTable) this.add.image(x, y, TEX[ch]).setDepth(RUG.has(ch) ? 1 : y);
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

    // Boardroom: one long polished conference table (cols 8-24, rows 4-6) with
    // executive chairs down both sides — replaces the tiled table sprites.
    if (this.floor === 16) {
      const bx = 8 * TILE, by = 4 * TILE, bw = 17 * TILE, bh = 3 * TILE;
      this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh, 0x000000).setDepth(4);
      this.add.rectangle(bx + bw / 2, by + bh / 2, bw - 6, bh - 6, 0x6b4a2f).setDepth(5);
      this.add.rectangle(bx + bw / 2, by + 14, bw - 14, 8, 0x8a6440).setDepth(6); // lit top edge
      this.add.rectangle(bx + bw / 2, by + bh - 10, bw - 14, 5, 0x53381f).setDepth(6); // shaded front
      for (let i = 0; i < 7; i++) {
        const cx = bx + 34 + i * ((bw - 60) / 6);
        this.add.image(cx, by - 12, "tile-chair").setDepth(3);            // far-side chairs
        this.add.image(cx, by + bh + 12, "tile-chair").setDepth(bh + by); // near-side chairs
      }
    }

    // Player — new hires enter the lobby from the bottom; otherwise resume position.
    const sp = spawnPoint();
    const firstDay = state && !state.flags.metSupervisor && this.floor === 12;
    let startX = sp.tx * TILE + TILE / 2, startY = sp.ty * TILE + TILE / 2;
    if (firstDay) startY = 9 * TILE + TILE / 2; // arrive in the central hallway
    else if (state && state.client.floor === this.floor && state.client.x > 0 && state.client.y > 0) {
      startX = state.client.x; startY = state.client.y;
    }
    // Arrived by elevator → appear AT the left-center doors; a scripted walk-out
    // (below) steps RIGHT into the corridor.
    if ((this as any).viaElevator) {
      startX = 2 * TILE + TILE / 2; startY = 8 * TILE + TILE / 2; this.dir = "right";
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
      const wander = WANDER.has(def.id);
      const seated = !STANDING.has(def.id);
      if (seated && def.kind !== "persona" && [10, 11, 12].includes(this.floor)) this.drawCubicle(x, y);
      if (seated) this.add.image(x, y - 2, "tile-chair").setDepth(y - 1); // chair behind the desk worker
      // Personal cubicle desk (with laptop) directly in front — the worker sits
      // behind it. Executives (F15) get their own office desks instead.
      const giveDesk = seated && def.kind !== "persona";
      if (giveDesk) {
        const dyPix = y + TILE;
        const deskImg = this.add.image(x, dyPix, "tile-work-0").setDepth(dyPix + 4);
        this.deskAnims.push({ img: deskImg, phase: Math.floor(Math.random() * 400) });
        const deskBody = walls.create(x, dyPix, "tile-work-0") as Phaser.Physics.Arcade.Sprite;
        deskBody.setVisible(false).setSize(34, 20).refreshBody();
      }
      const shadow = this.add.image(x, y + 10, "shadow").setDepth(y - 1);
      const s = this.add.sprite(x, y + (seated ? 3 : 0), `char-${def.color}-${def.facing || "down"}-0`).setDepth(y);
      // Strollers move freely, so they get no static collider (won't block paths).
      if (!wander) {
        const body = walls.create(x, y, `char-${def.color}-down-0`) as Phaser.Physics.Arcade.Sprite;
        body.setVisible(false).setSize(20, 20).refreshBody();
      }
      const nameText = this.add.text(x, y - 30, L(def.name), {
        fontFamily: FONT_UI, fontSize: "11px", fontStyle: "bold", color: "#ffffff",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10000);
      const roleText = this.add.text(x, y - 19, L(def.role), {
        fontFamily: FONT_UI, fontSize: "9px", color: "#b8e4c8",
        stroke: "#000000", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10000);
      this.npcs.push({ def, sprite: s });
      this.npcLabels.push({ def, name: nameText, role: roleText });
      if (wander) {
        const path = (PATROLS[def.id] || [[def.tx, def.ty]]).map(([px, py]) => ({ x: px * TILE + TILE / 2, y: py * TILE + TILE / 2 }));
        // Auntie Mei actually carries a mop; OfficeScene.update swings it and
        // leaves a damp sheen on the tiles behind her.
        const mop = def.id === "cleaner"
          ? this.add.image(x + 9, y + 4, "prop-mop").setOrigin(0.5, 0.9).setDepth(y + 1)
          : undefined;
        this.wanderers.push({ def, sprite: s, shadow, name: nameText, role: roleText, path, idx: 0, dir: "down", pauseUntil: 0, mop });
      }
    }

    // Decorative filler workers — non-interactive colleagues in neat, symmetric
    // cubicle rows so the open floors feel like a real, busy office. Cells that
    // would crowd a real NPC or furniture are skipped.
    if ([10, 11, 12].includes(this.floor)) {
      // Same grid the named NPCs sit on: an upper and a lower cubicle band with
      // an empty hallway between them. Cells taken by a named NPC are skipped
      // below, so the two populations interlock without ever overlapping.
      const FILLER_ROWS = [3, 11], FILLER_COLS = [4, 8, 12, 16, 20, 24, 28];
      let fi = this.floor; // vary the palette per floor
      for (const fy of FILLER_ROWS) {
        for (const fx of FILLER_COLS) {
          if (fx <= 4 && fy >= 6 && fy <= 9) continue; // keep the marble lift lobby clear
          // Never build a workstation on (or next to) the player's spawn — a
          // desk body there traps the player and stalls the day-one walk-in.
          const sp0 = spawnPoint();
          if (Math.abs(fx - sp0.tx) <= 1 && Math.abs(fy - sp0.ty) <= 1) continue;
          // Only skip a cell a NAMED, SEATED npc actually occupies. Wanderers
          // roam the hallway and must not blank out cubicles, and a wide radius
          // used to wipe out the neighbouring stations on both sides.
          const nearNpc = NPCS.some((n) =>
            n.floor === this.floor && !WANDER.has(n.id) &&
            Math.abs(n.tx - fx) < 2 && Math.abs(n.ty - fy) < 2);
          let nearFurniture = false;
          for (let yy = fy - 1; yy <= fy + 2 && !nearFurniture; yy++)
            for (let xx = fx - 1; xx <= fx + 1 && !nearFurniture; xx++)
              if ((layout[yy]?.[xx] ?? "#") !== ".") nearFurniture = true;
          if (nearNpc || nearFurniture) continue;
          const color = FILLER_COLORS[fi++ % FILLER_COLORS.length];
          const x = fx * TILE + TILE / 2, y = fy * TILE + TILE / 2;
          this.drawCubicle(x, y);
          this.add.image(x, y - 2, "tile-chair").setDepth(y - 1);
          this.add.image(x, y + 10, "shadow").setDepth(y - 1);
          this.add.sprite(x, y + 3, `char-${color}-down-0`).setDepth(y);
          const dImg = this.add.image(x, y + TILE, "tile-work-0").setDepth(y + TILE + 4);
          this.deskAnims.push({ img: dImg, phase: Math.floor(Math.random() * 400) });
          const dBody = walls.create(x, y + TILE, "tile-work-0") as Phaser.Physics.Arcade.Sprite;
          dBody.setVisible(false).setSize(34, 20).refreshBody();
          const pBody = walls.create(x, y, "tile-chair") as Phaser.Physics.Arcade.Sprite;
          pBody.setVisible(false).setSize(20, 20).refreshBody();
        }
      }
    }

    this.prompt = this.add.text(0, 0, "[E]", {
      fontFamily: FONT_UI, fontSize: "12px", color: "#ffd75e",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10001).setVisible(false);

    // Objective guide — arrow orbiting the player + distance readout.
    this.guideArrow = this.add.image(0, 0, "guide-arrow").setDepth(10002).setVisible(false);
    this.guideDist = this.add.text(0, 0, "", {
      fontFamily: FONT_UI, fontSize: "10px", color: "#ffd75e",
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

    if (this.floor === 15) this.buildExecOffices();

    if (firstDay) this.runIntroCutscene();

    // Arrived by elevator → slide the doors open, then visibly WALK OUT of them
    // (scripted walk; input is ignored until the step-out completes).
    if ((this as any).viaElevator) {
      elevatorOpen(this.floor);
      // Step RIGHT out of the left-center elevator into the corridor.
      this.walkTo(5 * TILE + TILE / 2, this.player.y).then(() => this.player.setTexture("player-right-0"));
      // Safety: if the walk-out is ever obstructed, hand control back anyway so
      // the player can never get stuck stepping out of the elevator.
      this.time.delayedCall(1800, () => {
        if (this.walkTarget) { const done = this.walkTarget.resolve; this.walkTarget = null; done(); }
      });
    }
  }

  /** F15 executive offices: an opaque frosted-glass cover + door label over each
   *  office, so from the corridor you can't see who's inside — walk in and the
   *  exec is revealed at their desk (handled in update). */
  private buildExecOffices() {
    for (const o of EXEC_OFFICES) {
      const px = o.tx * TILE, py = o.ty * TILE, pw = o.w * TILE, ph = o.h * TILE;
      const cover = this.add.rectangle(px + pw / 2, py + ph / 2, pw - 2, ph - 2, 0xcce0ec, 0.95)
        .setDepth(9000).setStrokeStyle(3, 0x8fb0c4);
      // Door stays visible above the frost — it's the way in (press E).
      this.add.image(o.door.tx * TILE + TILE / 2, o.door.ty * TILE + TILE / 2, "tile-exec-door").setDepth(9001);
      const label = this.add.text(px + pw / 2, py + ph - 10, L(o.label), {
        fontFamily: FONT_UI, fontSize: "12px", fontStyle: "bold", color: "#1f3038",
        stroke: "#eaf4fa", strokeThickness: 3, align: "center", wordWrap: { width: pw - 6 },
      }).setOrigin(0.5, 1).setDepth(10002);
      // The exec's laptop desk, on the door side of their seat (drawn/animated
      // here since executives are excluded from the open-floor cubicle desks).
      const dside = Math.sign(o.door.ty - o.seat.ty) || 1;
      const dyp = o.seat.ty * TILE + TILE / 2 + dside * 15;
      const deskImg = this.add.image(o.seat.tx * TILE + TILE / 2, dyp, "tile-work-0").setDepth(dyp);
      this.deskAnims.push({ img: deskImg, phase: Math.floor(Math.random() * 400) });
      const bounds = new Phaser.Geom.Rectangle(px + 4, py + 4, pw - 8, ph - 8);
      this.execOffices.push({ execId: o.execId, bounds, cover, label, meta: o });
    }
  }

  /** Day one: Athena walks in from the entrance straight to her supervisor. */
  private async runIntroCutscene() {
    ui.cutscene = true;
    try {
      const lin = NPCS.find((n) => n.id === "supervisor")!;
      // You stop in the middle of the empty hallway; Manager Lin gets up and
      // comes out to meet you there. She leaves the way a real person would:
      // sideways through the cubicle doorway (drawCubicle leaves a gap in the
      // right divider), down the aisle beside her station, then across to you —
      // never straight through her own desk.
      await this.walkTo(lin.tx * TILE + TILE / 2, 8 * TILE + TILE / 2);
      this.player.setTexture("player-up-0");
      const aisle = lin.tx + 1; // the free column just outside her doorway
      await this.walkNpcPath("supervisor", [
        { tx: aisle, ty: lin.ty, dir: "right", ms: 520 },  // step out through the door
        { tx: aisle, ty: 6, dir: "down", ms: 1100 },       // down the aisle
        { tx: lin.tx, ty: 6, dir: "left", ms: 520 },       // across to meet you
      ], "down");
      ui.cutscene = false;
      await interact(lin, this.floor);
      // …then retraces her steps and settles back into her chair.
      ui.cutscene = true;
      await this.walkNpcPath("supervisor", [
        { tx: aisle, ty: 6, dir: "right", ms: 520 },
        { tx: aisle, ty: lin.ty, dir: "up", ms: 1100 },
        { tx: lin.tx, ty: lin.ty, dir: "left", ms: 520 },
      ], "down", 3); // +3px: seated NPCs sit slightly below their tile centre
    } finally {
      ui.cutscene = false;
      updateHUD(this.floor);
    }
  }

  /** Walk an NPC through a series of tiles, turning at each corner. `endDir` is
   *  the facing they hold once they stop; `endYOffset` re-seats them. */
  private async walkNpcPath(
    id: string,
    steps: { tx: number; ty: number; dir: "down" | "up" | "left" | "right"; ms: number }[],
    endDir: "down" | "up" | "left" | "right",
    endYOffset = 0,
  ) {
    for (const s of steps) await this.walkNpcTo(id, s.tx, s.ty, s.dir, s.ms);
    const npc = this.npcs.find((n) => n.def.id === id);
    if (!npc) return;
    npc.sprite.setTexture(`char-${npc.def.color}-${endDir}-0`);
    npc.sprite.y += endYOffset;
    const lab = this.npcLabels.find((n) => n.def.id === id);
    if (lab) {
      lab.name.setPosition(npc.sprite.x, npc.sprite.y - 30);
      lab.role.setPosition(npc.sprite.x, npc.sprite.y - 19);
    }
  }

  /** Damp sheen left on the tiles behind the mop; fades out on its own. */
  private lastWet = 0;
  private addWetPatch(x: number, y: number, time: number) {
    if (time - this.lastWet < 90) return;   // rate-limit so we don't flood the display list
    this.lastWet = time;
    const p = this.add.ellipse(x, y, 20, 9, 0xbfe4f2, 0.34).setDepth(0.6);
    this.tweens.add({
      targets: p, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 1500,
      ease: "Quad.easeOut", onComplete: () => p.destroy(),
    });
  }

  /** Walk a named NPC's sprite (and its labels) to a tile, stepping the walk
   *  cycle. NPC sprites aren't physics bodies, so a tween is safe here. */
  private walkNpcTo(id: string, tx: number, ty: number, dir: "down" | "up" | "left" | "right", ms = 1500): Promise<void> {
    const npc = this.npcs.find((n) => n.def.id === id);
    const lab = this.npcLabels.find((n) => n.def.id === id);
    if (!npc) return Promise.resolve();
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    return new Promise((resolve) => {
      let frame = 0;
      const stepper = this.time.addEvent({ delay: 150, loop: true, callback: () => {
        frame ^= 1;
        npc.sprite.setTexture(`char-${npc.def.color}-${dir}-${frame}`);
      } });
      this.tweens.add({
        targets: npc.sprite, x, y, duration: ms, ease: "Linear",
        onUpdate: () => {
          npc.sprite.setDepth(npc.sprite.y);
          if (lab) {
            lab.name.setPosition(npc.sprite.x, npc.sprite.y - 30);
            lab.role.setPosition(npc.sprite.x, npc.sprite.y - 19);
          }
        },
        onComplete: () => {
          stepper.remove();
          npc.sprite.setTexture(`char-${npc.def.color}-${dir}-0`);
          resolve();
        },
      });
    });
  }

  private walkTarget: { x: number; y: number; resolve: () => void } | null = null;

  /** Physics-driven scripted walk (tweens don't move arcade-physics sprites).
   *  Always resolves: if the path is ever obstructed the walk is released after
   *  `timeoutMs` so a scripted move can never permanently lock player input. */
  private walkTo(x: number, y: number, timeoutMs = 4000): Promise<void> {
    return new Promise((resolve) => {
      const target = { x, y, resolve };
      this.walkTarget = target;
      this.time.delayedCall(timeoutMs, () => {
        if (this.walkTarget === target) { this.walkTarget = null; resolve(); }
      });
    });
  }

  /** A cubicle around a seated worker: fabric back panel, a solid left divider,
   *  and a RIGHT divider broken by a gap at seat level — the doorway. Every
   *  station opens the same way, so an occupant always has a visible way out
   *  instead of appearing to phase through their own desk. */
  private drawCubicle(x: number, y: number) {
    this.add.image(x, y - 15, "tile-cubicle").setDepth(y - 3);            // back panel
    this.add.rectangle(x - 24, y + 4, 4, 52, 0x646d80).setDepth(y - 4);  // left divider
    // Right divider in two pieces; the 20px gap between them is the entrance.
    this.add.rectangle(x + 24, y - 14, 4, 16, 0x646d80).setDepth(y - 4);
    this.add.rectangle(x + 24, y + 22, 4, 16, 0x646d80).setDepth(y - 4);
    // Doorway jambs — a lighter capped edge either side of the opening so the
    // gap reads as a deliberate door rather than a hole in the panel.
    this.add.rectangle(x + 24, y - 6, 6, 3, 0x9aa4ba).setDepth(y - 4);
    this.add.rectangle(x + 24, y + 14, 6, 3, 0x9aa4ba).setDepth(y - 4);
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
      // Seated workers rise to greet you, then settle back when you leave.
      const standing = STANDING.has(npc.def.id);
      const seatY = npc.sprite.y;
      if (!standing) this.tweens.add({ targets: npc.sprite, y: seatY - 7, duration: 150, ease: "Quad.out" });
      await interact(npc.def, this.floor);
      if (!standing) this.tweens.add({ targets: npc.sprite, y: seatY, duration: 150, ease: "Quad.in" });
      updateHUD(this.floor);
      return;
    }
    const prop = this.nearestProp();
    if (!prop) return;
    // Executive office door: press E to step inside (revealing the office) or
    // back out into the corridor.
    if (prop.char === "X" && this.floor === 15) {
      const dtx = Math.floor(prop.x / TILE), dty = Math.floor(prop.y / TILE);
      const off = this.execOffices.find((o) => o.meta.door.tx === dtx && o.meta.door.ty === dty);
      if (off) {
        const inside = Phaser.Geom.Rectangle.Contains(off.bounds, this.player.x, this.player.y);
        const t = inside ? off.meta.outside : off.meta.inside;
        (this.player.body as Phaser.Physics.Arcade.Body).reset(t.tx * TILE + TILE / 2, t.ty * TILE + TILE / 2);
        this.dir = inside ? "down" : "up";
        this.player.setTexture(`player-${this.dir}-0`);
      }
      return;
    }
    if (prop.char === "E") {
      const target = await elevatorPanel(this.floor);
      if (target !== null) {
        await api.save({ floor: target, x: 0, y: 0 });
        await elevatorClose(this.floor, target); // doors shut + ride to the floor
        this.scene.restart({ floor: target, viaElevator: true }); // rebuild behind closed doors
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

    if (this.wanderers.length) this.updateWanderers(time);
    // Cubicle workers type away — toggle the two laptop frames (desynced per desk).
    for (const d of this.deskAnims) d.img.setTexture(`tile-work-${Math.floor((time + d.phase) / 320) % 2}`);

    // Executive offices: reveal the exec only while you're inside their office.
    for (const o of this.execOffices) {
      const inside = Phaser.Geom.Rectangle.Contains(o.bounds, this.player.x, this.player.y);
      o.cover.setVisible(!inside);
      o.label.setVisible(!inside);
      const lbl = this.npcLabels.find((l) => l.def.id === `persona-${o.execId}`);
      if (lbl) { lbl.name.setVisible(inside); lbl.role.setVisible(inside); }
    }

    // Declutter labels: the long role titles collide when workstations sit close
    // together, so show each NPC's role line only when you're near them — names
    // stay up for navigation. (Executive labels are handled by the office loop.)
    for (const l of this.npcLabels) {
      if (l.def.kind === "persona") continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, l.name.x, l.name.y);
      l.role.setVisible(d < 92);
    }

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

  /** Ambient strollers (security, cleaner) pace a fixed route, pausing at each
   *  stop; frozen while a dialogue/panel is open, or during a scripted scene so
   *  nobody strolls through the middle of it. */
  private updateWanderers(time: number) {
    for (const w of this.wanderers) {
      if (ui.busy || ui.cutscene || time < w.pauseUntil) {
        w.sprite.setTexture(`char-${w.def.color}-${w.dir}-0`);
        // Paused at the end of a run: keep scrubbing the same patch of floor.
        if (w.mop) {
          w.mop.setRotation(Math.sin(time / 110) * 0.5);
          w.mop.setPosition(w.sprite.x + Math.sin(time / 110) * 7, w.sprite.y + 6).setDepth(w.sprite.y + 1);
          this.addWetPatch(w.mop.x, w.mop.y + 4, time);
        }
        continue;
      }
      const t = w.path[w.idx];
      const dx = t.x - w.sprite.x, dy = t.y - w.sprite.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) {
        w.idx = (w.idx + 1) % w.path.length;
        w.pauseUntil = time + 700 + Math.random() * 1400; // pause to stretch / mop
        continue;
      }
      const step = 42 / 60; // ~42 px per second at 60fps
      const nx = w.sprite.x + (dx / d) * step, ny = w.sprite.y + (dy / d) * step;
      w.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      const frame = Math.floor(time / 170) % 2;
      w.sprite.setPosition(nx, ny).setTexture(`char-${w.def.color}-${w.dir}-${frame}`).setDepth(ny);
      w.shadow.setPosition(nx, ny + 10).setDepth(ny - 1);
      w.name.setPosition(nx, ny - 30);
      w.role.setPosition(nx, ny - 19);
      if (w.mop) {
        // Held out front in the direction of travel, sweeping side to side.
        const off = w.dir === "left" ? -10 : w.dir === "right" ? 10 : 0;
        w.mop.setRotation(Math.sin(time / 90) * 0.45)
             .setPosition(nx + off + Math.sin(time / 90) * 6, ny + 6)
             .setDepth(ny + 1);
        this.addWetPatch(w.mop.x, w.mop.y + 4, time);
      }
    }
  }
}

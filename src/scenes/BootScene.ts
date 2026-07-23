/**
 * BootScene — generates all placeholder pixel-art textures procedurally
 * (tiles + characters), so v1 runs with zero external art assets.
 * Style target: GBA-era Pokémon interiors — chunky outlines, readable
 * furniture (a 工位 reads as a workstation, a table as a table).
 * Final custom sprite art is a later pass; only this file needs to change.
 */
import Phaser from "phaser";
import { TILE, NPCS, FILLER_COLORS } from "../config/world";
import {
  DIRS, drawCharacter, CharOpts, DEFAULT_PLAYER, HAIRSTYLES_MALE, HAIRSTYLES_FEMALE,
} from "../game/charDraw";
import { loadProfile } from "../game/profile";
import { state } from "../net/api";

const OUTLINE = 0x1a1420;

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    this.makeTiles();
    // Player (Athena) — from the character creator profile; NPCs from config.
    this.makeCharacter("player", { ...DEFAULT_PLAYER, ...(loadProfile() || {}) });
    const done = new Set<number>();
    for (const npc of NPCS) {
      if (npc.kind === "board") continue;
      if (!done.has(npc.color)) {
        // NPC variety: derive gender/skin/hair deterministically from the
        // color so the cast doesn't all share one face; top color forced to
        // the NPC's configured palette color via the override argument.
        const gender = npc.color % 2 === 0 ? "male" : "female";
        const list = gender === "male" ? HAIRSTYLES_MALE : HAIRSTYLES_FEMALE;
        this.makeCharacter(`char-${npc.color}`, {
          ...DEFAULT_PLAYER,
          gender,
          skin: npc.color % 4,
          hair: npc.color % 6,
          hairKey: list[npc.color % list.length].key,
        }, npc.color);
        done.add(npc.color);
      }
    }
    // Decorative filler workers (non-interactive) that populate the open floors.
    for (const c of FILLER_COLORS) {
      if (done.has(c)) continue;
      const gender = c % 2 === 0 ? "male" : "female";
      const list = gender === "male" ? HAIRSTYLES_MALE : HAIRSTYLES_FEMALE;
      this.makeCharacter(`char-${c}`, {
        ...DEFAULT_PLAYER, gender, skin: c % 4, hair: c % 6, hairKey: list[c % list.length].key,
      }, c);
      done.add(c);
    }
    // Animated intro vignettes play only for a genuinely new player — never
    // again once seen (even if they quit before meeting Manager Lin).
    const newPlayer = (!state || !state.flags.metSupervisor);
    const showIntro = newPlayer && !localStorage.getItem("athena-seen-intro");
    this.scene.start(showIntro ? "intro" : "office");
  }

  private tex(key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeTiles() {
    const T = TILE;

    // Floor — warm two-tone checker like Pokémon interiors.
    this.tex("tile-floor", T, T, (g) => {
      g.fillStyle(0xe8dcc2); g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);
      g.fillStyle(0xdfd2b2); g.fillRect(16, 0, 16, 16); g.fillRect(0, 16, 16, 16);
      g.fillStyle(0xd2c4a2); g.fillRect(0, 0, T, 1); g.fillRect(0, 0, 1, T);
      g.fillStyle(0xf2e8d0); g.fillRect(5, 5, 2, 2); g.fillRect(24, 21, 2, 2);
    });

    // Wall — paneled office wall: cap, panels with seams, dark baseboard.
    this.tex("tile-wall", T, T, (g) => {
      g.fillStyle(0x556077); g.fillRect(0, 0, T, T);
      g.fillStyle(0x6b7691); g.fillRect(0, 0, T, 9); // lit cap
      g.fillStyle(0x8891a8); g.fillRect(0, 0, T, 3); // top highlight
      g.fillStyle(0x49536a); g.fillRect(7, 12, 1, 14); g.fillRect(23, 12, 1, 14); // panel seams
      g.fillStyle(0x2c3242); g.fillRect(0, T - 5, T, 5); // baseboard
      g.fillStyle(0x1f2430); g.fillRect(0, T - 1, T, 1);
    });

    // 工位 (workstation) — wood desk, glowing monitor, keyboard, papers.
    this.tex("tile-desk", T, T, (g) => {
      g.fillStyle(OUTLINE); g.fillRect(0, 2, T, T - 4); // outline
      g.fillStyle(0x9a6b40); g.fillRect(1, 3, T - 2, T - 6); // desk wood
      g.fillStyle(0xb5834f); g.fillRect(1, 3, T - 2, 5); // lit top edge
      g.fillStyle(0x845a34); g.fillRect(1, T - 6, T - 2, 3); // shaded front
      g.fillStyle(0x6e4a2b); g.fillRect(4, 10, 24, 1); g.fillRect(4, 15, 24, 1); // grain
      g.fillStyle(OUTLINE); g.fillRect(8, 4, 14, 11); // monitor frame
      g.fillStyle(0x2c3242); g.fillRect(9, 5, 12, 9);
      g.fillStyle(0x7ec8e3); g.fillRect(10, 6, 10, 7); // screen
      g.fillStyle(0xd6f2ff); g.fillRect(11, 7, 4, 2); // glare
      g.fillStyle(OUTLINE); g.fillRect(13, 15, 4, 2); // stand
      g.fillStyle(0x3a3f4a); g.fillRect(9, 19, 13, 4); // keyboard
      g.fillStyle(0x555b68); g.fillRect(10, 20, 11, 1);
      g.fillStyle(0xf4f0e4); g.fillRect(24, 18, 6, 8); // papers
      g.fillStyle(0xc9c2ae); g.fillRect(25, 20, 4, 1); g.fillRect(25, 22, 4, 1);
    });

    // Meeting table — big wooden slab with runner + documents.
    this.tex("tile-table", T, T, (g) => {
      g.fillStyle(OUTLINE); g.fillRect(0, 0, T, T);
      g.fillStyle(0xc09a62); g.fillRect(1, 1, T - 2, T - 2);
      g.fillStyle(0xd4b078); g.fillRect(1, 1, T - 2, 6); // sheen
      g.fillStyle(0xa8834f); g.fillRect(1, T - 7, T - 2, 6); // shade
      g.fillStyle(0x8a6a3e); g.fillRect(12, 1, 8, T - 2); // runner
      g.fillStyle(0xf4f0e4); g.fillRect(4, 10, 6, 8); // document
      g.fillStyle(0xc9c2ae); g.fillRect(5, 12, 4, 1); g.fillRect(5, 14, 4, 1);
    });

    // Plant — clay pot, layered bush with dark backing so it pops.
    this.tex("tile-plant", T, T, (g) => {
      g.fillStyle(OUTLINE); g.fillRect(10, 19, 12, 11);
      g.fillStyle(0xb0623a); g.fillRect(11, 20, 10, 9);
      g.fillStyle(0xd07848); g.fillRect(11, 20, 10, 3); // pot rim
      g.fillStyle(0x1e4a24); g.fillCircle(16, 11, 10); // leaf backing
      g.fillStyle(0x2e7d32); g.fillCircle(16, 11, 8);
      g.fillStyle(0x43a047); g.fillCircle(11, 9, 5); g.fillCircle(21, 9, 5);
      g.fillStyle(0x66bb6a); g.fillRect(14, 5, 3, 3); g.fillRect(19, 11, 3, 2);
    });

    // Rug — Deloitte-green bordered rug.
    this.tex("tile-carpet", T, T, (g) => {
      g.fillStyle(0x24593c); g.fillRect(0, 0, T, T);
      g.fillStyle(0x3f7d5a); g.fillRect(3, 3, T - 6, T - 6);
      g.fillStyle(0x356b4c); g.fillRect(14, 8, 4, 4); g.fillRect(6, 20, 4, 4) ; g.fillRect(22, 20, 4, 4); // diamond dots
      g.fillStyle(0x4f9068); g.fillRect(3, 3, T - 6, 2);
    });

    // Elevator — steel doors, frame, indicator lamp.
    this.tex("tile-elevator", T, T, (g) => {
      g.fillStyle(OUTLINE); g.fillRect(0, 0, T, T);
      g.fillStyle(0x8a919e); g.fillRect(1, 1, T - 2, T - 2); // frame
      g.fillStyle(0xb9c2cf); g.fillRect(4, 6, 11, 24); g.fillRect(17, 6, 11, 24); // doors
      g.fillStyle(0xd8dfe8); g.fillRect(4, 6, 11, 3); g.fillRect(17, 6, 11, 3);
      g.fillStyle(0x2c3242); g.fillRect(15, 6, 2, 24); // gap
      g.fillStyle(0x1f2430); g.fillRect(3, 1, 26, 4); // header
      g.fillStyle(0x7ee787); g.fillRect(13, 2, 6, 2); // indicator light
    });

    // Reception counter — dark wood with a green Deloitte plaque + bell.
    this.tex("tile-reception", T, T, (g) => {
      g.fillStyle(OUTLINE); g.fillRect(0, 4, T, T - 8);
      g.fillStyle(0x6e4a2f); g.fillRect(1, 5, T - 2, T - 10);
      g.fillStyle(0x8a5f3c); g.fillRect(1, 5, T - 2, 6); // counter top
      g.fillStyle(0x2a6e46); g.fillRect(8, 14, 16, 8); // plaque
      g.fillStyle(0x7ee787); g.fillRect(10, 17, 12, 2); // plaque text
      g.fillStyle(0xffd75e); g.fillRect(26, 7, 3, 3); // bell
    });

    // Water cooler.
    this.tex("tile-cooler", T, T, (g) => {
      g.fillStyle(0xe8dcc2); g.fillRect(0, 0, T, T);
      g.fillStyle(OUTLINE); g.fillRect(9, 1, 14, 29);
      g.fillStyle(0xe8e8f0); g.fillRect(10, 13, 12, 16);
      g.fillStyle(0x7ec8e3); g.fillRect(11, 2, 10, 11); // bottle
      g.fillStyle(0xb5e4f5); g.fillRect(12, 3, 3, 8); // water shine
      g.fillStyle(0x3a3f4a); g.fillRect(12, 18, 3, 3); g.fillRect(17, 18, 3, 3); // taps
    });

    // Copier.
    this.tex("tile-copier", T, T, (g) => {
      g.fillStyle(0xe8dcc2); g.fillRect(0, 0, T, T);
      g.fillStyle(OUTLINE); g.fillRect(3, 7, 26, 22);
      g.fillStyle(0xb0b0b8); g.fillRect(4, 8, 24, 20);
      g.fillStyle(0xd0d0d8); g.fillRect(4, 8, 24, 5); // lid
      g.fillStyle(0x88ee88); g.fillRect(7, 16, 6, 3); // display
      g.fillStyle(0x3a3f4a); g.fillRect(16, 16, 9, 3); // buttons
      g.fillStyle(0xf4f0e4); g.fillRect(8, 24, 16, 3); // paper tray
    });

    // ---- Floor 15 executive-office tiles (fancier than the open floors) ----

    // Executive wall — dark walnut panelling with a gold trim line + sconce glow.
    this.tex("tile-exec-wall", T, T, (g) => {
      g.fillStyle(0x3a2a22); g.fillRect(0, 0, T, T); // deep walnut
      g.fillStyle(0x4a362b); g.fillRect(0, 0, T, 9); // lit cap
      g.fillStyle(0x5a4234); g.fillRect(0, 0, T, 3); // top highlight
      g.fillStyle(0xc9a24b); g.fillRect(0, 9, T, 2); // gold trim line
      g.fillStyle(0xe0be6a); g.fillRect(0, 9, T, 1);
      g.fillStyle(0x2c1f19); g.fillRect(7, 13, 1, 13); g.fillRect(23, 13, 1, 13); // panel seams
      g.fillStyle(0xffe6a0, 0.25); g.fillCircle(16, 20, 5); // soft sconce glow
      g.fillStyle(0x1f1611); g.fillRect(0, T - 4, T, 4); // baseboard
    });

    // Executive desk — mahogany with a nameplate, lamp glow, and a document.
    this.tex("tile-exec-desk", T, T, (g) => {
      g.fillStyle(OUTLINE); g.fillRect(0, 2, T, T - 4);
      g.fillStyle(0x5a2f22); g.fillRect(1, 3, T - 2, T - 6); // mahogany
      g.fillStyle(0x7a4030); g.fillRect(1, 3, T - 2, 5); // lit top edge
      g.fillStyle(0x431f16); g.fillRect(1, T - 6, T - 2, 3); // shaded front
      g.fillStyle(0xc9a24b); g.fillRect(8, 12, 16, 5); // brass nameplate
      g.fillStyle(0xf0d485); g.fillRect(8, 12, 16, 1);
      g.fillStyle(0x2c1f19); g.fillRect(10, 14, 12, 1); // engraved line
      g.fillStyle(0xffe6a0, 0.5); g.fillCircle(6, 9, 4); // desk lamp glow
      g.fillStyle(0xffd75e); g.fillRect(4, 6, 4, 3); // lamp
      g.fillStyle(0xf4f0e4); g.fillRect(23, 18, 6, 7); // document
    });

    // Executive carpet — plush burgundy with a gold border (walkable rug).
    this.tex("tile-exec-carpet", T, T, (g) => {
      g.fillStyle(0x6a2130); g.fillRect(0, 0, T, T); // border
      g.fillStyle(0xc9a24b); g.fillRect(2, 2, T - 4, T - 4); // gold band
      g.fillStyle(0x7d2838); g.fillRect(4, 4, T - 8, T - 8); // field
      g.fillStyle(0x8e2f42); g.fillRect(13, 13, 6, 6); // center medallion
      g.fillStyle(0xc9a24b); g.fillRect(15, 15, 2, 2);
    });

    // Office chair — ergonomic back, seen from behind (NPCs face the viewer, so
    // the backrest + armrests frame the seated person).
    this.tex("tile-chair", T, T, (g) => {
      g.fillStyle(OUTLINE); g.fillRoundedRect(5, 2, 22, 23, 5);
      g.fillStyle(0x2f3440); g.fillRoundedRect(6, 3, 20, 21, 4); // backrest
      g.fillStyle(0x3d4453); g.fillRoundedRect(8, 5, 16, 9, 3); // upper cushion sheen
      g.fillStyle(0x232833); g.fillRect(3, 15, 4, 9); g.fillRect(25, 15, 4, 9); // armrests
      g.fillStyle(OUTLINE); g.fillRect(6, 22, 20, 3); // seat lip
      g.fillStyle(0x1a1d24); g.fillRect(14, 25, 4, 6); // stem
    });

    // Big cubicle workstation (48x34, spans wider than a tile) with an open
    // laptop and two hands on the keyboard. Two frames animate the hands so the
    // worker looks like they're typing. Drawn IN FRONT of the seated NPC.
    // The worker sits behind (north of) this desk facing DOWN toward it, so we
    // view the laptop from behind: the screen faces the worker, and we see the
    // dark back of the lid with light spilling up toward them. No disembodied
    // hands. The `f` frame flickers the screen glow so it reads as "working".
    const workDesk = (g: Phaser.GameObjects.Graphics, f: number) => {
      g.fillStyle(OUTLINE); g.fillRect(0, 8, 48, 26);
      g.fillStyle(0x9a6b40); g.fillRect(1, 9, 46, 24);        // desk wood
      g.fillStyle(0xb5834f); g.fillRect(1, 9, 46, 4);         // lit top edge
      g.fillStyle(0x845a34); g.fillRect(1, 30, 46, 3);        // shaded front
      g.fillStyle(0x7ec8e3, f ? 0.55 : 0.3); g.fillRect(15, 15, 18, 5); // screen glow spilling toward worker
      g.fillStyle(0xd6f2ff, f ? 0.5 : 0.25); g.fillRect(19, 15, 10, 3); // glow flicker
      g.fillStyle(OUTLINE); g.fillRect(15, 19, 18, 12);       // laptop lid, viewed from behind
      g.fillStyle(0x3a4150); g.fillRect(16, 20, 16, 10);      // lid back
      g.fillStyle(0x4a5364); g.fillRect(16, 20, 16, 2);       // lid top bevel
      g.fillStyle(f ? 0xbff0ff : 0x6aa6c0); g.fillCircle(24, 25, 2); // status/typing light
      g.fillStyle(0xf4f0e4); g.fillRect(3, 22, 7, 9);         // papers
      g.fillStyle(0xc9c2ae); g.fillRect(4, 24, 5, 1); g.fillRect(4, 27, 5, 1);
      g.fillStyle(OUTLINE); g.fillCircle(41, 25, 4);
      g.fillStyle(0xc0563a); g.fillCircle(41, 25, 3);         // coffee mug
    };
    this.tex("tile-work-0", 48, 34, (g) => workDesk(g, 0));
    this.tex("tile-work-1", 48, 34, (g) => workDesk(g, 1));

    // Matte-glass window (standard grey wall) — frosted panes, frame, faint skyline.
    this.tex("tile-window", T, T, (g) => {
      g.fillStyle(0x556077); g.fillRect(0, 0, T, T); // wall base (matches tile-wall)
      g.fillStyle(0x6b7691); g.fillRect(0, 0, T, 6);
      g.fillStyle(0x2c3242); g.fillRect(3, 5, 26, 22); // frame
      g.fillStyle(0x8fb8d6); g.fillRect(5, 7, 22, 18); // glass / sky
      g.fillStyle(0xa9cde4); g.fillRect(5, 7, 22, 6); // brighter sky top
      g.fillStyle(0x7aa6c6, 0.6); g.fillRect(6, 16, 5, 9); g.fillRect(14, 13, 4, 12); g.fillRect(21, 18, 4, 7); // skyline
      g.fillStyle(0xdff0fb, 0.35); g.fillRect(6, 8, 8, 3); // frosted glare
      g.fillStyle(0x2c3242); g.fillRect(15, 7, 2, 18); g.fillRect(5, 15, 22, 2); // mullions
      g.fillStyle(0x1f2430); g.fillRect(0, T - 5, T, 5); // baseboard
    });

    // Executive matte-glass window (walnut frame + gold sill) for F15/F16.
    this.tex("tile-exec-window", T, T, (g) => {
      g.fillStyle(0x3a2a22); g.fillRect(0, 0, T, T);
      g.fillStyle(0x4a362b); g.fillRect(0, 0, T, 6);
      g.fillStyle(0xc9a24b); g.fillRect(2, 6, 28, 1); // gold sill line
      g.fillStyle(0x2c1f19); g.fillRect(3, 7, 26, 20); // frame
      g.fillStyle(0x93b7d0); g.fillRect(5, 9, 22, 16); // glass
      g.fillStyle(0xb0d0e6); g.fillRect(5, 9, 22, 5); // sky top
      g.fillStyle(0x6f97b5, 0.6); g.fillRect(6, 17, 5, 8); g.fillRect(14, 14, 4, 11); g.fillRect(21, 19, 4, 6); // skyline
      g.fillStyle(0xe6d19a, 0.3); g.fillRect(6, 10, 7, 3); // warm frosted glare
      g.fillStyle(0x2c1f19); g.fillRect(15, 9, 2, 16); g.fillRect(5, 16, 22, 2); // mullions
      g.fillStyle(0x1f1611); g.fillRect(0, T - 4, T, 4);
    });

    // Executive office door — walnut with a gold plaque + handle. Drawn ABOVE
    // the frosted cover so the entrance stays visible from the corridor.
    this.tex("tile-exec-door", T, T, (g) => {
      g.fillStyle(0x2c1f19); g.fillRect(0, 0, T, T); // frame
      g.fillStyle(0x5a3d2b); g.fillRect(3, 2, 26, 28); // walnut door
      g.fillStyle(0x6e4c36); g.fillRect(3, 2, 26, 4); // lit top
      g.fillStyle(0xc9a24b); g.fillRect(8, 6, 16, 6); // gold plaque
      g.fillStyle(0x2c1f19); g.fillRect(10, 8, 12, 2); // engraving
      g.fillStyle(0xffd75e); g.fillCircle(24, 18, 2); // handle
      g.fillStyle(0x1f1611); g.fillRect(0, T - 3, T, 3);
    });

    this.tex("shadow", 20, 8, (g) => {
      g.fillStyle(0x000000, 0.25); g.fillEllipse(10, 4, 20, 8);
    });

    // Objective guide arrow (points right at rotation 0).
    this.tex("guide-arrow", 22, 16, (g) => {
      g.fillStyle(OUTLINE); g.fillTriangle(0, 0, 0, 16, 22, 8);
      g.fillStyle(0xffd75e); g.fillTriangle(2, 3, 2, 13, 18, 8);
    });
  }

  /** 20x28 pixel person, 4 directions x 2 walk frames, via the shared renderer. */
  private makeCharacter(key: string, opts: CharOpts, shirtOverride?: number) {
    for (const dir of DIRS) {
      for (const frame of [0, 1]) {
        this.tex(`${key}-${dir}-${frame}`, 20, 28, (g) => {
          drawCharacter((x, y, w, h, color, alpha = 1) => {
            g.fillStyle(color, alpha);
            g.fillRect(x, y, w, h);
          }, dir, frame, opts, shirtOverride);
        });
      }
    }
  }
}

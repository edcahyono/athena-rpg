/**
 * Start screen — (1) language choice EN/中文, (2) character creator with a
 * live pixel preview: gender, 20 hairstyles per gender (40 total) + hair
 * color, business-casual/smart-casual tops and bottoms with independent
 * type + color choices, shoes. No personality picker — appearance only.
 */
import { lang, setLang, hasChosenLang, L, UI, Lang } from "../i18n";
import { toggleFullscreen } from "../main";
import {
  drawToCanvas, SKIN_TONES, HAIR_COLORS, TOP_COLORS, BOTTOM_COLORS, SHOE_COLORS,
  hairstylesFor, topTypesFor, bottomTypesFor, Dir, Gender,
} from "../game/charDraw";
import { PlayerProfile, loadProfile, saveProfile } from "../game/profile";

const $ = (id: string) => document.getElementById(id)!;

export function chooseLanguage(): Promise<void> {
  return new Promise((resolve) => {
    if (hasChosenLang()) return resolve();
    const el = $("langselect");
    el.hidden = false;
    (el.querySelector("#lang-en") as HTMLButtonElement).onclick = () => pick("en");
    (el.querySelector("#lang-zh") as HTMLButtonElement).onclick = () => pick("zh");
    function pick(l: Lang) {
      setLang(l);
      el.hidden = true;
      resolve();
    }
  });
}

/**
 * Main menu / title screen — shown for returning players and as the
 * "quit to menu" landing. `returning` picks Continue vs Start wording.
 * Resolves when the player chooses to enter the game.
 */
export function mainMenu(returning: boolean): Promise<void> {
  return new Promise((resolve) => {
    const el = $("mainmenu");
    el.hidden = false;
    const cont = $("mm-continue") as HTMLButtonElement;
    const langBtn = $("mm-lang") as HTMLButtonElement;
    const fullBtn = $("mm-full") as HTMLButtonElement;
    const applyLabels = () => {
      $("mm-sub").textContent = L(UI.mmSub);
      cont.textContent = returning ? L(UI.mmContinue) : L(UI.mmStart);
      langBtn.textContent = L(UI.language);
      fullBtn.textContent = L(UI.fullscreen);
    };
    applyLabels();
    cont.onclick = () => { el.hidden = true; resolve(); };
    // The game hasn't booted yet, so nothing else is rendered in the old
    // language — just swap the labels in place. No reload, no glitch frame.
    langBtn.onclick = () => { setLang(lang === "en" ? "zh" : "en"); applyLabels(); };
    fullBtn.onclick = () => toggleFullscreen();
  });
}

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

export function characterCreator(): Promise<PlayerProfile> {
  return new Promise((resolve) => {
    const existing = loadProfile();
    if (existing) return resolve(existing);

    const p: PlayerProfile = {
      gender: "female", skin: 0, hairKey: hairstylesFor("female")[1].key, hair: 0,
      topType: "dressShirt", topColor: 0, bottomType: "dressPants", bottomColor: 0, shoes: 0,
    };
    const el = $("creator");
    el.hidden = false;
    $("creator-title").textContent = L(UI.createTitle);
    $("creator-start").textContent = L(UI.startGame);
    $("creator-random").textContent = L(UI.randomize);

    const canvas = $("creator-preview") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let dir: Dir = "down";
    let frame = 0;
    const redraw = () => drawToCanvas(ctx, dir, frame, p, 6);
    const spin: Dir[] = ["down", "left", "up", "right"];
    let spinI = 0;
    const iv = setInterval(() => {
      frame = frame ? 0 : 1;
      if (Math.random() < 0.15) { spinI = (spinI + 1) % 4; dir = spin[spinI]; }
      redraw();
    }, 350);

    const rows = $("creator-rows");

    const addSwatchRow = (label: string, colors: number[], get: () => number, set: (i: number) => void) => {
      const row = document.createElement("div");
      row.className = "cr-row";
      row.innerHTML = `<span class="cr-label">${label}</span>`;
      const box = document.createElement("div");
      box.className = "cr-opts";
      colors.forEach((c, i) => {
        const b = document.createElement("button");
        b.className = "cr-swatch";
        b.style.background = hex(c);
        b.onclick = () => { set(i); box.querySelectorAll("button").forEach((x, j) => x.classList.toggle("sel", j === i)); redraw(); };
        if (i === get()) b.classList.add("sel");
        box.appendChild(b);
      });
      row.appendChild(box);
      rows.appendChild(row);
    };

    const addTextRow = (label: string, options: { key: string; label: string }[], get: () => string, set: (k: string) => void) => {
      const row = document.createElement("div");
      row.className = "cr-row cr-row-wrap";
      row.innerHTML = `<span class="cr-label">${label}</span>`;
      const box = document.createElement("div");
      box.className = "cr-opts cr-opts-wrap";
      options.forEach((o) => {
        const b = document.createElement("button");
        b.className = "cr-text";
        b.textContent = o.label;
        b.onclick = () => { set(o.key); box.querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b)); redraw(); };
        if (o.key === get()) b.classList.add("sel");
        box.appendChild(b);
      });
      row.appendChild(box);
      rows.appendChild(row);
    };

    const build = () => {
      rows.innerHTML = "";
      addTextRow(L(UI.gender), [
        { key: "female", label: L(UI.female) }, { key: "male", label: L(UI.male) },
      ], () => p.gender, (k) => {
        p.gender = k as Gender;
        p.hairKey = hairstylesFor(p.gender)[0].key; // reset to a valid style for the new list
        // Wardrobe lists differ per gender — snap invalid picks to the first valid option.
        if (!topTypesFor(p.gender).some((t) => t.key === p.topType)) p.topType = topTypesFor(p.gender)[0].key;
        if (!bottomTypesFor(p.gender).some((t) => t.key === p.bottomType)) p.bottomType = bottomTypesFor(p.gender)[0].key;
        build();
      });
      addSwatchRow(L(UI.skin), SKIN_TONES, () => p.skin, (i) => (p.skin = i));
      const styles = hairstylesFor(p.gender);
      addTextRow(L(UI.hairstyle), styles.map((h) => ({ key: h.key, label: lang === "zh" ? h.zh : h.en })),
        () => p.hairKey, (k) => (p.hairKey = k));
      addSwatchRow(L(UI.hairColor), HAIR_COLORS, () => p.hair, (i) => (p.hair = i));
      addTextRow(L(UI.topType), topTypesFor(p.gender).map((t) => ({ key: t.key, label: lang === "zh" ? t.zh : t.en })),
        () => p.topType, (k) => (p.topType = k as any));
      addSwatchRow(L(UI.topColor), TOP_COLORS, () => p.topColor, (i) => (p.topColor = i));
      addTextRow(L(UI.bottomType), bottomTypesFor(p.gender).map((t) => ({ key: t.key, label: lang === "zh" ? t.zh : t.en })),
        () => p.bottomType, (k) => (p.bottomType = k as any));
      addSwatchRow(L(UI.bottomColor), BOTTOM_COLORS, () => p.bottomColor, (i) => (p.bottomColor = i));
      addSwatchRow(L(UI.shoes), SHOE_COLORS, () => p.shoes, (i) => (p.shoes = i));
      redraw();
    };
    build();

    ($("creator-random") as HTMLButtonElement).onclick = () => {
      p.gender = Math.random() < 0.5 ? "male" : "female";
      const styles = hairstylesFor(p.gender);
      p.hairKey = styles[Math.floor(Math.random() * styles.length)].key;
      p.skin = Math.floor(Math.random() * SKIN_TONES.length);
      p.hair = Math.floor(Math.random() * HAIR_COLORS.length);
      const tops = topTypesFor(p.gender), bottoms = bottomTypesFor(p.gender);
      p.topType = tops[Math.floor(Math.random() * tops.length)].key;
      p.topColor = Math.floor(Math.random() * TOP_COLORS.length);
      p.bottomType = bottoms[Math.floor(Math.random() * bottoms.length)].key;
      p.bottomColor = Math.floor(Math.random() * BOTTOM_COLORS.length);
      p.shoes = Math.floor(Math.random() * SHOE_COLORS.length);
      build();
    };

    // Back to the title screen — some players open the creator and change
    // their mind; without this they're trapped until they commit a character.
    ($("creator-back") as HTMLButtonElement).textContent = L(UI.creatorBack);
    ($("creator-back") as HTMLButtonElement).onclick = async () => {
      el.hidden = true;
      await mainMenu(false);
      $("creator-title").textContent = L(UI.createTitle); // labels may have changed language on the menu
      $("creator-start").textContent = L(UI.startGame);
      ($("creator-back") as HTMLButtonElement).textContent = L(UI.creatorBack);
      build();
      el.hidden = false;
    };

    ($("creator-start") as HTMLButtonElement).onclick = () => {
      clearInterval(iv);
      saveProfile(p);
      el.hidden = true;
      resolve(p);
    };
  });
}

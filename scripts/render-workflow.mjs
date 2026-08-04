/**
 * Render docs/WORKFLOW.md -> a paginated PDF + one PNG per Mermaid diagram.
 * Uses the system Chrome via puppeteer-core (no Chromium download).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { marked } from "marked";

const ROOT = "/Users/edcahyono/Downloads/athena-rpg";
const SRC = path.join(ROOT, "docs", "WORKFLOW.md");
const PDF_OUT = path.join(ROOT, "ATHENA-Workflow.pdf");
const PNG_DIR = path.join(ROOT, "docs", "workflow-png");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Served over http, not file://. Chrome blocks ES module imports from file://
// as a cross-origin request, so the whole page is served by a throwaway local
// server rooted at the repo. mermaid.min.js is unusable here regardless: it is
// an esbuild IIFE assigning to an internal namespace, not a module.
const MERMAID = "/node_modules/mermaid/dist/mermaid.esm.min.mjs";

fs.mkdirSync(PNG_DIR, { recursive: true });

// --- markdown -> html, turning ```mermaid fences into <div class="mermaid"> ---
const md = fs.readFileSync(SRC, "utf8");
const diagramTitles = [];
let idx = 0;

// Capture the nearest preceding "## n. Heading" for naming the PNG files.
const headingFor = (offset) => {
  const before = md.slice(0, offset);
  const hs = [...before.matchAll(/^##\s+(.+)$/gm)];
  return hs.length ? hs[hs.length - 1][1] : "diagram";
};
for (const m of md.matchAll(/```mermaid\n[\s\S]*?```/g)) {
  diagramTitles.push(headingFor(m.index));
}

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") {
        const i = idx++;
        return `<figure class="dwrap"><div class="mermaid" data-i="${i}">${text
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></figure>`;
      }
      return `<pre><code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`;
    },
  },
});

const bodyHtml = marked.parse(md);

const CSS = `
  @page { size: A3 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.55; color: #1a2230;
    margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1 { font-size: 26pt; color: #14294d; margin: 0 0 4pt; letter-spacing: -0.4pt; }
  h2 { font-size: 16pt; color: #14294d; margin: 26pt 0 8pt; padding-bottom: 4pt;
       border-bottom: 1.5px solid #c6d3e3; break-after: avoid; }
  h3 { font-size: 12pt; color: #23446f; margin: 14pt 0 5pt; break-after: avoid; }
  p { margin: 0 0 8pt; }
  hr { border: 0; border-top: 1px solid #e3e9f1; margin: 18pt 0; }
  code { font-family: "SF Mono", Menlo, monospace; font-size: 8.8pt;
         background: #eef2f7; padding: 1px 4px; border-radius: 3px; color: #1d3b63; }
  pre { background: #f5f8fb; border: 1px solid #e0e7f0; border-radius: 5px;
        padding: 9pt; overflow: hidden; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 9pt;
          break-inside: avoid; }
  th { background: #14294d; color: #fff; text-align: left; padding: 5pt 7pt; font-weight: 600; }
  td { border-bottom: 1px solid #e3e9f1; padding: 4.5pt 7pt; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafd; }
  ul, ol { margin: 0 0 9pt; padding-left: 17pt; }
  li { margin-bottom: 4pt; }
  strong { color: #0f2444; }
  .dwrap { margin: 12pt 0 16pt; padding: 10pt; background: #fbfcfe;
           border: 1px solid #e3e9f1; border-radius: 6px; text-align: center;
           break-inside: avoid; }
  .mermaid { display: inline-block; max-width: 100%; }
  .mermaid svg { max-width: 100%; height: auto; }
`;

/**
 * Two passes over the same markup.
 *   fit=true  -> useMaxWidth on, diagrams shrink to the page width. For the PDF.
 *   fit=false -> natural size, so each PNG is full resolution and tightly cropped.
 * One pass cannot serve both: scaling an SVG down for print also shrinks the
 * element box, which is what produced 190px-tall sequence-diagram screenshots.
 */
const buildPage = (fit) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
  ${fit ? "" : "body{background:#fff} .dwrap{display:inline-block;border:0;background:#fff;padding:14pt} .mermaid svg{max-width:none}"}
</style></head>
<body>${bodyHtml}
<script type="module">
  import mermaid from "${MERMAID}";
  mermaid.initialize({
    startOnLoad: false, theme: "base",
    flowchart: { htmlLabels: true, curve: "basis", useMaxWidth: ${fit} },
    sequence: { useMaxWidth: ${fit} },
    themeVariables: {
      fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif', fontSize: "14px",
      primaryColor: "#eaf1fa", primaryBorderColor: "#5b7c99", primaryTextColor: "#14294d",
      lineColor: "#5b7c99", secondaryColor: "#f3f6fa", tertiaryColor: "#fdf6e8",
      clusterBkg: "#f7f9fc", clusterBorder: "#c6d3e3",
    },
  });
  await mermaid.run({ querySelector: ".mermaid" });
  window.__done = true;
</script></body></html>`;

const tmpHtml = path.join(ROOT, ".workflow-render.html");

const MIME = { ".mjs": "text/javascript", ".js": "text/javascript", ".html": "text/html" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
  const file = path.join(ROOT, rel);
  // Never serve outside the repo root.
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });

async function open(fit, width) {
  fs.writeFileSync(tmpHtml, buildPage(fit));
  const p = await browser.newPage();
  // Surface in-page failures: a silent mermaid throw otherwise shows up only as
  // an opaque waitForFunction timeout 60 seconds later.
  p.on("pageerror", (e) => console.log(`  [pageerror] ${String(e).slice(0, 400)}`));
  await p.setViewport({ width, height: 1200, deviceScaleFactor: 2 });
  await p.goto(`http://127.0.0.1:${PORT}/.workflow-render.html`, { waitUntil: "networkidle0" });
  await p.waitForFunction("window.__done === true", { timeout: 90000 });
  return p;
}

// --- pass 1: PDF, diagrams fitted to the page ---
const pPdf = await open(true, 1500);
console.log(`pass 1 (pdf):  ${await pPdf.$$eval(".mermaid svg", (e) => e.length)} diagrams`);
await pPdf.pdf({ path: PDF_OUT, format: "A3", printBackground: true,
  margin: { top: "14mm", right: "12mm", bottom: "14mm", left: "12mm" } });
await pPdf.close();

// --- pass 2: PNGs, natural size, cropped to the SVG itself ---
const pPng = await open(false, 3400);
const svgs = await pPng.$$(".mermaid svg");
console.log(`pass 2 (png):  ${svgs.length} diagrams`);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 46);
const names = [];
for (let i = 0; i < svgs.length; i++) {
  const name = `${String(i + 1).padStart(2, "0")}-${slug(diagramTitles[i] || "diagram")}.png`;
  await svgs[i].screenshot({ path: path.join(PNG_DIR, name) });
  names.push(name);
}

await browser.close();
server.close();
fs.rmSync(tmpHtml, { force: true });

console.log(`\nPDF : ${PDF_OUT} (${(fs.statSync(PDF_OUT).size / 1024).toFixed(0)} KB)`);
console.log(`PNGs: ${PNG_DIR}`);
for (const n of names) {
  console.log(`   ${n}  ${(fs.statSync(path.join(PNG_DIR, n)).size / 1024).toFixed(0)} KB`);
}

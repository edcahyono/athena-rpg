import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("\n[WARN] ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.\n");
}

const { default: gameRouter } = await import("./game/routes.js");
const { loadStores } = await import("./rag/retriever.js");
const { loadSessions } = await import("./game/sessionStore.js");
const { getUsage } = await import("./anthropic.js");
const { requireAdminAuth } = await import("./middleware/auth.js");

const PORT = Number(process.env.PORT || 3002);

const app = express();
app.use(cors());
app.use(express.json({ limit: "18mb" })); // large enough for base64 deck uploads (/extract-text)
app.set("trust proxy", 1);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/game", gameRouter);

// Usage & cost dashboard — separate admin site (like the coach console).
// Page is public; the data endpoint requires COACH_ADMINS basic auth.
app.get("/usage", (_req, res) => res.sendFile(path.join(__dirname, "usage", "usage.html")));
app.get("/api/usage-data", requireAdminAuth, (_req, res) => res.json(getUsage()));

// Serve the built game in production (same-origin).
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

loadStores();
loadSessions();

app.listen(PORT, () => console.log(`ATHENA RPG server on http://localhost:${PORT}`));

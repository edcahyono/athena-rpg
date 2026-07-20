/**
 * CLI wrapper: `npm run ingest`. Core logic lives in ingestCore.js so the
 * coach tool can re-run ingestion in-process.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const { runIngestion } = await import("./ingestCore.js");
runIngestion().catch((e) => {
  console.error(e);
  process.exit(1);
});

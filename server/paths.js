/**
 * Single source of truth for every path the server WRITES to at runtime.
 *
 * On a normal host these live inside the repo, which is fine — the checkout is
 * the disk. On Render the filesystem is ephemeral: anything written at runtime
 * is discarded on the next deploy or restart. That silently reverts learner
 * progress AND any content a coach saved through the console, with no error
 * anywhere to explain it.
 *
 * Set DATA_DIR to a mounted persistent disk (Render: Starter or above, mounted
 * at e.g. /var/data) and all of them move there. Leave it unset and behaviour
 * is byte-for-byte what it was before this module existed.
 *
 * The repo copies stay the SEED: on first boot against an empty disk they are
 * copied across, so a fresh deploy starts with the committed corpus rather than
 * an empty knowledge base. After that the disk is authoritative and the repo
 * copies are ignored — a later deploy will NOT overwrite a coach's edits.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo-relative defaults, also used as first-boot seed content. */
const REPO = {
  sessions: path.join(__dirname, "data", "sessions.json"),
  qaSource: path.join(__dirname, "data", "qa", "qa.source.json"),
  ragStore: path.join(__dirname, "rag", "store"),
};

const DATA_DIR = (process.env.DATA_DIR || "").trim();
export const usingPersistentDisk = !!DATA_DIR;

const root = DATA_DIR ? path.resolve(DATA_DIR) : null;

export const SESSIONS_FILE = root ? path.join(root, "sessions.json") : REPO.sessions;
export const QA_SOURCE_FILE = root ? path.join(root, "qa", "qa.source.json") : REPO.qaSource;
export const RAG_STORE_DIR = root ? path.join(root, "rag-store") : REPO.ragStore;

/**
 * Copy the committed corpus onto an empty persistent disk. Only ever fills
 * gaps — an existing file on the disk is left strictly alone, because it is by
 * definition newer than the repo copy (a coach wrote it).
 *
 * sessions.json is deliberately NOT seeded: the repo copy is local test data,
 * and a production deploy should start with no sessions rather than inherit
 * someone's debugging leftovers.
 */
export function seedDataDir(log = console.log) {
  if (!root) return;
  fs.mkdirSync(path.dirname(QA_SOURCE_FILE), { recursive: true });
  fs.mkdirSync(RAG_STORE_DIR, { recursive: true });

  if (!fs.existsSync(QA_SOURCE_FILE) && fs.existsSync(REPO.qaSource)) {
    fs.copyFileSync(REPO.qaSource, QA_SOURCE_FILE);
    log(`[data] seeded qa.source.json into ${QA_SOURCE_FILE}`);
  }
  if (fs.existsSync(REPO.ragStore) && !fs.readdirSync(RAG_STORE_DIR).length) {
    for (const f of fs.readdirSync(REPO.ragStore)) {
      if (f.endsWith(".json")) fs.copyFileSync(path.join(REPO.ragStore, f), path.join(RAG_STORE_DIR, f));
    }
    log(`[data] seeded RAG store into ${RAG_STORE_DIR}`);
  }
  log(`[data] persistent disk in use: ${root}`);
}

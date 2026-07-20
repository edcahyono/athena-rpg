/**
 * Grader calibration harness — runs a fixed set of sample answers
 * (great/mediocre/bad) through the EXACT production grading prompt
 * (server/game/grading.js) several times each, then reports:
 *   - consistency: does the same answer get the same verdict every run?
 *   - accuracy:    does the majority verdict match the human expectation?
 *
 * Usage:  npm run eval:grader          (3 runs per sample)
 *         npm run eval:grader -- 5     (5 runs per sample)
 *
 * Re-run whenever the grading prompt, rubric, or model changes.
 * Samples live in server/eval/samples.json — placeholders until the program
 * owner supplies real great/mediocre/bad answers per track.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const { gradeQuizAnswers } = await import("../game/grading.js");

const RUNS = Math.max(1, Math.min(10, Number(process.argv[2]) || 3));
const { samples } = JSON.parse(fs.readFileSync(path.join(__dirname, "samples.json"), "utf8"));

console.log(`\nGrader calibration — ${samples.length} samples × ${RUNS} runs (model: ${process.env.LIGHT_MODEL || "claude-sonnet-5"})\n`);

let consistent = 0;
let accurate = 0;

for (const sample of samples) {
  const qa = sample.questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${sample.answers[i]}`).join("\n\n");
  const verdicts = [];
  for (let r = 0; r < RUNS; r++) {
    try {
      const { grade } = await gradeQuizAnswers(sample.convo, qa, "en");
      verdicts.push(grade);
    } catch (e) {
      verdicts.push(`ERROR:${e.message}`);
    }
  }
  const counts = {};
  for (const v of verdicts) counts[v] = (counts[v] || 0) + 1;
  const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const isConsistent = new Set(verdicts).size === 1;
  const isAccurate = majority === sample.expect;
  if (isConsistent) consistent++;
  if (isAccurate) accurate++;

  const flag = isAccurate ? (isConsistent ? "✓ " : "~ ") : "✗ ";
  console.log(
    `${flag}${sample.id.padEnd(34)} expect=${sample.expect.padEnd(8)} got=[${verdicts.join(", ")}]` +
    (isConsistent ? "" : "  ← INCONSISTENT") + (isAccurate ? "" : "  ← WRONG VERDICT")
  );
}

console.log(`\nConsistency: ${consistent}/${samples.length} samples gave the same verdict on every run`);
console.log(`Accuracy:    ${accurate}/${samples.length} majority verdicts matched expectations\n`);
if (accurate < samples.length) process.exitCode = 1;

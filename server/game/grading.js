/**
 * Shared grading logic — used by the live /gatekeeper/grade endpoint AND the
 * offline eval harness (server/eval/graderEval.js), so calibration tests run
 * through the exact same prompt as production.
 */
import { callAnthropic, LIGHT_MODEL, parseModelJson } from "../anthropic.js";

/**
 * Grade a 2-question exit quiz.
 * @param convo   plain-text transcript of the gatekeeper conversation (or "(no prior conversation)")
 * @param qa      "Q1: ...\nA1: ...\n\nQ2: ...\nA2: ..." block
 * @param lang    "en" | "zh" — language for the feedback sentence
 * @returns { grade: "pass"|"partial"|"fail", feedback: string }
 */
export async function gradeQuizAnswers(convo, qa, lang = "en") {
  const out = await callAnthropic({
    model: LIGHT_MODEL,
    max_tokens: 300,
    system:
      `You grade a trainee consultant's answers to a 2-question exit quiz about Nike Greater China, based on a conversation they just had with a Deloitte domain manager. Answers may be in English or Chinese.\n` +
      `CONVERSATION CONTEXT:\n${convo.slice(0, 2000)}\n\n` +
      `Grade fairly but with a real bar — this check gates access to a senior executive, so reward genuine understanding and reject bluffing.\n` +
      `- PASS if BOTH answers get the CORE facts and direction right, showing the learner genuinely grasped the main points (the key number/cause/trade-off). Minor missing nuance is fine — do NOT withhold a pass over one small omission if the central idea is correct.\n` +
      `- PARTIAL if one answer is solid but the other is vague, off-topic, or misses the central point entirely.\n` +
      `- FAIL if the answers are generic filler, guessed, evasive, empty, or state a case fact backwards. Confidently wrong is worse than vague. Never give credit for plausible-sounding non-answers.\n` +
      `Then write specific feedback: name what was right, and for anything short of PASS, point at WHICH question falls short and what KIND of thing is missing (a number, a cause, a trade-off) — but NEVER state the correct answer or the missing fact itself. The learner must go dig it out of their notes or the conversation; feedback that hands them the answer defeats the check. ` +
      `Reply with ONLY JSON: {"grade":"pass"|"partial"|"fail","feedback":"<two specific sentences, written in ${lang === "zh" ? "Simplified Chinese" : "English"}>"}`,
    messages: [{ role: "user", content: qa }],
  });
  // Default to FAIL on unparseable output — never award credit for garbage.
  let grade = "fail";
  let feedback = lang === "zh" ? "我没太看懂你的回答——再具体讲一遍。" : "I couldn't follow that — walk me through it again, specifically.";
  const parsed = parseModelJson(out);
  if (["pass", "partial", "fail"].includes(parsed.grade)) grade = parsed.grade;
  if (typeof parsed.feedback === "string") feedback = parsed.feedback.slice(0, 500);
  return { grade, feedback };
}

/**
 * Bilingual tokenizer for BM25 retrieval.
 * - English/latin words and numbers → lowercased tokens
 * - CJK runs → character unigrams AND bigrams (standard approach for
 *   dictionary-free Chinese retrieval; bigrams carry most of the signal)
 */
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;

const STOP = new Set([
  "to","you","your","the","a","an","of","in","and","or","is","are","was","were","for","on","at",
  "it","its","we","our","with","that","this","these","those","what","how","why","do","does","did",
  "i","me","my","be","been","as","by","from","has","have","had","not","no","so","if","can","could",
  "should","would","will","about","there","their","they","them","he","she","his","her","but","into",
  "nice","hello","hi","thanks","thank","please","meet","am","us","who","when","where","which",
]);

export function tokenize(text) {
  if (!text) return [];
  const tokens = [];
  const norm = text.toLowerCase();
  let latin = "";
  let cjkRun = [];

  const flushLatin = () => {
    if ((latin.length > 1 || /\d/.test(latin)) && !STOP.has(latin)) tokens.push(latin);
    latin = "";
  };
  const flushCjk = () => {
    if (cjkRun.length === 1) {
      tokens.push(cjkRun[0]); // isolated character — keep as-is
    } else {
      for (let i = 0; i + 1 < cjkRun.length; i++) {
        tokens.push(cjkRun[i] + cjkRun[i + 1]); // bigrams only: far less noise than unigrams
      }
    }
    cjkRun = [];
  };

  for (const ch of norm) {
    if (CJK.test(ch)) {
      flushLatin();
      cjkRun.push(ch);
    } else if (/[a-z0-9%.\-']/.test(ch)) {
      flushCjk();
      latin += ch;
    } else {
      flushLatin();
      flushCjk();
    }
  }
  flushLatin();
  flushCjk();
  return tokens;
}

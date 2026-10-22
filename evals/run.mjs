// Runs every case in evals/suggestions.json through /api/suggest and scores it.
// Needs the dev server with OPENAI_API_KEY: `npm run dev` in one terminal, `npm run eval` in another.
import { readFile } from "node:fs/promises";
import { printReport, score } from "./score.mjs";

const BASE = process.env.EVAL_BASE_URL ?? "http://localhost:3000";
const cases = JSON.parse(await readFile(new URL("./suggestions.json", import.meta.url), "utf8"));

async function suggest({ question, answer }) {
  const res = await fetch(`${BASE}/api/suggest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ questionId: question, transcript: answer }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.suggestion?.choice ?? null;
}

// Network hiccups (a slow proxy, a 429) shouldn't count against the model.
async function withRetry(c, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await suggest(c);
    } catch (e) {
      if (attempt >= tries) return { error: e.message };
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

// A few requests at a time keeps the run short without tripping rate limits.
const results = new Array(cases.length);
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < cases.length) {
      const i = next++;
      results[i] = await withRetry(cases[i]);
    }
  }),
);

printReport(`Model via ${BASE}/api/suggest`, score(cases, results));

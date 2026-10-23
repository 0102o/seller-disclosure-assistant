import "server-only";
import { SUGGESTION_SCHEMA } from "./suggestion";

// Everything that touches the OpenAI key lives in this server-only module.
// Importing it from client code fails the build.

const API = "https://api.openai.com/v1";

export type VoiceErrorCode = "not_configured" | "bad_audio" | "busy" | "unavailable";

export class VoiceError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    readonly status: number,
  ) {
    super(code);
  }
}

export function voiceConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new VoiceError("not_configured", 503);
  return key;
}

/** Turns a provider failure into one of a few states the UI knows how to explain. */
async function providerError(res: Response): Promise<VoiceError> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  // Log the status and error code only, never audio or transcripts.
  console.warn(`[openai] ${res.status} ${body?.error?.code ?? ""}`.trim());
  if (res.status === 400) return new VoiceError("bad_audio", 422);
  if (res.status === 429) return new VoiceError("busy", 429);
  // Bad key, no access to the model, or an unknown model: retrying won't help.
  if ([401, 403, 404].includes(res.status)) return new VoiceError("not_configured", 503);
  return new VoiceError("unavailable", 502);
}

// A dropped connection is retried once. A timeout isn't (the homeowner can tap Try
// again instead of waiting twice as long), and neither is an HTTP error response.
async function call(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    try {
      return await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const { name, cause } = error as { name?: string; cause?: { code?: string } };
      // What failed and how fast, never the request itself.
      console.warn(
        `[openai] ${path} ${[name, cause?.code].filter(Boolean).join(" ")} after ${Date.now() - started} ms (attempt ${attempt})`,
      );
      if (name === "TimeoutError" || attempt === 2) throw new VoiceError("unavailable", 504);
    }
  }
}

/** Batch transcription of a recorded answer: POST /v1/audio/transcriptions. */
export async function transcribeFile(
  file: File,
  hints: { prompt: string; keywords: string[] },
): Promise<string> {
  const key = apiKey();
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe";

  const form = new FormData();
  form.append("model", model);
  form.append("file", file, file.name);
  form.append("prompt", hints.prompt);
  if (model === "gpt-transcribe") {
    // gpt-transcribe takes languages[] and keywords[]; older models take language.
    form.append("languages[]", "en");
    for (const keyword of hints.keywords) form.append("keywords[]", keyword);
  } else {
    form.append("language", "en");
  }

  const res = await call(
    "/audio/transcriptions",
    { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form },
    45_000, // up to two minutes of audio, sometimes over a slow link
  );
  if (!res.ok) throw await providerError(res);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

const SUGGEST_INSTRUCTIONS = `You help a home seller fill in a property disclosure form. You get one question, a plain-language note on what it covers, and the seller's spoken answer as a transcript. Say which answer the seller gave. The seller will confirm or change it, so when the answer is unclear, say so instead of guessing.

Choices:
- "yes": the seller describes anything the question covers, now or in the past, even if it was minor or has been fixed, or simply says yes.
- "no": the seller says it hasn't happened or isn't an issue, and mentions nothing the question covers. "Not that I know of" counts as no.
- "not_sure": the seller says they don't know or aren't sure, or only believes or guesses ("I think so", "I don't think so", "maybe").
- "unclear": the answer doesn't address the question, asks something back, or declines to answer.

Rules:
- If the seller mentions anything the question covers, the answer is "yes", even if they started with "no" or say it was fixed.
- Never answer "no" when the seller hedges about whether it happened; use "not_sure".
- Problems at someone else's property don't count.
- If the seller corrects themselves, use their final answer.
- "evidence" is the shortest phrase from the transcript that supports the choice, copied exactly, word for word. Use "" for "unclear".`;

/**
 * Asks a small model which answer a spoken response gives (POST /v1/responses with
 * Structured Outputs). Returns the raw response; readSuggestion() decides whether to trust it.
 */
export async function requestSuggestion(
  question: { prompt: string; covers: string },
  transcript: string,
): Promise<unknown> {
  const key = apiKey();
  const res = await call(
    "/responses",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SUGGEST_MODEL || "gpt-6-luna",
        reasoning: { effort: "none" },
        temperature: 0, // same transcript, same suggestion
        store: false, // don't keep the seller's words on OpenAI's side for later retrieval
        max_output_tokens: 200,
        instructions: SUGGEST_INSTRUCTIONS,
        input: `Question: ${question.prompt}\nWhat it covers: ${question.covers}\nSeller's answer: """${transcript}"""`,
        text: {
          format: {
            type: "json_schema",
            name: "disclosure_suggestion",
            strict: true,
            schema: SUGGESTION_SCHEMA,
          },
        },
      }),
    },
    15_000,
  );
  if (!res.ok) throw await providerError(res);
  return res.json();
}

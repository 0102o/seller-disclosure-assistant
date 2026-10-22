import "server-only";

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

async function call(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    console.warn(`[openai] ${path} network error or timeout`);
    throw new VoiceError("unavailable", 504);
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
    30_000,
  );
  if (!res.ok) throw await providerError(res);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

import { transcribeFile, VoiceError, voiceConfigured } from "@/lib/openai";
import { getQuestion, isQuestionId } from "@/lib/questions";
import { isSameOrigin } from "@/lib/same-origin";

// A 2-minute Opus recording is about 1-2 MB; OpenAI's own limit is 25 MB.
const MAX_BYTES = 10 * 1024 * 1024;
const MIN_BYTES = 1_000;

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};

const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Lets the UI know up front whether voice answers are available on this server. */
export async function GET() {
  return Response.json({ configured: voiceConfigured() });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail("forbidden", 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 64_000) {
    return fail("too_long", 413);
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const questionId = String(form?.get("questionId") ?? "");
  if (!(audio instanceof File) || !isQuestionId(questionId)) return fail("bad_request", 400);
  if (audio.size < MIN_BYTES) return fail("too_short", 422);
  if (audio.size > MAX_BYTES) return fail("too_long", 413);

  // OpenAI detects the format from the file name, so make the extension match
  // the container the browser actually recorded (webm in Chrome/Firefox, mp4 in older Safari).
  const type = audio.type.split(";")[0];
  const extension = EXTENSIONS[type];
  if (!extension) return fail("bad_audio", 415);
  const file = new File([audio], `answer.${extension}`, { type });

  const question = getQuestion(questionId);
  try {
    const text = await transcribeFile(file, {
      prompt: `A homeowner is answering a seller disclosure question: "${question.prompt}"`,
      keywords: question.keywords,
    });
    return Response.json({ text });
  } catch (error) {
    if (error instanceof VoiceError) return fail(error.code, error.status);
    throw error;
  }
}

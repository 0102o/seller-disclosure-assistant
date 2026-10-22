import { requestSuggestion, VoiceError } from "@/lib/openai";
import { getQuestion, isQuestionId } from "@/lib/questions";
import { isSameOrigin } from "@/lib/same-origin";
import { readSuggestion } from "@/lib/suggestion";

const MAX_TRANSCRIPT = 4_000;

const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * Suggests Yes / No / Not sure for a transcript. Kept separate from /api/transcribe
 * so the transcript can be shown while this is still working. Any failure just
 * means "no suggestion" in the UI.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail("forbidden", 403);

  const body = (await request.json().catch(() => null)) as
    | { questionId?: unknown; transcript?: unknown }
    | null;
  const questionId = String(body?.questionId ?? "");
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  if (!isQuestionId(questionId) || !transcript || transcript.length > MAX_TRANSCRIPT) {
    return fail("bad_request", 400);
  }

  const question = getQuestion(questionId);
  try {
    const response = await requestSuggestion(
      { prompt: question.prompt, covers: question.hint.meaning },
      transcript,
    );
    return Response.json({ suggestion: readSuggestion(response, transcript) });
  } catch (error) {
    if (error instanceof VoiceError) return fail(error.code, error.status);
    throw error;
  }
}

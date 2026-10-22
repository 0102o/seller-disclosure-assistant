import type { Recording } from "@/hooks/useRecorder";
import type { QuestionId } from "./questions";

const CODES = [
  "not_configured",
  "bad_audio",
  "too_short",
  "too_long",
  "busy",
  "unavailable",
  "network",
] as const;
export type TranscribeErrorCode = (typeof CODES)[number];

export class TranscribeError extends Error {
  constructor(readonly code: TranscribeErrorCode) {
    super(code);
  }
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

/** Sends a recorded answer to our server, which calls the transcription API with the secret key. */
export async function transcribeRecording(
  recording: Recording,
  questionId: QuestionId,
): Promise<string> {
  const body = new FormData();
  body.append("audio", recording.blob, `answer.${extensionFor(recording.mimeType)}`);
  body.append("questionId", questionId);

  let res: Response;
  try {
    res = await fetch("/api/transcribe", { method: "POST", body });
  } catch {
    throw new TranscribeError("network");
  }
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) {
    const code = CODES.find((c) => c === data.error) ?? "unavailable";
    throw new TranscribeError(code);
  }
  return (data.text ?? "").trim();
}

let configured: Promise<boolean> | null = null;

/** Whether this server has a transcription key. Asked once per page load. */
export function voiceAvailable(): Promise<boolean> {
  configured ??= fetch("/api/transcribe")
    .then((res) => res.json())
    .then((data: { configured?: boolean }) => data.configured === true)
    .catch(() => true); // If the check itself fails, let the recording attempt explain.
  return configured;
}

import { CHOICES, type Answer, type Answers, type Choice } from "./answers";
import { isQuestionId } from "./questions";

export const STORAGE_KEY = "seller-disclosure";
const VERSION = 1;

type Envelope = { version: number; savedAt: string; answers: unknown };

/**
 * Reads saved answers. Anything missing, corrupt or from an unknown version
 * comes back as "no answers" instead of crashing the app.
 */
export function loadAnswers(storage: Pick<Storage, "getItem"> | null): Answers {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const envelope = JSON.parse(raw) as Envelope;
    // A future version 2 would migrate here before falling through.
    if (envelope?.version !== VERSION) return {};
    return sanitize(envelope.answers);
  } catch {
    return {};
  }
}

/** Returns false when the browser refuses to store data (private mode, full quota). */
export function saveAnswers(
  storage: Pick<Storage, "setItem"> | null,
  answers: Answers,
  savedAt: string,
): boolean {
  if (!storage) return false;
  const envelope: Envelope = { version: VERSION, savedAt, answers };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

function sanitize(value: unknown): Answers {
  if (typeof value !== "object" || value === null) return {};
  const answers: Answers = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!isQuestionId(id) || typeof entry !== "object" || entry === null) continue;
    const e = entry as Partial<Answer>;
    answers[id] = {
      choice: CHOICES.includes(e.choice as Choice) ? (e.choice as Choice) : null,
      note: typeof e.note === "string" ? e.note : "",
      usedVoice: e.usedVoice === true,
      updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : "",
    };
  }
  return answers;
}

import { QUESTIONS, type QuestionId } from "./questions";

export const CHOICES = ["yes", "no", "not_sure"] as const;
export type Choice = (typeof CHOICES)[number];

export const CHOICE_LABEL: Record<Choice, string> = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure",
};

export type Answer = {
  /** null while the homeowner has written notes but not picked an answer yet. */
  choice: Choice | null;
  /** The homeowner's own words. Never rewritten by the app. */
  note: string;
  /** Whether any of the note came from a voice transcription (useful to the agent). */
  usedVoice: boolean;
  updatedAt: string;
};

export type Answers = Partial<Record<QuestionId, Answer>>;

export type Action =
  | { type: "choose"; id: QuestionId; choice: Choice; at: string }
  | { type: "editNote"; id: QuestionId; note: string; at: string }
  | { type: "addTranscript"; id: QuestionId; text: string; at: string }
  | { type: "reset" };

const EMPTY: Omit<Answer, "updatedAt"> = { choice: null, note: "", usedVoice: false };

export function answersReducer(state: Answers, action: Action): Answers {
  switch (action.type) {
    case "choose":
      return update(state, action.id, action.at, () => ({ choice: action.choice }));
    case "editNote":
      return update(state, action.id, action.at, () => ({ note: action.note }));
    case "addTranscript": {
      const text = action.text.trim();
      if (!text) return state;
      return update(state, action.id, action.at, (prev) => ({
        note: prev.note.trim() ? `${prev.note.trimEnd()}\n${text}` : text,
        usedVoice: true,
      }));
    }
    case "reset":
      return {};
  }
}

function update(
  state: Answers,
  id: QuestionId,
  at: string,
  change: (prev: Omit<Answer, "updatedAt">) => Partial<Answer>,
): Answers {
  const prev = state[id] ?? EMPTY;
  return { ...state, [id]: { ...prev, ...change(prev), updatedAt: at } };
}

/** A question counts as answered once Yes, No or Not sure is picked. Notes alone don't count. */
export function isAnswered(answer: Answer | undefined): answer is Answer & { choice: Choice } {
  return answer?.choice != null;
}

/** Yes answers usually need an explanation; the TDS asks sellers to explain every Yes. */
export function needsDetail(answer: Answer | undefined): boolean {
  return answer?.choice === "yes" && answer.note.trim() === "";
}

export type Progress = {
  answered: number;
  total: number;
  remaining: number;
  percent: number;
  /** Answered "Not sure": counted as answered, but the agent should follow up. */
  followUps: number;
  nextUnanswered: QuestionId | null;
};

export function getProgress(answers: Answers): Progress {
  const total = QUESTIONS.length;
  const answered = QUESTIONS.filter((q) => isAnswered(answers[q.id])).length;
  return {
    answered,
    total,
    remaining: total - answered,
    percent: Math.round((answered / total) * 100),
    followUps: QUESTIONS.filter((q) => answers[q.id]?.choice === "not_sure").length,
    nextUnanswered: QUESTIONS.find((q) => !isAnswered(answers[q.id]))?.id ?? null,
  };
}

export type OverallStatus = "not_started" | "in_progress" | "complete";

export function getStatus(progress: Progress): OverallStatus {
  if (progress.answered === 0) return "not_started";
  return progress.remaining === 0 ? "complete" : "in_progress";
}

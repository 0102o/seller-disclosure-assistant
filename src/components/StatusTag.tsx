import { CHOICE_LABEL, isAnswered, type Answer } from "@/lib/answers";

export function StatusTag({ answer }: { answer: Answer | undefined }) {
  if (!isAnswered(answer)) return <span className="tag tag--unanswered">Not answered</span>;
  if (answer.choice === "not_sure") {
    return <span className="tag tag--follow-up">Not sure · follow up</span>;
  }
  return <span className="tag tag--answered">{CHOICE_LABEL[answer.choice]}</span>;
}

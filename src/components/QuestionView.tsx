"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  CHOICE_LABEL,
  CHOICES,
  isAnswered,
  needsDetail,
  type Answer,
  type Choice,
} from "@/lib/answers";
import { disclosureActions, useDisclosure, type StoreState } from "@/lib/answers-store";
import { getQuestion, QUESTIONS, questionNumber, type QuestionId } from "@/lib/questions";
import { Loading } from "./Loading";
import { VoiceAnswer } from "./VoiceAnswer";
import styles from "./QuestionView.module.css";

const NOTE_HELP: Record<Exclude<Choice, "yes">, string> = {
  no: "Optional. Anything your agent should know?",
  not_sure: "What have you noticed, and what are you unsure about?",
};

export function QuestionView({ id, fromReview }: { id: QuestionId; fromReview: boolean }) {
  const store = useDisclosure();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  if (!store) return <Loading />;

  const question = getQuestion(id);
  const number = questionNumber(id);
  const answer = store.answers[id];
  const choice = answer?.choice ?? null;
  const noteHelp =
    choice === null
      ? "You can describe things first and pick an answer after."
      : choice === "yes"
        ? question.yesPrompt
        : NOTE_HELP[choice];

  return (
    <>
      <QuestionSteps current={id} answers={store.answers} />

      <section className="card">
        <fieldset className={styles.fieldset} aria-describedby="meaning">
          <legend className={styles.legend}>
            <span className="eyebrow">
              Question {number} of {QUESTIONS.length}
            </span>
            <h1 className={styles.prompt}>{question.prompt}</h1>
          </legend>
          <p id="meaning" className={styles.meaning}>
            {question.hint.meaning}
          </p>
          <details className={styles.hint}>
            <summary>Examples and tips</summary>
            <div className={styles.hintBody}>
              <p className={styles.hintLabel}>For example</p>
              <ul>
                {question.hint.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
              <p>
                <span className={styles.hintLabel}>Not sure? </span>
                {question.hint.unsure}
              </p>
              <p className="small muted">
                General guidance, not legal advice. Your agent can help with specific questions.
              </p>
            </div>
          </details>
          <div className={styles.choices}>
            {CHOICES.map((c) => (
              <label key={c} className={styles.choice}>
                <input
                  type="radio"
                  name="choice"
                  value={c}
                  checked={choice === c}
                  onChange={() => disclosureActions.choose(id, c)}
                />
                <span>{CHOICE_LABEL[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.details}>
          <label htmlFor="note" className={styles.noteLabel}>
            Details <span className="muted">(optional)</span>
          </label>
          <p id="note-help" className="small muted">
            {noteHelp}
          </p>
          <textarea
            id="note"
            ref={noteRef}
            className={styles.textarea}
            aria-describedby="note-help"
            rows={4}
            value={answer?.note ?? ""}
            onChange={(e) => disclosureActions.editNote(id, e.target.value)}
          />
          {needsDetail(answer) && (
            <p className="small callout callout--warn">
              A short explanation helps here. Your agent will need one for every Yes.
            </p>
          )}
          <VoiceAnswer
            questionId={id}
            currentChoice={choice}
            onAdded={() => noteRef.current?.focus()}
          />
        </div>

        <SaveStatus store={store} />
      </section>

      <QuestionNav id={id} fromReview={fromReview} answered={isAnswered(answer)} />
    </>
  );
}

function QuestionSteps({
  current,
  answers,
}: {
  current: QuestionId;
  answers: Partial<Record<QuestionId, Answer>>;
}) {
  return (
    <nav aria-label="Questions">
      <ol className={styles.steps}>
        {QUESTIONS.map((q, i) => {
          const answer = answers[q.id];
          const state = !isAnswered(answer)
            ? "unanswered"
            : answer.choice === "not_sure"
              ? "followUp"
              : "answered";
          const label = { unanswered: "not answered", followUp: "not sure", answered: "answered" }[
            state
          ];
          return (
            <li key={q.id}>
              <Link
                href={`/q/${q.id}`}
                className={`${styles.step} ${styles[state]}`}
                aria-current={q.id === current ? "step" : undefined}
                aria-label={`Question ${i + 1}, ${q.title}, ${label}`}
              >
                {i + 1}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SaveStatus({ store }: { store: StoreState }) {
  if (!store.persisted) {
    return (
      <p className="small callout callout--error" role="status">
        This browser isn&rsquo;t letting the page save. Your answers will be lost if you close this
        tab.
      </p>
    );
  }
  return (
    <p className={`small muted ${styles.saved}`} role="status">
      {store.savedAt ? "Saved on this device" : "Answers save automatically on this device"}
    </p>
  );
}

function QuestionNav({
  id,
  fromReview,
  answered,
}: {
  id: QuestionId;
  fromReview: boolean;
  answered: boolean;
}) {
  const index = questionNumber(id) - 1;
  const prev = QUESTIONS[index - 1];
  const next = QUESTIONS[index + 1];

  if (fromReview) {
    return (
      <div className="actions">
        <Link className="button button--primary" href="/review">
          Back to review
        </Link>
      </div>
    );
  }

  return (
    <div className={`actions ${styles.nav}`}>
      <Link className="button button--quiet" href={prev ? `/q/${prev.id}` : "/"}>
        {prev ? "Previous question" : "Back to overview"}
      </Link>
      <Link
        className={`button ${answered ? "button--primary" : "button--secondary"}`}
        href={next ? `/q/${next.id}` : "/review"}
      >
        {next ? (answered ? "Next question" : "Skip for now") : "Review answers"}
      </Link>
    </div>
  );
}

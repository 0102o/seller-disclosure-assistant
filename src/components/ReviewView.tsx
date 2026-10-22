"use client";

import Link from "next/link";
import { getProgress, getStatus, isAnswered, needsDetail } from "@/lib/answers";
import { useDisclosure } from "@/lib/answers-store";
import { QUESTIONS } from "@/lib/questions";
import { Loading } from "./Loading";
import { ProgressSummary } from "./ProgressSummary";
import { StatusTag } from "./StatusTag";
import styles from "./ReviewView.module.css";

export function ReviewView() {
  const store = useDisclosure();
  if (!store) return <Loading />;

  const progress = getProgress(store.answers);
  const complete = getStatus(progress) === "complete";

  return (
    <>
      <section className="card">
        <h1 className={styles.title}>Review your answers</h1>
        <ProgressSummary progress={progress} />
        {complete ? (
          <p className={`callout callout--done ${styles.banner}`}>
            All {progress.total} questions are answered. Your agent can review them next, and you can
            still change anything below.
          </p>
        ) : (
          <div className={`callout callout--warn ${styles.banner}`}>
            <p>
              {progress.remaining} {progress.remaining === 1 ? "question still needs" : "questions still need"}{" "}
              an answer.
            </p>
            <Link
              className="button button--primary"
              href={`/q/${progress.nextUnanswered}?from=review`}
            >
              Answer the next one
            </Link>
          </div>
        )}
      </section>

      <ol className={styles.list}>
        {QUESTIONS.map((q, i) => {
          const answer = store.answers[q.id];
          const answered = isAnswered(answer);
          const note = answer?.note.trim();
          return (
            <li key={q.id} className={`card ${styles.item} ${answered ? "" : styles.unanswered}`}>
              <div className={styles.itemHead}>
                <span className="eyebrow">Question {i + 1}</span>
                <StatusTag answer={answer} />
              </div>
              <h2 className={styles.prompt}>{q.prompt}</h2>
              {note ? (
                <p className={styles.note}>{note}</p>
              ) : (
                <p className="muted">No details added</p>
              )}
              {answer?.usedVoice && <p className="small muted">Includes a spoken answer</p>}
              {needsDetail(answer) && (
                <p className="small callout callout--warn">
                  Yes answers usually need a short explanation.
                </p>
              )}
              <Link className={styles.change} href={`/q/${q.id}?from=review`}>
                {answered ? "Change" : "Answer"}
                <span className="visually-hidden"> {q.title.toLowerCase()} question</span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="actions">
        <Link className="button button--secondary" href="/">
          Back to overview
        </Link>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProgress, getStatus, isAnswered, type OverallStatus } from "@/lib/answers";
import { disclosureActions, useDisclosure } from "@/lib/answers-store";
import { PROPERTY } from "@/lib/property";
import { QUESTIONS } from "@/lib/questions";
import { Loading } from "./Loading";
import { ProgressSummary } from "./ProgressSummary";
import { StatusTag } from "./StatusTag";
import styles from "./Overview.module.css";

const STATUS_LABEL: Record<OverallStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Ready for agent review",
};

export function Overview() {
  const store = useDisclosure();
  if (!store) return <Loading />;

  const progress = getProgress(store.answers);
  const status = getStatus(progress);
  const firstQuestion = QUESTIONS[0].id;

  return (
    <>
      <section className="card" aria-labelledby="property-heading">
        <p className="eyebrow">Seller disclosures</p>
        <h1 id="property-heading" className={styles.address}>
          {PROPERTY.street}
        </h1>
        <p className="muted">{PROPERTY.cityStateZip}</p>
        <dl className={styles.facts}>
          <div>
            <dt>Seller</dt>
            <dd>{PROPERTY.sellerName}</dd>
          </div>
          <div>
            <dt>Disclosure status</dt>
            <dd>
              <span className={`${styles.status} ${styles[status]}`}>{STATUS_LABEL[status]}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className={styles.sectionTitle}>
          {status === "complete" ? "All questions answered" : "Five questions about the home's condition"}
        </h2>
        {status === "not_started" && (
          <p className={styles.intro}>
            Answer what you know. &ldquo;Not sure&rdquo; is a fine answer, and your agent will follow
            up. You can type or speak, and your answers save on this device as you go, so you can
            stop at any time.
          </p>
        )}
        <ProgressSummary progress={progress} />
        <div className={`actions ${styles.cta}`}>
          {status === "not_started" && (
            <Link className="button button--primary" href={`/q/${firstQuestion}`}>
              Start the questions
            </Link>
          )}
          {status === "in_progress" && (
            <>
              <Link className="button button--primary" href={`/q/${progress.nextUnanswered}`}>
                Continue where you left off
              </Link>
              <Link className="button button--secondary" href="/review">
                Review answers
              </Link>
            </>
          )}
          {status === "complete" && (
            <Link className="button button--primary" href="/review">
              Review answers
            </Link>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="questions-heading">
        <h2 id="questions-heading" className={styles.sectionTitle}>
          Questions
        </h2>
        <ol className={styles.list}>
          {QUESTIONS.map((q, i) => {
            const answer = store.answers[q.id];
            const hasDraft = !isAnswered(answer) && !!answer?.note.trim();
            return (
              <li key={q.id}>
                <Link href={`/q/${q.id}`} className={styles.row}>
                  <span className={styles.number} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{q.title}</span>
                    {hasDraft && <span className="small muted">Notes started, no answer yet</span>}
                  </span>
                  <StatusTag answer={answer} />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <footer className={styles.footer}>
        <p className="small muted">Demo property. All names and details are fictional.</p>
        {Object.keys(store.answers).length > 0 && <ResetButton />}
      </footer>
    </>
  );
}

// Two-step reset instead of a browser confirm() dialog.
function ResetButton() {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className="button button--quiet small"
      onClick={() => {
        if (armed) {
          disclosureActions.reset();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? "Tap again to erase all answers" : "Reset demo data"}
    </button>
  );
}

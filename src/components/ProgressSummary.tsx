import type { Progress } from "@/lib/answers";
import styles from "./ProgressSummary.module.css";

export function ProgressSummary({ progress }: { progress: Progress }) {
  const { answered, total, remaining, percent, followUps } = progress;
  return (
    <div className={styles.summary}>
      <div className={styles.numbers}>
        <p>
          <strong>
            {answered} of {total}
          </strong>{" "}
          questions answered
        </p>
        <p className="muted">
          {percent}% · {remaining === 0 ? "none remaining" : `${remaining} remaining`}
        </p>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label="Disclosure progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        aria-valuetext={`${answered} of ${total} answered`}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      {followUps > 0 && (
        <p className="small muted">
          {followUps} {followUps === 1 ? "answer is" : "answers are"} marked Not sure. Your agent
          will follow up on {followUps === 1 ? "it" : "them"}.
        </p>
      )}
    </div>
  );
}

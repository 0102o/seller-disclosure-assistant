"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MAX_RECORDING_MS, useRecorder, type Recording, type RecorderError } from "@/hooks/useRecorder";
import { CHOICE_LABEL, type Choice } from "@/lib/answers";
import { disclosureActions } from "@/lib/answers-store";
import type { QuestionId } from "@/lib/questions";
import { suggestChoice } from "@/lib/suggest";
import {
  TranscribeError,
  transcribeRecording,
  voiceAvailable,
  type TranscribeErrorCode,
} from "@/lib/transcribe-client";
import styles from "./VoiceAnswer.module.css";

type Phase =
  | { name: "idle" }
  | { name: "transcribing" }
  | { name: "review"; transcript: string }
  | ({ name: "error" } & ErrorView);

type ErrorView = { message: string; retry: "transcribe" | "record" | null };

const RECORDER_ERRORS: Record<RecorderError, ErrorView> = {
  denied: {
    message:
      "Microphone access is blocked for this site. Allow it from the icon in your browser's address bar, then try again.",
    retry: "record",
  },
  "no-mic": { message: "We couldn't find a microphone. Connect one and try again.", retry: "record" },
  "mic-busy": { message: "Another app is using your microphone. Close it and try again.", retry: "record" },
  insecure: { message: "Voice answers need a secure (https) connection.", retry: null },
  unsupported: { message: "This browser can't record audio.", retry: null },
  failed: { message: "Recording didn't start.", retry: "record" },
};

const TRANSCRIBE_ERRORS: Record<TranscribeErrorCode, { name: "error" } & ErrorView> = {
  not_configured: { name: "error", message: "Voice answers aren't set up on this server.", retry: null },
  bad_audio: { name: "error", message: "We couldn't make out that recording. Try again a little closer to the microphone.", retry: "record" },
  too_short: { name: "error", message: "That recording was too short. Try again and speak for a few seconds.", retry: "record" },
  too_long: { name: "error", message: "That recording was too long. Try a shorter answer, then add more.", retry: "record" },
  busy: { name: "error", message: "The voice service is busy. Your recording is kept, so you can try again in a moment.", retry: "transcribe" },
  unavailable: { name: "error", message: "Voice isn't working right now. Your recording is kept, so you can try again.", retry: "transcribe" },
  network: { name: "error", message: "We couldn't reach the server. Check your connection and try again.", retry: "transcribe" },
};

export function VoiceAnswer({
  questionId,
  currentChoice,
  onAdded,
}: {
  questionId: QuestionId;
  currentChoice: Choice | null;
  onAdded: () => void;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [announcement, setAnnouncement] = useState("");
  const lastRecording = useRef<Recording | null>(null);
  const transcriptId = useId();
  // Each panel marks the control that should get focus when it appears, so focus
  // never drops to the page when the button that had it disappears. Only after the
  // homeowner has used voice on this question; opening the page doesn't move focus.
  const focusTarget = useRef<HTMLElement | null>(null);
  const setFocusTarget = useCallback((el: HTMLElement | null) => {
    focusTarget.current = el;
  }, []);
  const engaged = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void voiceAvailable().then((ok) => active && setAvailable(ok));
    return () => {
      active = false;
    };
  }, []);

  async function transcribe(recording: Recording) {
    setPhase({ name: "transcribing" });
    setAnnouncement("Transcribing your answer");
    try {
      const transcript = await transcribeRecording(recording, questionId);
      if (!transcript) {
        setPhase({ name: "error", message: "We didn't catch any words. Try again a little closer to the microphone.", retry: "record" });
        setAnnouncement("");
        return;
      }
      setPhase({ name: "review", transcript });
      setAnnouncement("Transcript ready. Review it before adding it to your answer.");
    } catch (error) {
      const code = error instanceof TranscribeError ? error.code : "unavailable";
      setPhase(TRANSCRIBE_ERRORS[code]);
      setAnnouncement(""); // The error itself is announced by its role="alert" box.
    }
  }

  const recorder = useRecorder((recording) => {
    lastRecording.current = recording;
    void transcribe(recording);
  });

  const currentView =
    recorder.status !== "idle" ? recorder.status : phase.name === "idle" && recorder.error ? "error" : phase.name;
  useEffect(() => {
    if (engaged.current) focusTarget.current?.focus();
  }, [currentView]);

  function startRecording() {
    engaged.current = true;
    setPhase({ name: "idle" });
    setAnnouncement("");
    void recorder.start();
  }

  function addToAnswer(transcript: string) {
    disclosureActions.addTranscript(questionId, transcript);
    engaged.current = false; // onAdded moves focus to the explanation box instead
    setPhase({ name: "idle" });
    setAnnouncement("Added to your answer.");
    onAdded();
  }

  if (available === false) {
    return (
      <p className={`small muted ${styles.unavailable}`}>
        Voice answers aren&rsquo;t set up on this server, so please type your answer.
      </p>
    );
  }

  const recording = recorder.status === "recording";
  const requesting = recorder.status === "requesting";
  const showIdle = phase.name === "idle" && !recording && !requesting;
  const error: ErrorView | null =
    phase.name === "error" ? phase : showIdle && recorder.error ? RECORDER_ERRORS[recorder.error] : null;
  // Recorder states are announced from the recorder itself, so "Recording" is
  // never said before the browser has actually granted the microphone.
  const liveMessage = requesting
    ? "Waiting for microphone permission."
    : recording
      ? "Recording. Press stop when you're done."
      : announcement;

  return (
    <div className={styles.voice}>
      <p className="visually-hidden" role="status" aria-live="polite">
        {liveMessage}
      </p>

      {showIdle && !error && (
        <div className={styles.row}>
          <button
            type="button"
            ref={setFocusTarget}
            className="button button--secondary"
            onClick={startRecording}
            disabled={available === null}
          >
            <MicIcon />
            Answer by voice
          </button>
          <p className="small muted">
            Your recording is sent to OpenAI to be transcribed. This app doesn&rsquo;t keep the audio.
          </p>
        </div>
      )}

      {requesting && (
        <div className={styles.panel}>
          <p>Waiting for microphone permission&hellip;</p>
          <button
            type="button"
            ref={setFocusTarget}
            className="button button--quiet"
            onClick={recorder.cancel}
          >
            Cancel
          </button>
        </div>
      )}

      {recording && (
        <div className={`${styles.panel} ${styles.recording}`}>
          <div className={styles.recordingHead}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.recordingLabel}>Listening</span>
            <span className={styles.timer}>
              {formatTime(recorder.elapsedMs)} / {formatTime(MAX_RECORDING_MS)}
            </span>
          </div>
          <div className={styles.meter} aria-hidden="true">
            <div className={styles.meterFill} style={{ transform: `scaleX(${recorder.level})` }} />
          </div>
          <p className="small muted">Start with yes, no or not sure, then add any details.</p>
          <div className="actions">
            <button
              type="button"
              ref={setFocusTarget}
              className="button button--primary"
              onClick={recorder.stop}
            >
              <StopIcon />
              Stop and transcribe
            </button>
            <button type="button" className="button button--quiet" onClick={recorder.cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase.name === "transcribing" && (
        <div className={styles.panel} aria-busy="true" tabIndex={-1} ref={setFocusTarget}>
          <p className={styles.working}>
            <span className={styles.spinner} aria-hidden="true" />
            Transcribing your answer&hellip;
          </p>
        </div>
      )}

      {phase.name === "review" && (
        <div className={`${styles.panel} ${styles.review}`}>
          <label htmlFor={transcriptId} className={styles.reviewLabel}>
            Here&rsquo;s what we heard. Fix anything that&rsquo;s wrong.
          </label>
          <textarea
            id={transcriptId}
            ref={setFocusTarget}
            className={styles.transcript}
            rows={3}
            value={phase.transcript}
            onChange={(e) => setPhase({ name: "review", transcript: e.target.value })}
          />
          <SuggestionChip
            questionId={questionId}
            transcript={phase.transcript}
            currentChoice={currentChoice}
            onChosen={(label) => {
              setAnnouncement(`Answer set to ${label}.`);
              addButton.current?.focus(); // the suggestion box disappears once it's applied
            }}
          />
          <div className="actions">
            <button
              type="button"
              ref={addButton}
              className="button button--primary"
              onClick={() => addToAnswer(phase.transcript)}
              disabled={!phase.transcript.trim()}
            >
              Add to my answer
            </button>
            <button type="button" className="button button--secondary" onClick={startRecording}>
              Record again
            </button>
            <button type="button" className="button button--quiet" onClick={() => setPhase({ name: "idle" })}>
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className={`callout callout--error ${styles.error}`}
          role="alert"
          tabIndex={-1}
          ref={error.retry ? undefined : setFocusTarget}
        >
          <p>{error.message} You can also type your answer above.</p>
          <div className="actions">
            {error.retry === "transcribe" && (
              <button
                type="button"
                ref={setFocusTarget}
                className="button button--secondary"
                onClick={() => lastRecording.current && void transcribe(lastRecording.current)}
              >
                Try again
              </button>
            )}
            {error.retry === "record" && (
              <button
                type="button"
                ref={setFocusTarget}
                className="button button--secondary"
                onClick={startRecording}
              >
                {phase.name === "error" ? "Record again" : "Try again"}
              </button>
            )}
            {phase.name === "error" && (
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setPhase({ name: "idle" })}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionChip({
  questionId,
  transcript,
  currentChoice,
  onChosen,
}: {
  questionId: QuestionId;
  transcript: string;
  currentChoice: Choice | null;
  onChosen: (label: string) => void;
}) {
  const suggestion = suggestChoice(questionId, transcript);
  if (!suggestion) {
    return currentChoice === null ? (
      <p className="small muted">After adding this, choose Yes, No or Not sure above.</p>
    ) : null;
  }
  if (suggestion.choice === currentChoice) return null;

  const label = CHOICE_LABEL[suggestion.choice];
  return (
    <div className={styles.suggestion}>
      <p>
        {currentChoice ? (
          <>
            You chose <strong>{CHOICE_LABEL[currentChoice]}</strong>, but this sounds like{" "}
            <strong>{label}</strong>
          </>
        ) : (
          <>
            This sounds like <strong>{label}</strong>
          </>
        )}
        {suggestion.hedged && " (as far as you know)"}, based on{" "}
        <q className={styles.evidence}>{suggestion.evidence}</q>
      </p>
      <button
        type="button"
        className="button button--secondary"
        onClick={() => {
          disclosureActions.choose(questionId, suggestion.choice);
          onChosen(label);
        }}
      >
        {currentChoice ? `Change to ${label}` : `Choose ${label}`}
      </button>
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

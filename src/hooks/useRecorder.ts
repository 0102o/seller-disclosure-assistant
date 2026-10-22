"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording";
export type RecorderError = "denied" | "no-mic" | "mic-busy" | "insecure" | "unsupported" | "failed";
export type Recording = { blob: Blob; mimeType: string; durationMs: number };

/** Long answers are fine, but one recording is capped. The UI offers "record more". */
export const MAX_RECORDING_MS = 120_000;

// Chrome, Firefox and Safari 18.4+ record WebM/Opus; older Safari only MP4/AAC.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

type Session = {
  stream: MediaStream;
  recorder: MediaRecorder | null;
  audioContext: AudioContext | null;
  frame: number;
  timer: number;
};

export function useRecorder(onRecorded: (recording: Recording) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);

  const session = useRef<Session | null>(null);
  // Bumped by every start, cancel and unmount. A recording or permission
  // prompt that finishes under an old number is thrown away.
  const attempt = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  const release = useCallback(() => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    cancelAnimationFrame(s.frame);
    clearInterval(s.timer);
    if (s.recorder?.state === "recording") s.recorder.stop();
    s.stream.getTracks().forEach((track) => track.stop()); // turns off the browser's mic indicator
    void s.audioContext?.close();
    setLevel(0);
  }, []);

  // Never leave the microphone on after the component goes away.
  useEffect(
    () => () => {
      attempt.current++;
      release();
    },
    [release],
  );

  const start = useCallback(async () => {
    const fail = (kind: RecorderError) => {
      setError(kind);
      setStatus("idle");
    };
    if (!window.isSecureContext) return fail("insecure");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return fail("unsupported");
    }

    const mine = ++attempt.current;
    setError(null);
    setElapsedMs(0);
    setStatus("requesting");

    // Created inside the click so Safari lets it run; only used for the level meter.
    let audioContext: AudioContext | null = null;
    try {
      audioContext = new AudioContext();
    } catch {
      audioContext = null;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      void audioContext?.close();
      if (mine === attempt.current) fail(errorFor(e));
      return;
    }
    const s: Session = { stream, recorder: null, audioContext, frame: 0, timer: 0 };
    if (mine !== attempt.current) {
      // Cancelled while the permission prompt was still open.
      session.current = s;
      release();
      return;
    }
    session.current = s;

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    try {
      s.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      release();
      return fail("failed");
    }
    const recorder = s.recorder;
    const chunks: Blob[] = [];
    // stop() resets recorder.mimeType, so remember the real one when recording starts.
    let recordedType = mimeType ?? "";
    const startedAt = Date.now();

    recorder.onstart = () => {
      recordedType = recorder.mimeType || recordedType;
    };
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const durationMs = Date.now() - startedAt;
      if (session.current === s) release();
      if (mine !== attempt.current) return; // cancelled or unmounted
      setStatus("idle");
      if (chunks.length === 0) return fail("failed");
      const type = recordedType || chunks[0].type || "audio/webm";
      onRecordedRef.current({ blob: new Blob(chunks, { type }), mimeType: type, durationMs });
    };

    if (audioContext) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += v * v;
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
        s.frame = requestAnimationFrame(tick);
      };
      void audioContext.resume();
      s.frame = requestAnimationFrame(tick);
    }

    s.timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS && recorder.state === "recording") recorder.stop();
    }, 250);

    recorder.start(1000);
    setStatus("recording");
  }, [release]);

  const stop = useCallback(() => {
    const s = session.current;
    if (s?.recorder?.state !== "recording") return;
    // Freeze the meter right away so it never looks like we're still listening.
    cancelAnimationFrame(s.frame);
    setLevel(0);
    s.recorder.stop();
  }, []);

  const cancel = useCallback(() => {
    attempt.current++;
    release();
    setStatus("idle");
  }, [release]);

  return { status, error, elapsedMs, level, start, stop, cancel };
}

function errorFor(e: unknown): RecorderError {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-mic";
  if (name === "NotReadableError" || name === "AbortError") return "mic-busy";
  return "failed";
}

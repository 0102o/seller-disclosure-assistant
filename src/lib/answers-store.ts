import { useSyncExternalStore } from "react";
import { answersReducer, type Action, type Answers, type Choice } from "./answers";
import type { QuestionId } from "./questions";
import { loadAnswers, saveAnswers, STORAGE_KEY } from "./storage";

// localStorage is the source of truth. React reads it through
// useSyncExternalStore; every action runs the pure reducer and writes through.

export type StoreState = {
  answers: Answers;
  /** false when the browser refuses storage; answers then last only for this tab. */
  persisted: boolean;
  savedAt: string | null;
};

let state: StoreState | undefined;
const listeners = new Set<() => void>();

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSnapshot(): StoreState {
  state ??= { answers: loadAnswers(browserStorage()), persisted: true, savedAt: null };
  return state;
}

function getServerSnapshot(): StoreState | null {
  return null;
}

function emit() {
  for (const listener of listeners) listener();
}

// Keeps two open tabs in sync.
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  state = { ...getSnapshot(), answers: loadAnswers(browserStorage()) };
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function dispatch(action: Action) {
  const current = getSnapshot();
  const answers = answersReducer(current.answers, action);
  if (answers === current.answers) return;
  const now = new Date().toISOString();
  state = { answers, persisted: saveAnswers(browserStorage(), answers, now), savedAt: now };
  emit();
}

/** null while the server renders and the page hydrates; the saved answers after that. */
export function useDisclosure(): StoreState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const now = () => new Date().toISOString();

export const disclosureActions = {
  choose: (id: QuestionId, choice: Choice) => dispatch({ type: "choose", id, choice, at: now() }),
  editNote: (id: QuestionId, note: string) => dispatch({ type: "editNote", id, note, at: now() }),
  addTranscript: (id: QuestionId, text: string) =>
    dispatch({ type: "addTranscript", id, text, at: now() }),
  reset: () => dispatch({ type: "reset" }),
};

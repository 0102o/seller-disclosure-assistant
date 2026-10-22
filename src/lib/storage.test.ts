import { describe, expect, it } from "vitest";
import type { Answers } from "./answers";
import { canSave, loadAnswers, saveAnswers, STORAGE_KEY } from "./storage";

// A plain in-memory Storage, so tests don't depend on a browser or on Node's own localStorage.
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const AT = "2026-10-21T12:00:00.000Z";
const SAMPLE: Answers = {
  "water-damage": { choice: "yes", note: "Kitchen leak, repaired.", usedVoice: true, updatedAt: AT },
  roof: { choice: null, note: "Not sure how old it is", usedVoice: false, updatedAt: AT },
};

describe("storage", () => {
  it("round-trips answers", () => {
    const storage = memoryStorage();
    expect(saveAnswers(storage, SAMPLE, AT)).toBe(true);
    expect(loadAnswers(storage)).toEqual(SAMPLE);
  });

  it("returns no answers when nothing is saved or storage is unavailable", () => {
    expect(loadAnswers(memoryStorage())).toEqual({});
    expect(loadAnswers(null)).toEqual({});
    expect(saveAnswers(null, SAMPLE, AT)).toBe(false);
  });

  it("survives corrupt data and unknown versions", () => {
    expect(loadAnswers(memoryStorage({ [STORAGE_KEY]: "{not json" }))).toEqual({});
    expect(
      loadAnswers(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99, answers: SAMPLE }) })),
    ).toEqual({});
  });

  it("drops unknown questions and invalid fields", () => {
    const raw = JSON.stringify({
      version: 1,
      savedAt: AT,
      answers: {
        roof: { choice: "maybe", note: 42, usedVoice: "yes", updatedAt: AT },
        "pool-safety": { choice: "yes", note: "", usedVoice: false, updatedAt: AT },
      },
    });
    expect(loadAnswers(memoryStorage({ [STORAGE_KEY]: raw }))).toEqual({
      roof: { choice: null, note: "", usedVoice: false, updatedAt: AT },
    });
  });

  it("reports a failed write instead of throwing", () => {
    const full = {
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(saveAnswers(full, SAMPLE, AT)).toBe(false);
  });

  it("knows up front whether the browser lets it save", () => {
    const storage = memoryStorage();
    expect(canSave(storage)).toBe(true);
    expect(storage.getItem(`${STORAGE_KEY}:probe`)).toBeNull(); // probe cleaned up
    expect(canSave(null)).toBe(false);
    const blocked = {
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      removeItem: () => {},
    };
    expect(canSave(blocked)).toBe(false);
  });
});

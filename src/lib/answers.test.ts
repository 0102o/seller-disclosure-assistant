import { describe, expect, it } from "vitest";
import { answersReducer, getProgress, getStatus, needsDetail, type Answers } from "./answers";

const AT = "2026-10-21T12:00:00.000Z";

describe("answersReducer", () => {
  it("records a choice without touching the note", () => {
    const state = answersReducer({}, { type: "choose", id: "roof", choice: "no", at: AT });
    expect(state.roof).toEqual({ choice: "no", note: "", usedVoice: false, updatedAt: AT });
  });

  it("lets a previous answer be changed", () => {
    let state = answersReducer({}, { type: "choose", id: "roof", choice: "no", at: AT });
    state = answersReducer(state, { type: "choose", id: "roof", choice: "yes", at: AT });
    expect(state.roof?.choice).toBe("yes");
  });

  it("appends a transcript to existing notes and marks voice use", () => {
    let state = answersReducer({}, { type: "editNote", id: "water-damage", note: "Kitchen leak.", at: AT });
    state = answersReducer(state, {
      type: "addTranscript",
      id: "water-damage",
      text: "  It was repaired in 2024. ",
      at: AT,
    });
    expect(state["water-damage"]?.note).toBe("Kitchen leak.\nIt was repaired in 2024.");
    expect(state["water-damage"]?.usedVoice).toBe(true);
    expect(state["water-damage"]?.choice).toBeNull();
  });

  it("forgets the voice marker once the explanation is cleared", () => {
    let state = answersReducer({}, { type: "addTranscript", id: "roof", text: "Small leak.", at: AT });
    state = answersReducer(state, { type: "editNote", id: "roof", note: "Small leak, fixed.", at: AT });
    expect(state.roof?.usedVoice).toBe(true);
    state = answersReducer(state, { type: "editNote", id: "roof", note: "", at: AT });
    expect(state.roof?.usedVoice).toBe(false);
  });

  it("ignores an empty transcript", () => {
    const state: Answers = {};
    expect(answersReducer(state, { type: "addTranscript", id: "roof", text: "  ", at: AT })).toBe(state);
  });

  it("clears everything on reset", () => {
    const state = answersReducer({}, { type: "choose", id: "roof", choice: "no", at: AT });
    expect(answersReducer(state, { type: "reset" })).toEqual({});
  });
});

describe("progress", () => {
  it("starts at zero", () => {
    const p = getProgress({});
    expect(p).toMatchObject({ answered: 0, total: 5, remaining: 5, percent: 0, nextUnanswered: "water-damage" });
    expect(getStatus(p)).toBe("not_started");
  });

  it("counts Not sure as answered but flags it for follow-up, and ignores notes without a choice", () => {
    let state = answersReducer({}, { type: "choose", id: "water-damage", choice: "yes", at: AT });
    state = answersReducer(state, { type: "choose", id: "roof", choice: "not_sure", at: AT });
    state = answersReducer(state, { type: "choose", id: "pending-repairs", choice: "no", at: AT });
    state = answersReducer(state, { type: "editNote", id: "renovations", note: "Kitchen in 2021", at: AT });
    const p = getProgress(state);
    expect(p).toMatchObject({ answered: 3, remaining: 2, percent: 60, followUps: 1, nextUnanswered: "renovations" });
    expect(getStatus(p)).toBe("in_progress");
  });

  it("is complete when every question has a choice", () => {
    let state: Answers = {};
    for (const id of ["water-damage", "roof", "renovations", "plumbing-electrical", "pending-repairs"] as const) {
      state = answersReducer(state, { type: "choose", id, choice: "no", at: AT });
    }
    const p = getProgress(state);
    expect(p).toMatchObject({ answered: 5, remaining: 0, percent: 100, nextUnanswered: null });
    expect(getStatus(p)).toBe("complete");
  });
});

describe("needsDetail", () => {
  it("flags a Yes without an explanation", () => {
    expect(needsDetail({ choice: "yes", note: " ", usedVoice: false, updatedAt: AT })).toBe(true);
    expect(needsDetail({ choice: "yes", note: "Leak in 2022", usedVoice: false, updatedAt: AT })).toBe(false);
    expect(needsDetail({ choice: "no", note: "", usedVoice: false, updatedAt: AT })).toBe(false);
  });
});

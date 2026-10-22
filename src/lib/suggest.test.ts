import { describe, expect, it } from "vitest";
import type { QuestionId } from "./questions";
import { suggestChoice } from "./suggest";

type Case = [QuestionId, string, "yes" | "no" | "not_sure" | null, { hedged?: boolean; evidence?: string }?];

// null means the app should stay quiet and let the homeowner choose.
const CASES: Case[] = [
  // The example from the brief
  ["water-damage", "Yes, we had a small leak in the kitchen about two years ago, but it was repaired.", "yes", { evidence: "Yes, we had a small leak in the kitchen about two years ago" }],
  ["water-damage", "Yes.", "yes"],
  ["water-damage", "No.", "no"],
  ["water-damage", "No, never.", "no"],
  ["water-damage", "Nope, nothing like that.", "no"],
  ["water-damage", "Not that I know of.", "no", { hedged: true }],
  ["water-damage", "I'm not aware of any water damage.", "no", { hedged: true }],
  ["water-damage", "I'm not sure. There's a stain on the ceiling but I don't know where it came from.", "not_sure", { evidence: "I'm not sure" }],
  ["water-damage", "I don't think so.", "not_sure"],
  ["water-damage", "We had a small leak under the sink last year, it's fixed now.", "yes", { evidence: "We had a small leak under the sink last year, it's fixed now" }],
  ["water-damage", "There's no water damage.", "no"],
  ["water-damage", "We've never had any leaks.", "no"],
  ["water-damage", "Um, yeah, the basement flooded in 2019.", "yes"],
  ["water-damage", "Mm-hmm.", null],
  ["water-damage", "", null],
  ["water-damage", "...", null],
  ["water-damage", "No, but there was some mold in the bathroom.", null],
  ["water-damage", "Our neighbor's basement flooded but ours was fine.", null],
  ["water-damage", "No, no, wait, yes, there was a leak in the laundry room.", "yes", { evidence: "yes, there was a leak in the laundry room" }],
  ["water-damage", "Yeah, no, it's been fine.", "no"],
  ["water-damage", "We’ve never had a leak.", "no"],

  ["roof", "We replaced the roof in 2019.", null],
  ["roof", "There's a leak over the back bedroom when it rains hard.", "yes"],
  ["roof", "The roof is fine as far as I know.", "no", { hedged: true }],
  ["roof", "An inspector said it has maybe five years left.", "not_sure"],
  ["roof", "Some shingles blew off last winter and we had them patched.", "yes"],
  ["roof", "No problems that I know of.", "no", { hedged: true }],
  ["roof", "We had it inspected last year and it's in good shape.", "no"],

  ["renovations", "We remodeled the kitchen in 2021.", "yes"],
  ["renovations", "No, we haven't done anything.", "no"],
  ["renovations", "I think the previous owners redid the bathroom.", "not_sure"],
  ["renovations", "We put in a new deck and converted the garage into an office.", "yes"],
  ["renovations", "Nothing major, just painting.", "no"],
  ["renovations", "The previous owner might have added a bathroom.", "not_sure"],

  ["plumbing-electrical", "The kitchen breaker trips sometimes when the microwave is on.", "yes"],
  ["plumbing-electrical", "Everything works fine.", "no"],
  ["plumbing-electrical", "Not really.", "not_sure"],
  ["plumbing-electrical", "There's a slow drain in the upstairs bathroom.", "yes"],
  ["plumbing-electrical", "No leaks, but the water pressure is low upstairs.", null],
  ["plumbing-electrical", "The outlets don't spark or anything.", "no"],

  ["pending-repairs", "We still need to fix the fence.", "yes"],
  ["pending-repairs", "Everything's been fixed.", "no"],
  ["pending-repairs", "There's a crack in the upstairs window we haven't gotten to.", "yes"],
  ["pending-repairs", "I'd rather not say.", null],
  ["pending-repairs", "Hmm, maybe? I'd have to check with my husband.", "not_sure"],
  ["pending-repairs", "Nothing needs to be fixed.", "no"],
];

describe("suggestChoice", () => {
  it.each(CASES)("%s: %j -> %s", (id, transcript, expected, extra) => {
    const result = suggestChoice(id, transcript);
    if (expected === null) {
      expect(result).toBeNull();
      return;
    }
    expect(result?.choice).toBe(expected);
    expect(result?.hedged).toBe(extra?.hedged ?? false);
    if (extra?.evidence) expect(result?.evidence).toBe(extra.evidence);
    // Evidence is always quoted from what the homeowner actually said.
    expect(transcript.replace(/’/g, "'")).toContain(result!.evidence.replace(/…$/, "").replace(/’/g, "'"));
  });

  it("never suggests No when the homeowner hedges with a belief", () => {
    for (const phrase of ["I don't think so", "I think it's fine", "Probably not", "Not really"]) {
      expect(suggestChoice("roof", phrase)?.choice).not.toBe("no");
    }
  });

  it("shortens long evidence", () => {
    const long = `Yes ${"and the water kept coming back ".repeat(6)}`;
    const evidence = suggestChoice("water-damage", long)!.evidence;
    expect(evidence.length).toBeLessThanOrEqual(90);
    expect(evidence.endsWith("…")).toBe(true);
  });
});

describe("component words alone are not problems", () => {
  it.each([
    ["plumbing-electrical", "One bedroom outlet doesn't work.", "yes"],
    ["plumbing-electrical", "The breakers and wiring were updated, no problems.", "no"],
    ["roof", "The shingles look fine to me.", "no"],
  ] as const)("%s: %j -> %s", (id, transcript, expected) => {
    expect(suggestChoice(id, transcript)?.choice).toBe(expected);
  });
});

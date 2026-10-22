import { describe, expect, it } from "vitest";
import { readSuggestion } from "./suggestion";

const SPOKEN = "No, just a small leak under the sink last year.";

// The shape /v1/responses returns: output[] -> message -> content[] -> output_text.
function reply(text: string) {
  return {
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  };
}

describe("readSuggestion", () => {
  it("accepts a well-formed choice whose evidence is in the transcript", () => {
    const raw = reply(JSON.stringify({ choice: "yes", evidence: "just a small leak under the sink" }));
    expect(readSuggestion(raw, SPOKEN)).toEqual({ choice: "yes", evidence: "just a small leak under the sink" });
  });

  it("matches evidence regardless of case, curly quotes and spacing", () => {
    const raw = reply(JSON.stringify({ choice: "no", evidence: "We've  NEVER had a leak." }));
    expect(readSuggestion(raw, "We’ve never had a leak.")?.choice).toBe("no");
  });

  it("rejects evidence the seller never said", () => {
    const raw = reply(JSON.stringify({ choice: "yes", evidence: "the roof leaks" }));
    expect(readSuggestion(raw, SPOKEN)).toBeNull();
  });

  it("rejects 'unclear', unknown choices and empty evidence", () => {
    expect(readSuggestion(reply('{"choice":"unclear","evidence":""}'), SPOKEN)).toBeNull();
    expect(readSuggestion(reply('{"choice":"maybe","evidence":"small leak"}'), SPOKEN)).toBeNull();
    expect(readSuggestion(reply('{"choice":"yes","evidence":""}'), SPOKEN)).toBeNull();
  });

  it("returns nothing for refusals, cut-off JSON and unexpected shapes", () => {
    const refusal = { output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] };
    expect(readSuggestion(refusal, SPOKEN)).toBeNull();
    expect(readSuggestion(reply('{"choice":"yes","evid'), SPOKEN)).toBeNull();
    expect(readSuggestion({ error: { code: "x" } }, SPOKEN)).toBeNull();
    expect(readSuggestion(null, SPOKEN)).toBeNull();
  });
});

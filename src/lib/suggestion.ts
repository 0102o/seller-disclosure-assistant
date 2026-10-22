import { CHOICES, type Choice } from "./answers";

// A suggested answer for a spoken response. The model proposes it; this module
// decides whether to trust it. The homeowner always makes the final choice.

export type Suggestion = {
  choice: Choice;
  /** The seller's own words the suggestion is based on, quoted from the transcript. */
  evidence: string;
};

/** JSON schema the model must answer in (Structured Outputs, strict mode). */
export const SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["choice", "evidence"],
  properties: {
    choice: { type: "string", enum: [...CHOICES, "unclear"] },
    evidence: { type: "string" },
  },
} as const;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/**
 * Reads the model's reply from a Responses API result and keeps it only if it
 * is well formed and its evidence really appears in what the seller said.
 * Anything else (refusal, cut-off output, "unclear", invented quotes) means no suggestion.
 */
export function readSuggestion(response: unknown, transcript: string): Suggestion | null {
  const text = outputText(response);
  if (!text) return null;
  let parsed: { choice?: unknown; evidence?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const choice = parsed.choice;
  if (typeof choice !== "string" || !CHOICES.includes(choice as Choice)) return null;
  const evidence = typeof parsed.evidence === "string" ? parsed.evidence.trim() : "";
  const quote = normalize(evidence).replace(/^[\s"'.,!?-]+|[\s"'.,!?-]+$/g, "");
  if (!quote || !normalize(transcript).includes(quote)) return null;
  return { choice: choice as Choice, evidence };
}

function outputText(response: unknown): string | null {
  const output = (response as { output?: unknown })?.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as { type?: unknown; text?: unknown };
      if (p.type === "output_text" && typeof p.text === "string") return p.text;
    }
  }
  return null;
}

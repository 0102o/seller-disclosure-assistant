import type { Choice } from "./answers";
import type { QuestionId } from "./questions";

// Suggests Yes / No / Not sure from a spoken answer. It only acts on explicit
// cues and returns null otherwise: a wrong suggestion on a legal form costs
// more than no suggestion. The homeowner always makes the final choice.

export type Suggestion = {
  choice: Choice;
  /** The words the suggestion is based on, quoted from the transcript. */
  evidence: string;
  /** "No, as far as I know": a No that rests on the seller's knowledge. */
  hedged: boolean;
};

// Problem words that point to Yes for each question, unless negated earlier in
// the same clause. Parts of the house ("outlets", "shingles") are deliberately
// not signals on their own: "the outlets don't spark" is a No.
const SIGNALS: Record<QuestionId, RegExp> = {
  "water-damage":
    /\b(?:leak\w*|flood\w*|mold|mildew|moisture|damp|stain\w*|seep\w*|standing water|water (?:came|got|comes|gets|coming|getting) in|burst|overflow\w*|water damage)\b/,
  roof: /\b(?:leak\w*|sag\w*|hail|damage\w*|crack\w*|missing|loose|blew off|blown off|years? left|end of its life|needs? (?:to be )?replac\w*|patch\w*|worn)\b/,
  renovations:
    /\b(?:remodel\w*|renovat\w*|redid|redone|replaced|addition|added|convert\w*|built|put in|installed|upgrad\w*|permit\w*|adu|new (?:kitchen|bathroom|roof|deck|windows|floors?|siding))\b/,
  "plumbing-electrical":
    /\b(?:leak\w*|clog\w*|slow drains?|drains? slowly|backs? up|backed up|backup|low (?:water )?pressure|no hot water|trip(?:s|ped|ping)|flicker\w*|spark\w*|short(?:s|ed)? out|knob and tube|aluminum wiring|(?:doesn't|don't|does not|do not|isn't|aren't|stopped|stop|not) work(?:ing)?)\b/,
  "pending-repairs":
    /\b(?:needs? (?:to be )?(?:fix\w*|repair\w*|replac\w*|finish\w*)|still (?:need|have to|haven't)|haven't (?:fixed|gotten|finished)|not (?:yet )?(?:fixed|finished)|broken|unfinished|on (?:our|the|my) list|scheduled|quoted?|crack\w*|loose)\b/,
};

const FILLER = /^(?:(?:um+|uh+|er+|erm|hmm+|so|well|okay|ok|oh|alright)\b[\s,.!?-]*)+/;
const BACKCHANNEL = /^(?:mm+[- ]?hmm+|mhm|uh[- ]?huh|hmm+|um+|uh+)[\s.!?]*$/;
// "No, no, wait, yes..." -> the last correction wins.
const CORRECTION = /\b(?:wait|actually|i mean|scratch that)\b[\s,.!?-]*/g;

const LEADING_YES_NO = /^(?:yes|yeah|yep|yup|yea)\b[\s,.!-]*no\b/;
const LEADING_YES = /^(?:yes|yeah|yep|yup|yea|correct|we did|we have)\b/;
const LEADING_NO = /^(?:no|nope|nah|never|none|nothing)\b/;
const NOT_REALLY = /^not really\b/;

const NOT_AWARE =
  /\b(?:not that (?:i|we)(?:'m| am|'re| are)? (?:know|knew|aware)|(?:i'm|i am|we're|we are) not aware|(?:i|we) (?:don't|do not) know of any|none that (?:i|we) know of)\b/;
const HEDGE =
  /\b(?:that (?:i|we) know of|that (?:i'm|i am|we're|we are) aware of|as far as (?:i|we) know|as far as (?:i'm|i am|we're|we are) aware|to (?:the best of )?(?:my|our) knowledge)\b/;
const UNSURE =
  /\b(?:not (?:\S+ )?(?:sure|certain)|unsure|no idea|no clue|(?:don't|do not|didn't|did not) (?:really )?know\b(?! of any)|(?:can't|cannot|don't|do not) (?:really )?remember|i (?:don't |do not )?(?:think|believe|guess|suppose)|maybe|possibly|probably|might|could have|hard to say|not really)\b/;
const NO_STATE =
  /\b(?:(?:is|are|was|were|it's|that's|been|everything's|everything is|all|looks?|looked|seems?|seemed) (?:fine|good|okay|ok|great|working)|in (?:good|great) (?:shape|condition)|no (?:problems?|issues?|damage|leaks?|repairs?)|nothing (?:major|like that|wrong|to report)|all good|works? fine|everything works|(?:everything|all)(?:'s| has| have)? been (?:fixed|repaired|done|taken care of))\b/;
const NEGATOR = /\b(?:no|not|never|none|nothing|without|neither|nor)\b|n't\b/;
const CONTRAST = /\b(?:but|except|although|though|however)\b/;
const OTHER_PROPERTY = /\b(?:neighbou?r'?s?|next door|across the street)\b/;
const CLAUSE_BOUNDARY = /[.;!?]+|\b(?:but|except|although|though|however)\b/g;

export function suggestChoice(id: QuestionId, transcript: string): Suggestion | null {
  // Lowercasing and swapping curly apostrophes keep every index aligned with
  // the original text, so evidence can be quoted exactly as spoken.
  const lower = transcript.toLowerCase().replace(/[‘’]/g, "'");

  let start = 0;
  for (const match of lower.matchAll(CORRECTION)) {
    const end = match.index + match[0].length;
    if (/[a-z]/.test(lower.slice(end))) start = end;
  }
  start += FILLER.exec(lower.slice(start))?.[0].length ?? 0;
  start += lower.slice(start).length - lower.slice(start).trimStart().length;

  const text = lower.slice(start).trimEnd();
  if (!text || BACKCHANNEL.test(text)) return null;

  const clauses = clauseRanges(lower, start, start + text.length);
  if (clauses.length === 0) return null;
  const quote = ([s, e]: [number, number]) => evidence(transcript.slice(s, e));
  const firstClause = clauses[0];
  const clauseMatching = (re: RegExp) =>
    clauses.find(([s, e]) => re.test(lower.slice(s, e))) ?? firstClause;

  const hedged = HEDGE.test(text);
  const make = (choice: Choice, range: [number, number], isHedged = false) => ({
    choice,
    evidence: quote(range),
    hedged: isHedged,
  });

  // 1. An explicit answer at the start.
  if (LEADING_YES_NO.test(text)) return make("no", firstClause, hedged);
  if (LEADING_YES.test(text)) return make("yes", firstClause);
  if (NOT_REALLY.test(text)) return make("not_sure", firstClause);
  if (LEADING_NO.test(text)) {
    if (UNSURE.test(text)) return make("not_sure", clauseMatching(UNSURE));
    if (CONTRAST.test(text)) return null;
    return make("no", firstClause, hedged);
  }

  // 2. "Not that I know of": a No limited to what the seller knows.
  if (NOT_AWARE.test(text)) {
    return CONTRAST.test(text) ? null : make("no", clauseMatching(NOT_AWARE), true);
  }

  // 3. Any uncertainty or belief hedge means Not sure, never No.
  if (UNSURE.test(text)) return make("not_sure", clauseMatching(UNSURE));

  // 4. Question-specific evidence. Any un-negated mention wins.
  let negated: [number, number] | null = null;
  for (const range of clauses) {
    const clause = lower.slice(range[0], range[1]);
    if (OTHER_PROPERTY.test(clause)) continue;
    const match = SIGNALS[id].exec(clause);
    if (!match) continue;
    if (!NEGATOR.test(clause.slice(0, match.index))) return make("yes", range);
    negated ??= range;
  }

  // 5. A clear "nothing wrong", as long as nothing follows a "but".
  const noState = negated ?? (NO_STATE.test(text) ? clauseMatching(NO_STATE) : null);
  if (noState && !CONTRAST.test(text)) return make("no", noState, hedged);

  return null;
}

function clauseRanges(text: string, from: number, to: number): [number, number][] {
  const ranges: [number, number][] = [];
  let cursor = from;
  for (const match of text.slice(0, to).matchAll(CLAUSE_BOUNDARY)) {
    if (match.index < from) continue;
    if (match.index > cursor) ranges.push([cursor, match.index]);
    cursor = match.index + match[0].length;
  }
  if (cursor < to) ranges.push([cursor, to]);
  return ranges.filter(([s, e]) => /[a-z]/.test(text.slice(s, e)));
}

function evidence(raw: string): string {
  const text = raw.trim().replace(/^[,\s-]+|[,\s-]+$/g, "");
  return text.length > 90 ? `${text.slice(0, 89).trimEnd()}…` : text;
}

// The disclosure questions and the plain-language guidance shown with each one.
// Content lives here as data so wording can change without touching components.

export type QuestionId =
  | "water-damage"
  | "roof"
  | "renovations"
  | "plumbing-electrical"
  | "pending-repairs";

export type Question = {
  id: QuestionId;
  /** Short label for lists and the review screen. */
  title: string;
  /** The question exactly as the homeowner sees it. */
  prompt: string;
  /** Placeholder for the explanation box when the answer is Yes. */
  yesPrompt: string;
  hint: {
    meaning: string;
    examples: string[];
    unsure: string;
  };
  /** Domain words passed to the transcription model as spelling hints. */
  keywords: string[];
};

export const QUESTIONS: readonly Question[] = [
  {
    id: "water-damage",
    title: "Water damage",
    prompt: "Has the property experienced any water damage?",
    yesPrompt: "Where was it, roughly when, and was it repaired?",
    hint: {
      meaning:
        "Any time water got somewhere it shouldn't: a leaking pipe, appliance, window or roof, flooding, water in a basement or crawl space, or mold from moisture. Include problems that were already fixed.",
      examples: [
        "A dishwasher leak that warped the kitchen floor",
        "Water in the garage during heavy rain",
        "Mold under the bathroom sink that was cleaned up",
      ],
      unsure:
        "If you've noticed stains, a musty smell or damp spots but don't know the cause, choose Not sure and describe what you saw.",
    },
    keywords: ["crawl space", "sump pump", "mold", "drywall", "subfloor", "water heater"],
  },
  {
    id: "roof",
    title: "Roof",
    prompt: "Are there any known problems with the roof?",
    yesPrompt: "What's the problem, and has anyone looked at it?",
    hint: {
      meaning:
        "Leaks (even small or one-time), missing or damaged shingles or tiles, sagging, gutter or flashing problems, or a roofer or inspector telling you it needs work soon.",
      examples: [
        "A leak over the back bedroom during storms",
        "An inspector said the roof has a few years left",
        "Shingles blew off and were patched",
      ],
      unsure:
        "Not knowing the roof's age or condition is common. Choose Not sure and say what you do know, such as when you bought the house.",
    },
    keywords: ["shingles", "flashing", "gutters", "skylight", "tile roof"],
  },
  {
    id: "renovations",
    title: "Major renovations",
    prompt: "Have any major renovations been completed?",
    yesPrompt: "What was done, roughly when, and were permits pulled (if you know)?",
    hint: {
      meaning:
        "Remodels, additions, converted spaces (like a garage turned into a bedroom), structural work, a new roof, or replacing major systems such as the electrical panel or plumbing. Include work by previous owners if you know about it.",
      examples: [
        "Kitchen remodel in 2021, permitted",
        "The previous owner enclosed the back porch",
        "Replaced the electrical panel",
      ],
      unsure:
        "If you suspect work was done before you owned the home but don't know the details, choose Not sure and mention it. Permit questions are common and your agent can help look them up.",
    },
    keywords: ["permit", "remodel", "addition", "ADU", "electrical panel", "load-bearing"],
  },
  {
    id: "plumbing-electrical",
    title: "Plumbing & electrical",
    prompt: "Are there any known plumbing or electrical issues?",
    yesPrompt: "What happens, and how often?",
    hint: {
      meaning:
        "Leaks, slow or clogged drains, sewer backups, low water pressure or water heater problems. On the electrical side: breakers that trip, flickering lights, outlets that don't work, or older wiring.",
      examples: [
        "The kitchen breaker trips when two appliances run",
        "The main sewer line was snaked twice last year",
        "One bedroom outlet doesn't work",
      ],
      unsure:
        "If something seems off but you're not sure it's a real problem, choose Not sure and describe it. A short description is more useful than a guess.",
    },
    keywords: ["breaker", "GFCI", "knob and tube", "galvanized pipes", "sewer line", "water pressure"],
  },
  {
    id: "pending-repairs",
    title: "Unfinished repairs",
    prompt: "Are there any repairs that still need to be completed?",
    yesPrompt: "What needs fixing, and is anything scheduled?",
    hint: {
      meaning:
        "Anything broken, damaged or unfinished right now: repairs you started but didn't finish, or work a contractor or inspector recommended that hasn't been done.",
      examples: [
        "A cracked window in the upstairs bathroom",
        "A loose deck railing, with a contractor quote but nothing scheduled",
        "Drywall patch that still needs paint",
      ],
      unsure:
        "If you're not sure whether something counts as a repair, choose Not sure and list it. Your agent can decide how it should be described.",
    },
    keywords: ["drywall", "deck railing", "contractor", "estimate", "inspection report"],
  },
];

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export function isQuestionId(value: string): value is QuestionId {
  return BY_ID.has(value as QuestionId);
}

export function getQuestion(id: QuestionId): Question {
  return BY_ID.get(id)!;
}

export function questionNumber(id: QuestionId): number {
  return QUESTIONS.findIndex((q) => q.id === id) + 1;
}

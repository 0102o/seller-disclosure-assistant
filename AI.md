# AI.md

A compact guide for AI assistants (and people) reviewing or changing this repo. README.md has the full reasoning; this file is the map.

## What it is

A Next.js 16 (App Router, React 19, TypeScript) take-home: a homeowner answers five property-disclosure questions (Yes / No / Not sure + optional explanation) by typing or by voice. Voice is recorded in the browser, transcribed on the server with OpenAI, and a small model suggests Yes / No / Not sure. The homeowner reviews and confirms everything; nothing is saved automatically from voice. Answers persist in localStorage. There is no database and no auth.

## Commands

```bash
npm install
cp .env.example .env.local     # OPENAI_API_KEY=...
npm run dev                    # http://localhost:3000
npm test                       # Vitest unit tests (no network)
npm run typecheck              # next typegen && tsc --noEmit
npm run lint
npx playwright install chromium
npm run e2e                    # Playwright; fake microphone; API mocked in the browser
REAL_API=1 npm run e2e -- e2e/real-api.spec.ts   # real API, needs the key
npm run eval                   # scores /api/suggest on evals/suggestions.json; needs npm run dev + key
```

Node: `^22.12.0 || ^24.0.0 || >=26.0.0` (Vitest's range). Next.js allows one dev server per project; Playwright reuses the one on port 3000.

## Request flow (voice)

1. `src/components/VoiceAnswer.tsx` uses `src/hooks/useRecorder.ts` (MediaRecorder; WebM/Opus, MP4 on older Safari; 2-minute cap; live waveform).
2. `src/lib/transcribe-client.ts` posts the clip as multipart to `POST /api/transcribe` (`src/app/api/transcribe/route.ts`).
3. The route checks origin, caps the body while reading it, validates size/type, renames the file to match its container, and calls `transcribeFile()` in `src/lib/openai.ts` (`POST /v1/audio/transcriptions`, model `gpt-transcribe`, question as prompt, `keywords[]` from the question).
4. The transcript is shown in an editable box with three buttons: Save as Yes / No / Not sure.
5. In parallel the client calls `POST /api/suggest` (`src/app/api/suggest/route.ts`) → `requestSuggestion()` in `src/lib/openai.ts` (`POST /v1/responses`, model `gpt-6-luna`, Structured Outputs, `reasoning.effort: "none"`, `temperature: 0`, `store: false`) → `readSuggestion()` in `src/lib/suggestion.ts`, which keeps the result only if its quoted evidence appears in the transcript.
6. The suggested button is highlighted. One tap calls `disclosureActions.choose()` and `disclosureActions.addTranscript()`.

## File map

| Path | Responsibility |
| --- | --- |
| `src/lib/questions.ts` | The five questions, plain-language hints, transcription keywords. Content only. |
| `src/lib/answers.ts` | Types, pure reducer, progress and status selectors. |
| `src/lib/storage.ts` | Versioned localStorage envelope: load (validates, never throws), save, `canSave` probe. |
| `src/lib/answers-store.ts` | localStorage as the source of truth, exposed through `useSyncExternalStore`; action creators. |
| `src/lib/openai.ts` | The only place that reads `OPENAI_API_KEY` (`server-only`). Transcription, suggestion request, error mapping, one retry on network errors. |
| `src/lib/suggestion.ts` | Suggestion type, JSON schema, `readSuggestion()` (parses the Responses output and verifies evidence). |
| `src/lib/same-origin.ts` | Rejects cross-site browser requests to the API routes. Not authentication. |
| `src/lib/transcribe-client.ts` | Browser-side calls to the two routes; error codes. |
| `src/components/*` | Overview, QuestionView, ReviewView, VoiceAnswer, ProgressSummary, StatusTag. |
| `src/app/**` | Pages `/`, `/q/[id]`, `/review`; API routes. |
| `e2e/` | Playwright specs; `fixtures/yes-leak.wav` is the fake microphone input. |
| `evals/` | 79 labelled sample answers, scorer, runner. |

## Invariants (keep these true when changing code)

- The API key is read only in `src/lib/openai.ts`. Never use a `NEXT_PUBLIC_` variable for it and never call OpenAI from client code.
- A suggestion never selects an answer by itself. The homeowner must tap.
- A suggestion is dropped unless its evidence is a verbatim (case and whitespace insensitive) substring of the transcript.
- The seller's words are stored as spoken or as they edited them. The app never rewrites an explanation.
- "Not sure" counts as answered and is flagged for the agent. Notes without a choice do not count.
- Typed answers autosave. Voice answers save only through a Save button.
- Loading saved data must never throw; unknown versions or corrupt data reset to empty.

## Common changes

- Add or edit a question: `src/lib/questions.ts` (ids are a union type), then add cases to `evals/suggestions.json`.
- Change how suggestions are made: `SUGGEST_INSTRUCTIONS` and `requestSuggestion()` in `src/lib/openai.ts`, `readSuggestion()` in `src/lib/suggestion.ts`. Re-run `npm run eval` and compare with the table in README.md.
- Use other models: `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_SUGGEST_MODEL` in `.env.local`.
- Store answers on a server: replace the storage calls in `src/lib/answers-store.ts`; the reducer and selectors don't change.

## Known limitations

Answers live in one browser. E2E tests run in Chromium only. The eval set is 79 sentences written for this project, not real recordings. The API routes have no auth or rate limiting. Live (streaming) transcription was tried and left out; see README.md.

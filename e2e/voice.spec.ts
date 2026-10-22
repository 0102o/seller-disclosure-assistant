import { expect, test, type Page, type Route } from "@playwright/test";

// These tests mock /api/transcribe and /api/suggest so they run without an API key.
// The browser still records real audio from Chromium's fake microphone.

const SPOKEN = "Yes, we had a small leak in the kitchen about two years ago, but it was repaired.";

async function mockVoice(
  page: Page,
  { transcribe, suggest }: { transcribe: (route: Route) => Promise<void>; suggest: (route: Route) => Promise<void> },
) {
  await page.route("**/api/transcribe", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true } });
    await transcribe(route);
  });
  await page.route("**/api/suggest", suggest);
}

async function recordFor(page: Page) {
  await page.getByRole("button", { name: "Answer by voice" }).click();
  await expect(page.getByText("Listening")).toBeVisible();
  // Focus follows the panel, so keyboard users land on Stop.
  await expect(page.getByRole("button", { name: "Stop and transcribe" })).toBeFocused();
  await expect(page.getByText(/0:0[2-9] \/ 2:00/)).toBeVisible();
  await page.getByRole("button", { name: "Stop and transcribe" }).click();
}

test("a spoken answer is reviewed and saved with one tap", async ({ page }) => {
  let upload: Buffer | null = null;
  let suggestBody: unknown = null;
  await mockVoice(page, {
    transcribe: async (route) => {
      upload = route.request().postDataBuffer();
      await route.fulfill({ json: { text: SPOKEN } });
    },
    suggest: async (route) => {
      suggestBody = route.request().postDataJSON();
      await route.fulfill({ json: { suggestion: { choice: "yes", evidence: "we had a small leak in the kitchen" } } });
    },
  });

  await page.goto("/q/water-damage");
  await recordFor(page);

  const transcript = page.getByLabel(/what we heard/);
  await expect(transcript).toHaveValue(SPOKEN);
  await expect(transcript).toBeFocused();

  // The browser sent real audio, named for its container, for this question,
  // and asked for a suggestion based on the transcript.
  expect(upload!.length).toBeGreaterThan(5_000);
  expect(upload!.includes('filename="answer.webm"')).toBe(true);
  expect(upload!.includes("water-damage")).toBe(true);
  await expect(page.getByText(/This sounds like .* based on/)).toBeVisible();
  expect(suggestBody).toEqual({ questionId: "water-damage", transcript: SPOKEN });

  // The suggested answer is highlighted with its evidence, but nothing is chosen yet.
  await expect(page.getByRole("button", { name: /^Save as Yes.*Suggested/ })).toBeVisible();
  await expect(page.getByText("we had a small leak in the kitchen").first()).toBeVisible();
  await expect(page.getByLabel("Yes", { exact: true })).not.toBeChecked();

  await transcript.fill(`${SPOKEN} A plumber fixed it.`);
  await page.getByRole("button", { name: /^Save as Yes/ }).click();

  // One tap sets the answer and adds the homeowner's words.
  await expect(page.getByLabel("Yes", { exact: true })).toBeChecked();
  const details = page.getByLabel("Details");
  await expect(details).toHaveValue(`${SPOKEN} A plumber fixed it.`);
  await expect(details).toBeFocused();

  await page.goto("/review");
  await expect(page.getByText("Includes a spoken answer")).toBeVisible();
});

test("a failed transcription keeps the recording so it can be retried", async ({ page }) => {
  let calls = 0;
  await mockVoice(page, {
    transcribe: async (route) => {
      calls++;
      if (calls === 1) return route.fulfill({ status: 502, json: { error: "unavailable" } });
      await route.fulfill({ json: { text: "No, never." } });
    },
    suggest: (route) => route.fulfill({ json: { suggestion: { choice: "no", evidence: "No, never" } } }),
  });

  await page.goto("/q/roof");
  await recordFor(page);
  await expect(page.getByRole("alert").filter({ hasText: "Voice isn't working right now" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByLabel(/what we heard/)).toHaveValue("No, never.");
  await expect(page.getByRole("button", { name: /^Save as No.*Suggested/ })).toBeVisible();
  expect(calls).toBe(2);
});

test("without a suggestion the homeowner still picks and saves the answer", async ({ page }) => {
  await mockVoice(page, {
    transcribe: (route) => route.fulfill({ json: { text: "We added a half bath downstairs." } }),
    suggest: (route) => route.fulfill({ status: 502, json: { error: "unavailable" } }),
  });

  await page.goto("/q/renovations");
  await recordFor(page);
  await expect(page.getByText("Pick the answer that fits.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Suggested/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Save as Yes" }).click();
  await expect(page.getByLabel("Yes", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Details")).toHaveValue("We added a half bath downstairs.");
});

test("without a key on the server, voice is hidden and typing still works", async ({ page }) => {
  await page.route("**/api/transcribe", (route) => route.fulfill({ json: { configured: false } }));
  await page.goto("/q/renovations");
  await expect(page.getByText("Voice answers aren’t set up on this server")).toBeVisible();
  await expect(page.getByRole("button", { name: "Answer by voice" })).toHaveCount(0);
  await page.getByLabel("Details").fill("Kitchen remodel in 2021.");
  await page.getByLabel("Yes", { exact: true }).check();
  await expect(page.getByText("Saved on this device")).toBeVisible();
});

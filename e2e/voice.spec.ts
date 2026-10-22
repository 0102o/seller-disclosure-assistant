import { expect, test, type Page, type Route } from "@playwright/test";

// These tests mock /api/transcribe so they run without an API key.
// The browser still records real audio from Chromium's fake microphone.

const SPOKEN = "Yes, we had a small leak in the kitchen about two years ago, but it was repaired.";

async function mockTranscribe(page: Page, onPost: (route: Route) => Promise<void>) {
  await page.route("**/api/transcribe", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true } });
    await onPost(route);
  });
}

async function recordFor(page: Page) {
  await page.getByRole("button", { name: "Answer by voice" }).click();
  await expect(page.getByText("Listening")).toBeVisible();
  await expect(page.getByText(/0:0[2-9] \/ 2:00/)).toBeVisible();
  await page.getByRole("button", { name: "Stop and transcribe" }).click();
}

test("a spoken answer is reviewed, the suggestion confirmed, then added", async ({ page }) => {
  let upload: Buffer | null = null;
  await mockTranscribe(page, async (route) => {
    upload = route.request().postDataBuffer();
    await route.fulfill({ json: { text: SPOKEN } });
  });

  await page.goto("/q/water-damage");
  await recordFor(page);

  const transcript = page.getByLabel(/what we heard/);
  await expect(transcript).toHaveValue(SPOKEN);
  await expect(transcript).toBeFocused();

  // The browser sent real audio, named for its container, for this question.
  expect(upload!.length).toBeGreaterThan(5_000);
  expect(upload!.includes('filename="answer.webm"')).toBe(true);
  expect(upload!.includes("water-damage")).toBe(true);

  // A suggestion appears, with its evidence, but nothing is chosen for the homeowner.
  await expect(page.getByText("This sounds like")).toBeVisible();
  await expect(page.getByText("Yes, we had a small leak in the kitchen about two years ago").first()).toBeVisible();
  await expect(page.getByLabel("Yes", { exact: true })).not.toBeChecked();

  await transcript.fill(`${SPOKEN} A plumber fixed it.`);
  await page.getByRole("button", { name: "Choose Yes" }).click();
  await expect(page.getByLabel("Yes", { exact: true })).toBeChecked();

  await page.getByRole("button", { name: "Add to my answer" }).click();
  const details = page.getByLabel("Details");
  await expect(details).toHaveValue(`${SPOKEN} A plumber fixed it.`);
  await expect(details).toBeFocused();

  await page.goto("/review");
  await expect(page.getByText("Includes a spoken answer")).toBeVisible();
});

test("a failed transcription keeps the recording so it can be retried", async ({ page }) => {
  let calls = 0;
  await mockTranscribe(page, async (route) => {
    calls++;
    if (calls === 1) return route.fulfill({ status: 502, json: { error: "unavailable" } });
    await route.fulfill({ json: { text: "No, never." } });
  });

  await page.goto("/q/roof");
  await recordFor(page);
  await expect(page.getByRole("alert").filter({ hasText: "Voice isn't working right now" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByLabel(/what we heard/)).toHaveValue("No, never.");
  await expect(page.getByRole("button", { name: "Choose No" })).toBeVisible();
  expect(calls).toBe(2);
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

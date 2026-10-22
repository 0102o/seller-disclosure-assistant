import { expect, test } from "@playwright/test";

// Opt-in: records the fixture through Chromium's fake microphone and sends it
// to the real API via /api/transcribe and /api/suggest. Needs OPENAI_API_KEY on
// the server. Run with: REAL_API=1 npx playwright test e2e/real-api.spec.ts
test.skip(!process.env.REAL_API, "set REAL_API=1 to call the real API");

test("the fixture recording is transcribed and Yes is suggested", async ({ page }) => {
  await page.goto("/q/water-damage");
  await page.getByRole("button", { name: "Answer by voice" }).click();
  // The fixture is about 7 seconds long.
  await expect(page.getByText(/0:07 \/ 2:00/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Stop and transcribe" }).click();

  await expect(page.getByLabel(/what we heard/)).toHaveValue(/small leak in the kitchen/i, {
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: /^Save as Yes.*Suggested/ })).toBeVisible({
    timeout: 30_000,
  });
});

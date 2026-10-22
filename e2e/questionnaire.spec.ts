import { expect, test, type Page } from "@playwright/test";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

async function choose(page: Page, label: "Yes" | "No" | "Not sure") {
  await page.getByLabel(label, { exact: true }).check();
}

test("answers by typing, survive a refresh, and can be changed from review", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("0 of 5")).toBeVisible();
  await page.getByRole("link", { name: "Start the questions" }).click();

  // Question 1: Yes with an explanation
  await expect(heading(page)).toHaveText("Has the property experienced any water damage?");
  await choose(page, "Yes");
  await page.getByLabel("Details").fill("Small kitchen leak in 2024, repaired.");
  await page.getByRole("link", { name: "Next question" }).click();

  // Question 2: Not sure
  await expect(heading(page)).toHaveText("Are there any known problems with the roof?");
  await choose(page, "Not sure");
  await page.getByRole("link", { name: "Next question" }).click();

  // Question 3: skipped
  await expect(heading(page)).toHaveText("Have any major renovations been completed?");
  await page.getByRole("link", { name: "Skip for now" }).click();

  // Question 4: No, then refresh
  await expect(heading(page)).toHaveText("Are there any known plumbing or electrical issues?");
  await choose(page, "No");
  await page.reload();
  await expect(page.getByLabel("No", { exact: true })).toBeChecked();

  await page.goto("/");
  await expect(page.getByText("3 of 5")).toBeVisible();
  await expect(page.getByText("60% · 2 remaining")).toBeVisible();
  await expect(page.getByText("Ready for agent review")).toHaveCount(0);

  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.getByText("2 questions still need an answer.")).toBeVisible();
  await expect(page.getByText("Small kitchen leak in 2024, repaired.")).toBeVisible();

  // Change the roof answer from the review screen and come back.
  await page.getByRole("link", { name: "Change roof question" }).click();
  await expect(heading(page)).toHaveText("Are there any known problems with the roof?");
  await choose(page, "No");
  await page.getByRole("link", { name: "Back to review" }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByText("marked Not sure")).toHaveCount(0);

  // Answer the remaining questions through the review shortcut.
  for (const prompt of [
    "Have any major renovations been completed?",
    "Are there any repairs that still need to be completed?",
  ]) {
    await page.getByRole("link", { name: "Answer the next one" }).click();
    await expect(heading(page)).toHaveText(prompt);
    await choose(page, "No");
    await page.getByRole("link", { name: "Back to review" }).click();
    await expect(page).toHaveURL(/\/review$/);
  }
  await expect(page.getByText("All 5 questions are answered.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Ready for agent review")).toBeVisible();
});

import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Optional: point at a system Chromium instead of Playwright's bundled one.
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --hostname localhost --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});

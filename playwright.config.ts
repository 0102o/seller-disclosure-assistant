import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = 3123;
// Chromium plays this file as the microphone, so voice tests never need a real mic.
const FAKE_MIC = path.resolve("e2e/fixtures/yes-leak.wav");

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: `http://localhost:${PORT}`,
    permissions: ["microphone"],
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Optional: point at a system Chromium instead of Playwright's bundled one.
          executablePath: process.env.CHROMIUM_PATH || undefined,
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${FAKE_MIC}`,
          ],
        },
      },
    },
  ],
  webServer: {
    command: `npx next dev --hostname localhost --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});

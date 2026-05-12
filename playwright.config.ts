import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: process.env.CI ? "npm run build && npm run start -- --port 3000" : "npm run dev -- --port 3000",
    url: baseURL,
    // CI sometimes pre-starts the server in a separate step.
    // Reuse if something is already listening at PLAYWRIGHT_BASE_URL.
    reuseExistingServer: true,
    timeout: 120_000,
  },
  reporter: [["list"]],
});


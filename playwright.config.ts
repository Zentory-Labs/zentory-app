import { defineConfig } from "@playwright/test";
import fs from "node:fs";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Locate a usable Chromium binary. Newer Playwright versions require a
// matching chromium-headless-shell-* directory under ms-playwright; the
// pre-installed 1.59.x wants 1217 but the cache has 1228. Reuse whatever
// is present (1228 is forward-compatible) by pointing to the full
// chromium binary, which carries a stable manifest version.
const CHROMIUM_CANDIDATES = [
  "C:\\Users\\juan\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe",
  "C:\\Users\\juan\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe",
];
const chromiumExe = CHROMIUM_CANDIDATES.find((p) => fs.existsSync(p));

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    ...(chromiumExe ? { launchOptions: { executablePath: chromiumExe } } : {}),
  },
  webServer: baseURL.startsWith("http://localhost")
    ? {
        command: process.env.CI ? "npm run build && npm run start -- --port 3000" : "npm run dev -- --port 3000",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
  reporter: [["list"]],
});


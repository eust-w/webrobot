import { defineConfig } from "@playwright/test";

const e2ePort = process.env.WEBROBOT_E2E_PORT || "4173";
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  workers: 1,
  expect: {
    timeout: 12_000
  },
  use: {
    baseURL: e2eBaseUrl,
    viewport: { width: 1366, height: 768 },
    trace: "retain-on-failure"
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});

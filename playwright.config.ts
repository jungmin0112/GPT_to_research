import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3127",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  webServer: {
    command: "npx next dev --webpack -H 127.0.0.1 -p 3127",
    url: "http://127.0.0.1:3127",
    timeout: 120000,
    env: {
      APP_MOCK: "1",
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        "--import=./tests/fixtures/material-site.mjs",
      ]
        .filter(Boolean)
        .join(" "),
      MOCK_DATA_DIR: mkdtempSync(join(tmpdir(), "gts-e2e-")),
    },
  },
});

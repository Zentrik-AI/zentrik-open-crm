import { defineConfig, devices } from "@playwright/test";

// A worktree runs on its own port: OPEN_CRM_PORT=5221 npm run test:e2e
const port = Number(process.env.OPEN_CRM_PORT) || 5177;
const folderPort = port + 1;
const browserSpecs = /smoke\.spec\.ts/;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `npm run dev -- --port ${port} --strictPort`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      // The same app on a workspace folder, the way `crm ui` serves it.
      command: `node tests/e2e/folder-server.mjs ${folderPort}`,
      url: `http://127.0.0.1:${folderPort}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      testMatch: browserSpecs,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      testMatch: browserSpecs,
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "folder",
      testMatch: /folder\.spec\.ts/,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${folderPort}` },
    },
  ],
});

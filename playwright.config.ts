import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
    },
  ],
});

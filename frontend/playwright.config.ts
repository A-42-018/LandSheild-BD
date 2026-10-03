import { defineConfig, devices } from "@playwright/test";

const WEB = "http://localhost:3000";
const API_PORT = 8001;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: WEB, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // fresh e2e.db: migrate + seed, then serve (mock OCR/AI providers, relaxed login limiter)
      command: "bash e2e/start-backend.sh",
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- -p 3000",
      url: `${WEB}/en`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}/api/v1`,
        NEXT_PUBLIC_MAP_TILE_URL: "off",
      },
    },
  ],
});

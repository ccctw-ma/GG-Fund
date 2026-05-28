import { defineConfig, devices } from '@playwright/test';

const apiPort = process.env.E2E_API_PORT ?? '48787';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `PORT=${apiPort} bun run dev:api`,
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
    {
      command: `API_PORT=${apiPort} bun run dev:web`,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

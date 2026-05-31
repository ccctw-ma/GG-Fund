import { defineConfig, devices } from '@playwright/test';

const PLAYWRIGHT_SUPABASE_URL = 'https://example.supabase.co';
const PLAYWRIGHT_SUPABASE_ANON_KEY = 'test-anon-key';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: PLAYWRIGHT_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: PLAYWRIGHT_SUPABASE_ANON_KEY,
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

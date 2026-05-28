import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiPort = process.env.API_PORT ?? process.env.PORT ?? '8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['frontend/src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'tests/**/*.test.ts', 'backend/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['frontend/src/**/*.{ts,tsx}', 'backend/**/*.ts', 'shared/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'frontend/src/vite-env.d.ts'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});

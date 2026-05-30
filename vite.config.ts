import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['frontend/src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'tests/**/*.test.ts', 'backend/**/*.test.ts', 'lib/**/*.test.ts', 'features/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.next/**', '.open-next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['frontend/src/**/*.{ts,tsx}', 'backend/**/*.ts', 'shared/**/*.ts', 'features/**/*.ts', 'lib/**/*.ts', 'app/**/*.ts'],
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

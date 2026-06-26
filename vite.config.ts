import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['frontend/src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'tests/**/*.test.ts', 'backend/**/*.test.ts', 'lib/**/*.test.ts', 'features/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.next/**', '.open-next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['frontend/src/**/*.{ts,tsx}', 'backend/**/*.ts', 'shared/**/*.ts', 'features/**/*.ts', 'lib/**/*.ts', 'app/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        'frontend/src/vite-env.d.ts',
        // Large UI orchestration and external adapter files are validated through focused tests plus E2E;
        // keep the hard unit coverage gate on deterministic service, parsing, and utility modules.
        'app/layout.tsx',
        'app/api/ai/analyze-fund/follow-up/route.ts',
        'app/api/ai/analyze-fund/route.ts',
        'app/api/auth/[action]/route.ts',
        'app/api/portfolio/default/route.ts',
        'backend/api.ts',
        'backend/fundAnalysis.ts',
        'backend/local.ts',
        'features/ai/service.ts',
        'features/market/service.ts',
        'frontend/src/App.tsx',
        'frontend/src/api.ts',
        'frontend/src/fundMetrics.ts',
        'frontend/src/holdingCodes.ts',
        'frontend/src/portfolio.ts',
        'frontend/src/storage.ts',
        'frontend/src/components/FundAnalysisPanel.tsx',
        'frontend/src/components/FundSearch.tsx',
        'frontend/src/components/Header.tsx',
        'frontend/src/components/ImportConfirmModal.tsx',
        'frontend/src/components/LoginPage.tsx',
        'frontend/src/components/PortfolioPanel.tsx',
        'frontend/src/components/SettingsPanel.tsx',
        'features/portfolio/localStorage.ts',
        'shared/marketData.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});

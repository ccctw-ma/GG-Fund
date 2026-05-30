import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Resend sender config docs', () => {
  it('documents the Resend-provided sender domain instead of a placeholder custom domain', () => {
    const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
    const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
    const readmeEn = readFileSync(join(process.cwd(), 'README.en.md'), 'utf8');
    const deployment = readFileSync(join(process.cwd(), 'docs/deployment.md'), 'utf8');

    for (const content of [envExample, readme, readmeEn, deployment]) {
      expect(content).toContain('AUTH_EMAIL_FROM="GG Fund <onboarding@resend.dev>"');
      expect(content).not.toContain('login@example.com');
    }

    expect([...envExample.matchAll(/AUTH_EMAIL_FROM="GG Fund <([^>]+)>"/g)].map((match) => match[1])).toEqual(['onboarding@resend.dev']);
  });
});

describe('CI dependency lockfile', () => {
  it('uses a registry reachable from GitHub-hosted runners', () => {
    const lockfile = readFileSync(join(process.cwd(), 'bun.lock'), 'utf8');
    const packageLock = readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8');

    expect(lockfile).not.toContain('https://bnpm.byted.org/');
    expect(packageLock).not.toContain('https://bnpm.byted.org/');
  });
});

describe('CI tracked source files', () => {
  it('includes the shared UI className utility imported by UI components', () => {
    const trackedFiles = execFileSync('git', ['ls-files', 'frontend/src/lib/utils.ts'], { cwd: process.cwd(), encoding: 'utf8' });

    expect(trackedFiles.trim()).toBe('frontend/src/lib/utils.ts');
  });
});

describe('Wrangler OpenNext config', () => {
  it('declares the GG_FUND_DB D1 binding for the Next worker', () => {
    const wranglerJsonc = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8');

    expect(existsSync(join(process.cwd(), 'wrangler.toml'))).toBe(false);
    expect(wranglerJsonc).toContain('"d1_databases"');
    expect(wranglerJsonc).toContain('"binding": "GG_FUND_DB"');
    expect(wranglerJsonc).toContain('"database_name": "gg-fund-db"');
    expect(wranglerJsonc).toContain('"database_id": "2b9e820e-7895-429c-9f4d-195af56ac38f"');
    expect(wranglerJsonc).toContain('"migrations_dir": "migrations"');
  });
});

describe('Playwright Next.js smoke config', () => {
  it('runs the Next-only core smoke spec through the Next dev server', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const playwrightConfig = readFileSync(join(process.cwd(), 'playwright.config.ts'), 'utf8');

    expect(packageJson.scripts?.['test:e2e']).toBe('playwright test tests/e2e/next-core.spec.ts');
    expect(playwrightConfig).toContain("baseURL: 'http://127.0.0.1:3000'");
    expect(playwrightConfig).toContain("command: 'bun run dev'");
    expect(playwrightConfig).toContain("url: 'http://127.0.0.1:3000'");
    expect(playwrightConfig).not.toContain('dev:web');
    expect(playwrightConfig).not.toContain('dev:api');
    expect(playwrightConfig).not.toContain('localhost:5173');
  });
});

describe('Cloudflare deploy verification config', () => {
  it('builds, migrates, deploys, and verifies the OpenNext worker with configurable env wiring', () => {
    const deployScript = readFileSync(join(process.cwd(), 'scripts/deploy-cloudflare.sh'), 'utf8');
    const verifyScript = readFileSync(join(process.cwd(), 'scripts/verify-cloudflare.sh'), 'utf8');
    const installScript = readFileSync(join(process.cwd(), 'scripts/ci-install.sh'), 'utf8');
    const ciScript = readFileSync(join(process.cwd(), 'scripts/ci-test.sh'), 'utf8');
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/cloudflare-deploy.yml'), 'utf8');

    expect(deployScript).toContain('CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"');
    expect(deployScript).toContain('CF_D1_DATABASE="${CF_D1_DATABASE:-gg-fund-db}"');
    expect(deployScript).toContain('CF_D1_MIGRATIONS_DIR="${CF_D1_MIGRATIONS_DIR:-migrations}"');
    expect(deployScript).toContain('bun run build');
    expect(deployScript).toContain('bunx --package @opennextjs/cloudflare opennextjs-cloudflare build');
    expect(deployScript).toContain('bunx wrangler d1 migrations apply "${CF_D1_DATABASE}" --remote --config wrangler.jsonc --migrations-dir "${CF_D1_MIGRATIONS_DIR}"');
    expect(deployScript).toContain('bunx wrangler deploy --config wrangler.jsonc --name "${CF_WORKER_NAME}"');
    expect(deployScript).not.toContain('opennextjs-cloudflare deploy');

    expect(verifyScript).toContain('CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"');
    expect(verifyScript).toContain('CF_VERIFY_BASE_URL="${CF_VERIFY_BASE_URL:-https://${CF_WORKER_NAME}.workers.dev}"');
    expect(verifyScript).not.toContain('pages.dev');

    expect(installScript).toContain('npm ci --include=optional --ignore-scripts');

    expect(ciScript).toContain('bun run lint');
    expect(ciScript).toContain('bun run test');
    expect(ciScript).toContain('bun run coverage');
    expect(ciScript).toContain('bun run build');
    expect(ciScript).toContain('bun run test:e2e');
    expect(ciScript).not.toContain('Pages Functions bundle');

    expect(workflow).toContain("CF_WORKER_NAME: ${{ vars.CF_WORKER_NAME || 'gg-fund' }}");
    expect(workflow).toContain("CF_D1_DATABASE: ${{ vars.CF_D1_DATABASE || 'gg-fund-db' }}");
    expect(workflow).toContain('CF_D1_MIGRATIONS_DIR: migrations');
    expect(workflow).toContain('actions/setup-node@v4');
    expect(workflow).toContain('node-version: 22');
    expect(workflow).toContain('cache: npm');
    expect(workflow).toContain('oven-sh/setup-bun@v2');
    expect(workflow).toContain('bun-version: 1.3.10');
    expect(workflow).toContain('bash scripts/ci-install.sh');
    expect(workflow).not.toContain('bun install --frozen-lockfile --ignore-scripts');
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}');
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}');
    expect(workflow).not.toContain('NEXT_PUBLIC_POSTHOG');
    expect(workflow).toContain('Build OpenNext worker');
    expect(workflow).toContain('bun run build');
    expect(workflow).toContain('bunx --package @opennextjs/cloudflare opennextjs-cloudflare build');
    expect(workflow).toContain('Apply remote D1 migrations');
    expect(workflow).toContain('bunx wrangler d1 migrations apply "${CF_D1_DATABASE}" --remote --config wrangler.jsonc --migrations-dir "${CF_D1_MIGRATIONS_DIR}"');
    expect(workflow).toContain('Deploy Cloudflare worker');
    expect(workflow).toContain('bunx wrangler deploy --config wrangler.jsonc --name "${CF_WORKER_NAME}"');
    expect(workflow).toContain('Verify deployment');
    expect(workflow).toContain("CF_VERIFY_BASE_URL: ${{ vars.CF_VERIFY_BASE_URL || format('https://{0}.workers.dev', vars.CF_WORKER_NAME || 'gg-fund') }}");
    expect(workflow).not.toContain('pages.dev');
    expect(workflow).not.toContain('Deploy Cloudflare Pages');
  });
});

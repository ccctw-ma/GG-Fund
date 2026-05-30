import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CI dependency lockfile', () => {
  it('uses a registry reachable from GitHub-hosted runners', () => {
    const lockfile = readFileSync(join(process.cwd(), 'bun.lock'), 'utf8');

    expect(lockfile).not.toContain('https://bnpm.byted.org/');
  });
});

describe('CI tracked source files', () => {
  it('includes the shared UI className utility imported by UI components', () => {
    const trackedFiles = execFileSync('git', ['ls-files', 'frontend/src/lib/utils.ts'], { cwd: process.cwd(), encoding: 'utf8' });

    expect(trackedFiles.trim()).toBe('frontend/src/lib/utils.ts');
  });
});


describe('Cloudflare deploy verification config', () => {
  it('verifies the deployed Worker surface by default', () => {
    const verifyScript = readFileSync(join(process.cwd(), 'scripts/verify-cloudflare.sh'), 'utf8');
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/cloudflare-deploy.yml'), 'utf8');

    expect(verifyScript).toContain('CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"');
    expect(verifyScript).toContain('CF_VERIFY_BASE_URL="${CF_VERIFY_BASE_URL:-https://${CF_WORKER_NAME}.workers.dev}"');
    expect(verifyScript).not.toContain('pages.dev');
    expect(workflow).toContain('CF_WORKER_NAME: gg-fund');
    expect(workflow).toContain('CF_VERIFY_BASE_URL: https://gg-fund.workers.dev');
    expect(workflow).not.toContain('pages.dev');
  });
});

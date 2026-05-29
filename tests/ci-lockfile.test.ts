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

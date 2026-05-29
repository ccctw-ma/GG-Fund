import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CI dependency lockfile', () => {
  it('uses a registry reachable from GitHub-hosted runners', () => {
    const lockfile = readFileSync(join(process.cwd(), 'bun.lock'), 'utf8');

    expect(lockfile).not.toContain('https://bnpm.byted.org/');
  });
});

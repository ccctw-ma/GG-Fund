import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('Bun runtime compatibility', () => {
  it('starts the API server with SQLite support under Bun', () => {
    const result = spawnSync(
      'bun',
      ['-e', "import { createServer } from './server/index.ts'; const response = await createServer().fetch(new Request('http://local.test/api/health')); console.log(await response.text());"],
      { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, GG_FUND_DB: ':memory:' } },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('"database":true');
  });
});

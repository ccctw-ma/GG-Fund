import { describe, expect, it } from 'bun:test';
import { createDatabaseService } from './database';
import { createServer } from './index';

const marketData = {
  getIndices: async () => [],
  searchFunds: async () => [],
  getFundHistory: async () => [{ date: '2026-05-27', netValue: 1.333 }],
  getTrendingFunds: async () => [],
  getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.3514, officialNetValue: 1.333, dailyChangePercent: 1.38, quoteDate: '2026-05-27', estimateTime: '2026-05-28 14:08', quoteType: 'estimate' as const, source: '天天基金实时估算' }),
};

describe('Bun API routes', () => {
  it('returns health status', async () => {
    const server = createServer({ database: createDatabaseService(':memory:') });
    const response = await server.fetch(new Request('http://local.test/api/health'));

    expect(await response.json()).toEqual({ ok: true, service: 'gg-fund-api', database: true, auth: ['email', 'github', 'wechat', 'phone'], ai: 'deepseek-v4-flash' });
  });

  it('returns fund detail for a known code', async () => {
    const server = createServer({ database: createDatabaseService(':memory:') });
    const response = await server.fetch(new Request('http://local.test/api/funds/000001'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: '000001', name: '华夏成长混合', source: expect.any(String) }),
    );
  });

  it('refreshes fund detail from market data before using cached quotes', async () => {
    const database = createDatabaseService(':memory:');
    database.cacheFundQuote({ code: '000001', name: '旧缓存', netValue: 1, quoteDate: '2026-01-01', source: '缓存' });
    const server = createServer({ database, marketData });

    const response = await server.fetch(new Request('http://local.test/api/funds/000001'));

    expect(await response.json()).toEqual(expect.objectContaining({ name: '华夏成长混合', netValue: 1.3514, source: '天天基金实时估算' }));
  });

  it('creates demo auth sessions for local development', async () => {
    const server = createServer({ database: createDatabaseService(':memory:'), marketData });
    const response = await server.fetch(new Request('http://local.test/api/auth/start', {
      method: 'POST',
      body: JSON.stringify({ provider: 'github', identifier: 'octocat', displayName: 'Octocat' }),
    }));

    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.user).toEqual(expect.objectContaining({ provider: 'github', identifier: 'octocat' }));
  });

  it('reuses existing auth users for repeated local login', async () => {
    const server = createServer({ database: createDatabaseService(':memory:'), marketData });
    const request = () => new Request('http://local.test/api/auth/start', {
      method: 'POST',
      body: JSON.stringify({ provider: 'github', identifier: 'octocat', displayName: 'Octocat' }),
    });

    const first = await server.fetch(request());
    const second = await server.fetch(request());

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await second.json()).user.identifier).toBe('octocat');
  });
  it('analyzes funds with an injected DeepSeek fetcher', async () => {
    let authHeader = '';
    const server = createServer({
      database: createDatabaseService(':memory:'),
      marketData,
      deepSeekApiKey: 'test-secret-key',
      deepSeekFetch: (async (_url, init) => {
        authHeader = init?.headers instanceof Headers ? String(init.headers.get('Authorization')) : String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '');
        return new Response(JSON.stringify({ choices: [{ message: { content: '上涨原因：估算净值走强。' } }] }), { status: 200 });
      }) as typeof fetch,
    });

    const response = await server.fetch(new Request('http://local.test/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: '000001' }),
    }));

    const body = await response.json();
    expect(authHeader).toBe('Bearer test-secret-key');
    expect(body.analysis).toContain('上涨原因');
  });

  it('returns a unified Chinese error for unknown API routes', async () => {
    const server = createServer({ database: createDatabaseService(':memory:') });
    const response = await server.fetch(new Request('http://local.test/api/nope'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
  });
});

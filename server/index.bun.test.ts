import { describe, expect, it } from 'bun:test';
import { createDatabaseService } from './database';
import { createServer } from './index';

describe('Bun API routes', () => {
  it('returns health status', async () => {
    const server = createServer({ database: createDatabaseService(':memory:') });
    const response = await server.fetch(new Request('http://local.test/api/health'));

    expect(await response.json()).toEqual({ ok: true, service: 'gg-fund-api', database: true });
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
    const server = createServer({
      database,
      marketData: {
        getIndices: async () => [],
        searchFunds: async () => [],
        getFundHistory: async () => [],
        getTrendingFunds: async () => [],
        getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.3514, officialNetValue: 1.333, dailyChangePercent: 1.38, quoteDate: '2026-05-27', estimateTime: '2026-05-28 14:08', quoteType: 'estimate', source: '天天基金实时估算' }),
      },
    });

    const response = await server.fetch(new Request('http://local.test/api/funds/000001'));

    expect(await response.json()).toEqual(expect.objectContaining({ name: '华夏成长混合', netValue: 1.3514, source: '天天基金实时估算' }));
  });
  it('returns a unified Chinese error for unknown API routes', async () => {
    const server = createServer({ database: createDatabaseService(':memory:') });
    const response = await server.fetch(new Request('http://local.test/api/nope'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
  });
});

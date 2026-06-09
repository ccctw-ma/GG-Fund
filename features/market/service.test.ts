import { describe, expect, it, vi } from 'vitest';
import { createMarketService } from './service';

const buildService = () =>
  createMarketService({
    marketData: {
      getIndices: async () => [
        { code: '000001.SH', name: '上证指数', value: 3200, change: 10, changePercent: 0.31, quoteTime: '2026-05-30 15:00:00' },
      ],
      getIndexHistory: async (_code: string, range: string) => [{ date: `index-range:${range}`, netValue: 3200 }],
      searchFunds: async (query: string) => [
        { code: '000001', name: `基金-${query}`, netValue: 1.23, quoteDate: '2026-05-30', quoteType: 'official' as const, source: 'test-search' },
      ],
      getFund: async (code: string) =>
        code === '000001'
          ? { code, name: '华夏成长混合', netValue: 1.35, officialNetValue: 1.33, dailyChangePercent: 1.2, quoteDate: '2026-05-30', estimateTime: '2026-05-30 14:30', quoteType: 'estimate' as const, source: 'test-fund' }
          : undefined,
      getFundHistory: async (_code: string, range: string) => [{ date: `range:${range}`, netValue: 1.1 }],
      getFundIntraday: async (code: string) => [{ time: '09:30', price: code === '000001' ? 1.2 : 1.1 }],
      getFundHoldings: async (code: string) => ({ reportDate: '2026-03-31', stocks: [{ code: '600519', name: '贵州茅台', weight: 18.33, industry: '食品饮料', changeType: '增持' }, { code, name: '基金占位', weight: 1 }] }),
      getTrendingFunds: async () => [
        { code: '110022', name: '易方达消费行业股票', netValue: 1.66, quoteDate: '2026-05-30', quoteType: 'official' as const, source: 'test-trending' },
      ],
    },
    cache: {
      get: async () => null,
      put: async () => undefined,
    },
  });

describe('market service', () => {
  it('validates fund codes and search input', async () => {
    const service = buildService();

    await expect(service.searchFunds('消费')).resolves.toEqual([
      expect.objectContaining({ code: '000001', name: '基金-消费' }),
    ]);
    await expect(service.getFund('abc')).rejects.toThrow('基金代码格式不正确');
  });

  it('reads indices, history, and trending funds', async () => {
    const service = buildService();

    await expect(service.getIndices()).resolves.toEqual([
      expect.objectContaining({ code: '000001.SH' }),
    ]);
    await expect(service.getFundHistory('000001', '6m')).resolves.toEqual([
      { date: 'range:6m', netValue: 1.1 },
    ]);
    await expect(service.getFundIntraday('000001')).resolves.toEqual([
      { time: '09:30', price: 1.2 },
    ]);
    await expect(service.getTrendingFunds()).resolves.toEqual([
      expect.objectContaining({ code: '110022' }),
    ]);
  });

  it('reads fund holdings and validates fund codes', async () => {
    const service = buildService();

    await expect(service.getFundHoldings('161725')).resolves.toEqual(
      expect.objectContaining({
        reportDate: '2026-03-31',
        stocks: expect.arrayContaining([
          expect.objectContaining({ code: '600519', name: '贵州茅台', weight: 18.33 }),
        ]),
      }),
    );
    await expect(service.getFundHoldings('bad')).rejects.toThrow('基金代码格式不正确');
  });

  it('reads index history and validates index codes', async () => {
    const service = buildService();

    await expect(service.getIndexHistory('000001.SH', 'all')).resolves.toEqual([
      { date: 'index-range:all', netValue: 3200 },
    ]);
    await expect(service.getIndexHistory('not-a-code')).rejects.toThrow('指数代码格式不正确');
  });

  it('prefers cached non-fallback fund quotes', async () => {
    const service = createMarketService({
      marketData: {
        getIndices: async () => [],
        getIndexHistory: async () => [],
        searchFunds: async () => [],
        getFund: async () => {
          throw new Error('should not call upstream');
        },
        getFundHistory: async () => [],
        getFundIntraday: async () => [],
        getFundHoldings: async () => ({ stocks: [] }),
        getTrendingFunds: async () => [],
      },
      cache: {
        get: async () => JSON.stringify({ code: '000001', name: '缓存基金', netValue: 9.9, quoteDate: '2026-05-30', source: 'KV缓存' }),
        put: async () => undefined,
      },
    });

    await expect(service.getFund('000001')).resolves.toEqual(
      expect.objectContaining({ name: '缓存基金', source: 'KV缓存' }),
    );
  });

  it('caches live fund quotes and ignores invalid cached payloads', async () => {
    const put = vi.fn(async () => undefined);
    const service = createMarketService({
      marketData: {
        getIndices: async () => [],
        getIndexHistory: async () => [],
        searchFunds: async () => [],
        getFund: async () => ({ code: '000001', name: '实时基金', netValue: 1.2, quoteDate: '2026-06-09', source: '实时源' }),
        getFundHistory: async () => [],
        getFundIntraday: async () => [],
        getFundHoldings: async () => ({ stocks: [] }),
        getTrendingFunds: async () => [],
      },
      cache: {
        get: async () => '{',
        put,
      },
    });

    await expect(service.getFund('000001')).resolves.toEqual(expect.objectContaining({ name: '实时基金' }));
    expect(put).toHaveBeenCalledWith(
      'fund:000001',
      expect.stringContaining('实时基金'),
      { expirationTtl: 60 },
    );
  });

  it('falls back to exact search results before returning not found', async () => {
    const put = vi.fn(async () => undefined);
    const service = createMarketService({
      marketData: {
        getIndices: async () => [],
        getIndexHistory: async () => [],
        searchFunds: async () => [
          { code: '000001', name: '搜索基金', netValue: 1.1, quoteDate: '2026-06-09', source: '搜索源' },
        ],
        getFund: async () => undefined,
        getFundHistory: async () => [],
        getFundIntraday: async () => [],
        getFundHoldings: async () => ({ stocks: [] }),
        getTrendingFunds: async () => [],
      },
      cache: {
        get: async () => JSON.stringify({ code: '000001', name: '内置基金', netValue: 1, quoteDate: '2026-06-09', source: '内置示例行情' }),
        put,
      },
    });

    await expect(service.getFund('000001')).resolves.toEqual(expect.objectContaining({ name: '搜索基金' }));
    expect(put).toHaveBeenCalledWith('fund:000001', expect.stringContaining('搜索基金'), { expirationTtl: 60 });
  });

  it('returns not found and validates fund-dependent routes', async () => {
    const service = createMarketService({
      marketData: {
        getIndices: async () => [],
        getIndexHistory: async () => [],
        searchFunds: async () => [],
        getFund: async () => undefined,
        getFundHistory: async () => [],
        getFundIntraday: async () => [],
        getFundHoldings: async () => ({ stocks: [] }),
        getTrendingFunds: async () => [],
      },
    });

    await expect(service.getFund('999999')).rejects.toThrow('未找到该基金');
    await expect(service.getFundHistory('bad')).rejects.toThrow('基金代码格式不正确');
    await expect(service.getFundIntraday('bad')).rejects.toThrow('基金代码格式不正确');
  });
});

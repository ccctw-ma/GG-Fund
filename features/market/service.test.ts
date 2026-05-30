import { describe, expect, it } from 'vitest';
import { createMarketService } from './service';

const buildService = () =>
  createMarketService({
    marketData: {
      getIndices: async () => [
        { code: '000001.SH', name: '上证指数', value: 3200, change: 10, changePercent: 0.31, quoteTime: '2026-05-30 15:00:00' },
      ],
      searchFunds: async (query: string) => [
        { code: '000001', name: `基金-${query}`, netValue: 1.23, quoteDate: '2026-05-30', quoteType: 'official' as const, source: 'test-search' },
      ],
      getFund: async (code: string) =>
        code === '000001'
          ? { code, name: '华夏成长混合', netValue: 1.35, officialNetValue: 1.33, dailyChangePercent: 1.2, quoteDate: '2026-05-30', estimateTime: '2026-05-30 14:30', quoteType: 'estimate' as const, source: 'test-fund' }
          : undefined,
      getFundHistory: async (_code: string, range: string) => [{ date: `range:${range}`, netValue: 1.1 }],
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
    await expect(service.getTrendingFunds()).resolves.toEqual([
      expect.objectContaining({ code: '110022' }),
    ]);
  });

  it('prefers cached non-fallback fund quotes', async () => {
    const service = createMarketService({
      marketData: {
        getIndices: async () => [],
        searchFunds: async () => [],
        getFund: async () => {
          throw new Error('should not call upstream');
        },
        getFundHistory: async () => [],
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
});

import { beforeEach, describe, expect, it } from 'vitest';
import { exportLocalData, loadHoldings, loadWatchlist, parseImportedData, saveHoldings, saveWatchlist } from './storage';

describe('parseImportedData', () => {
  it('accepts valid exported holdings and watchlist data', () => {
    const result = parseImportedData(
      JSON.stringify({
        holdings: [
          {
            id: 'h-1',
            fundCode: '000001',
            fundName: '华夏成长混合',
            shares: 100,
            costAmount: 123.45,
            createdAt: '2026-05-28T00:00:00.000Z',
            updatedAt: '2026-05-28T00:00:00.000Z',
          },
        ],
        watchlist: [
          {
            fundCode: '110022',
            fundName: '易方达消费行业股票',
            createdAt: '2026-05-28T00:00:00.000Z',
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.holdings[0].fundCode).toBe('000001');
      expect(result.data.watchlist[0].fundCode).toBe('110022');
    }
  });

  it('rejects invalid holding numbers with a Chinese error message', () => {
    const result = parseImportedData(
      JSON.stringify({
        holdings: [
          {
            id: 'h-1',
            fundCode: '000001',
            fundName: '华夏成长混合',
            shares: -1,
            costAmount: 123.45,
            createdAt: '2026-05-28T00:00:00.000Z',
            updatedAt: '2026-05-28T00:00:00.000Z',
          },
        ],
        watchlist: [],
      }),
    );

    expect(result).toEqual({ ok: false, error: '第 1 条持仓需要份额或持有金额' });
  });

  it('rejects malformed imports with precise validation errors', () => {
    expect(parseImportedData('{bad json')).toEqual({ ok: false, error: '导入文件不是有效 JSON' });
    expect(parseImportedData('[]')).toEqual({ ok: false, error: '导入文件格式不正确' });
    expect(parseImportedData(JSON.stringify({ watchlist: [] }))).toEqual({ ok: false, error: '导入文件缺少 holdings 数组' });
    expect(parseImportedData(JSON.stringify({ holdings: [] }))).toEqual({ ok: false, error: '导入文件缺少 watchlist 数组' });
    expect(parseImportedData(JSON.stringify({ holdings: [null], watchlist: [] }))).toEqual({ ok: false, error: '第 1 条持仓格式不正确' });
    expect(parseImportedData(JSON.stringify({ holdings: [], watchlist: [null] }))).toEqual({ ok: false, error: '第 1 条自选格式不正确' });
  });

  it('normalizes optional holding fields and rejects invalid watchlist fields', () => {
    const parsed = parseImportedData(JSON.stringify({
      holdings: [{
        id: 'h-optional',
        fundCode: '000001',
        fundName: '华夏成长混合',
        recordedMarketValue: 1200,
        costAmount: 1000,
        recordedDailyProfit: Number.NaN,
        accountName: 123,
        platform: 'unknown',
        targetWeight: 0,
        alertPercent: 8,
        purchaseDate: '2026-06-01',
        note: '长期',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      }],
      watchlist: [{ fundCode: '110022', fundName: '易方达消费行业股票', createdAt: '2026-06-01T00:00:00.000Z' }],
    }));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.holdings[0]).toMatchObject({
        recordedMarketValue: 1200,
        targetWeight: 0,
        alertPercent: 8,
        purchaseDate: '2026-06-01',
        note: '长期',
      });
      expect(parsed.data.holdings[0].recordedDailyProfit).toBeUndefined();
      expect(parsed.data.holdings[0].accountName).toBeUndefined();
      expect(parsed.data.holdings[0].platform).toBeUndefined();
    }

    expect(parseImportedData(JSON.stringify({ holdings: [], watchlist: [{ fundCode: '', fundName: '名称', createdAt: '2026-06-01' }] }))).toEqual({
      ok: false,
      error: '第 1 条自选缺少基金代码',
    });
  });
});

describe('browser local storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips saved holdings and watchlist through localStorage', () => {
    const holding = {
      id: 'h-1',
      fundCode: '000001',
      fundName: '华夏成长混合',
      shares: 100,
      costAmount: 123.45,
      createdAt: '2026-05-28T00:00:00.000Z',
      updatedAt: '2026-05-28T00:00:00.000Z',
    };
    const watchItem = {
      fundCode: '110022',
      fundName: '易方达消费行业股票',
      createdAt: '2026-05-28T00:00:00.000Z',
    };

    saveHoldings([holding]);
    saveWatchlist([watchItem]);

    expect(loadHoldings()).toEqual([holding]);
    expect(loadWatchlist()).toEqual([watchItem]);
  });

  it('ignores corrupted cached holdings and watchlist instead of crashing app startup', () => {
    localStorage.setItem('gg-fund:holdings', '{bad json');
    localStorage.setItem('gg-fund:watchlist', '{bad json');

    expect(loadHoldings()).toEqual([]);
    expect(loadWatchlist()).toEqual([]);
  });

  it('ignores invalid cached array shapes and exports formatted local data', () => {
    localStorage.setItem('gg-fund:holdings', JSON.stringify({ bad: true }));
    localStorage.setItem('gg-fund:watchlist', JSON.stringify([{ fundCode: '110022', fundName: '', createdAt: '2026-06-01' }]));

    expect(loadHoldings()).toEqual([]);
    expect(loadWatchlist()).toEqual([]);
    expect(exportLocalData({ holdings: [], watchlist: [] })).toBe(JSON.stringify({ holdings: [], watchlist: [] }, null, 2));
  });
});

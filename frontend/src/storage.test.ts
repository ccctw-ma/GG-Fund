import { beforeEach, describe, expect, it } from 'vitest';
import { loadHoldings, loadWatchlist, parseImportedData, saveHoldings, saveWatchlist } from './storage';

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
});

import { describe, expect, it } from 'vitest';
import { browserPortfolioStorage } from './localStorage';

describe('browserPortfolioStorage', () => {
  it('returns empty data when localStorage is unavailable', () => {
    const storage = browserPortfolioStorage(() => undefined);

    expect(storage.load()).toEqual({ holdings: [], watchlist: [] });
  });

  it('round-trips portfolio data through localStorage', () => {
    const storage = browserPortfolioStorage(() => localStorage);
    const snapshot = {
      holdings: [
        {
          id: 'h-1',
          fundCode: '000001',
          fundName: '华夏成长混合',
          shares: 100,
          costAmount: 120,
          createdAt: '2026-05-30T00:00:00.000Z',
          updatedAt: '2026-05-30T00:00:00.000Z',
        },
      ],
      watchlist: [
        { fundCode: '110022', fundName: '易方达消费行业股票', createdAt: '2026-05-30T00:00:00.000Z' },
      ],
    };

    storage.save(snapshot);

    expect(storage.load()).toEqual(snapshot);
  });

  it('ignores corrupted cache entries', () => {
    localStorage.setItem('gg-fund:holdings', '{bad json');
    localStorage.setItem('gg-fund:watchlist', '{bad json');
    const storage = browserPortfolioStorage(() => localStorage);

    expect(storage.load()).toEqual({ holdings: [], watchlist: [] });
  });
});

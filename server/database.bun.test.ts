import { describe, expect, it } from 'bun:test';
import { createDatabaseService } from './database';

describe('database service', () => {
  it('persists portfolios, holdings, watchlist, and quote cache in SQLite', () => {
    const db = createDatabaseService(':memory:');

    const portfolio = db.createPortfolio('默认组合');
    db.upsertHolding(portfolio.id, {
      fundCode: '000001',
      fundName: '华夏成长混合',
      shares: 1000,
      costAmount: 1234.56,
      purchaseDate: '2026-05-28',
      note: '长期观察',
    });
    db.upsertWatchItem(portfolio.id, { fundCode: '110022', fundName: '易方达消费行业股票' });
    db.cacheFundQuote({ code: '000001', name: '华夏成长混合', netValue: 1.3514, officialNetValue: 1.333, dailyChangePercent: 1.38, quoteDate: '2026-05-27', estimateTime: '2026-05-28 14:08', quoteType: 'estimate', source: '天天基金实时估算' });

    const snapshot = db.getPortfolioSnapshot(portfolio.id);

    expect(snapshot.portfolio.name).toBe('默认组合');
    expect(snapshot.holdings).toEqual([
      expect.objectContaining({ fundCode: '000001', shares: 1000, costAmount: 1234.56 }),
    ]);
    expect(snapshot.watchlist).toEqual([expect.objectContaining({ fundCode: '110022' })]);
    expect(db.getCachedFundQuote('000001')).toEqual(expect.objectContaining({ code: '000001', netValue: 1.3514, officialNetValue: 1.333, estimateTime: '2026-05-28 14:08', quoteType: 'estimate' }));

    db.close();
  });

  it('migrates an existing quote cache table to store estimate fields', () => {
    const db = createDatabaseService(':memory:');
    db.raw.exec('drop table fund_quote_cache');
    db.raw.exec(`
      create table fund_quote_cache (
        code text primary key,
        name text not null,
        net_value real not null,
        daily_change_percent real,
        quote_date text not null,
        source text not null,
        cached_at text not null
      );
    `);

    db.migrate();
    db.cacheFundQuote({ code: '000001', name: '华夏成长混合', netValue: 1.3514, officialNetValue: 1.333, dailyChangePercent: 1.38, quoteDate: '2026-05-27', estimateTime: '2026-05-28 14:08', quoteType: 'estimate', source: '天天基金实时估算' });

    expect(db.getCachedFundQuote('000001')).toEqual(expect.objectContaining({ officialNetValue: 1.333, estimateTime: '2026-05-28 14:08', quoteType: 'estimate' }));
    db.close();
  });
});

import { describe, expect, it } from 'vitest';
import { createPortfolioRepository } from './repository';

class FakePrepared {
  params: unknown[] = [];

  constructor(private readonly db: FakeD1, private readonly sql: string) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T = unknown>() {
    return this.db.first<T>(this.sql, this.params);
  }

  async all<T = unknown>() {
    return { results: this.db.all<T>(this.sql, this.params) };
  }

  async run() {
    this.db.run(this.sql, this.params);
    return { success: true };
  }
}

class FakeD1 {
  portfolios: Array<Record<string, unknown>> = [];
  holdings: Array<Record<string, unknown>> = [];
  watchlist: Array<Record<string, unknown>> = [];

  prepare(sql: string) {
    return new FakePrepared(this, sql);
  }

  first<T>(sql: string, params: unknown[]): T | null {
    if (sql.includes('from portfolios where user_id = ?')) return (this.portfolios.find((item) => item.userId === params[0]) as T) ?? null;
    if (sql.includes('from portfolios where user_id is null')) return (this.portfolios.find((item) => !item.userId) as T) ?? null;
    if (sql.includes('from portfolios where id = ?')) return (this.portfolios.find((item) => item.id === params[0]) as T) ?? null;
    return null;
  }

  all<T>(sql: string, params: unknown[]): T[] {
    if (sql.includes('from holdings')) return this.holdings.filter((item) => item.portfolioId === params[0]) as T[];
    if (sql.includes('from watchlist')) return this.watchlist.filter((item) => item.portfolioId === params[0]) as T[];
    return [];
  }

  run(sql: string, params: unknown[]) {
    if (sql.includes('insert into portfolios')) {
      this.portfolios.push({ id: params[0], userId: params[1], name: params[2], createdAt: params[3], updatedAt: params[4] });
      return;
    }
    if (sql.includes('insert into holdings')) {
      const existing = this.holdings.find((item) => item.portfolioId === params[1] && item.fundCode === params[2]);
      const next = { id: params[0], portfolioId: params[1], fundCode: params[2], fundName: params[3], shares: params[4], costAmount: params[5], purchaseDate: params[6], note: params[7], createdAt: params[8], updatedAt: params[9] };
      if (existing) Object.assign(existing, next, { id: existing.id, createdAt: existing.createdAt });
      else this.holdings.push(next);
      return;
    }
    if (sql.includes('insert into watchlist')) {
      const existing = this.watchlist.find((item) => item.portfolioId === params[0] && item.fundCode === params[1]);
      if (existing) Object.assign(existing, { fundName: params[2] });
      else this.watchlist.push({ portfolioId: params[0], fundCode: params[1], fundName: params[2], createdAt: params[3] });
    }
  }
}

describe('portfolio repository', () => {
  it('creates isolated default portfolios per user', async () => {
    const db = new FakeD1();
    const repository = createPortfolioRepository(db as never, () => '2026-05-30T00:00:00.000Z');

    const alpha = await repository.ensureDefaultPortfolio('alpha');
    const beta = await repository.ensureDefaultPortfolio('beta');

    expect(alpha.id).not.toBe(beta.id);
    expect(db.portfolios).toHaveLength(2);
  });

  it('upserts holdings and watchlist entries into the default snapshot', async () => {
    const db = new FakeD1();
    const repository = createPortfolioRepository(db as never, () => '2026-05-30T00:00:00.000Z');
    const portfolio = await repository.ensureDefaultPortfolio();

    await repository.addHolding(portfolio.id, {
      fundCode: '000001',
      fundName: '华夏成长混合',
      shares: 100,
      costAmount: 120,
      purchaseDate: '2026-05-01',
      note: '核心持仓',
    });
    await repository.addWatchItem(portfolio.id, {
      fundCode: '110022',
      fundName: '易方达消费行业股票',
    });

    const snapshot = await repository.getSnapshot(portfolio.id);

    expect(snapshot).toEqual({
      portfolio: expect.objectContaining({ id: portfolio.id, name: '默认组合' }),
      holdings: [expect.objectContaining({ fundCode: '000001', note: '核心持仓' })],
      watchlist: [expect.objectContaining({ fundCode: '110022' })],
    });
  });
});

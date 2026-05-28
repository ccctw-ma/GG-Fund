import { describe, expect, it } from 'vitest';
import { createCloudflareApi } from './api';

class FakeKV {
  store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

class FakeD1Prepared {
  constructor(private db: FakeD1, private sql: string) {}
  params: unknown[] = [];
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
    return new FakeD1Prepared(this, sql);
  }
  first<T>(sql: string, params: unknown[]): T | null {
    if (sql.includes('from portfolios order by')) return (this.portfolios[0] as T) ?? null;
    if (sql.includes('from portfolios where id')) return (this.portfolios.find((item) => item.id === params[0]) as T) ?? null;
    return null;
  }
  all<T>(sql: string, params: unknown[]): T[] {
    if (sql.includes('from holdings')) return this.holdings.filter((item) => item.portfolioId === params[0]) as T[];
    if (sql.includes('from watchlist')) return this.watchlist.filter((item) => item.portfolioId === params[0]) as T[];
    return [];
  }
  run(sql: string, params: unknown[]) {
    if (sql.includes('insert into portfolios')) this.portfolios.push({ id: params[0], name: params[1], createdAt: params[2], updatedAt: params[3] });
    if (sql.includes('insert into holdings')) this.holdings.push({ id: params[0], portfolioId: params[1], fundCode: params[2], fundName: params[3], shares: params[4], costAmount: params[5], purchaseDate: params[6], note: params[7], createdAt: params[8], updatedAt: params[9] });
    if (sql.includes('insert into watchlist')) this.watchlist.push({ portfolioId: params[0], fundCode: params[1], fundName: params[2], createdAt: params[3] });
  }
}

const env = () => ({
  GG_FUND_DB: new FakeD1(),
  GG_FUND_CACHE: new FakeKV(),
});

describe('Cloudflare API', () => {
  it('reports D1 and KV backend readiness', async () => {
    const api = createCloudflareApi();
    const response = await api.fetch(new Request('https://example.com/api/health'), env());

    await expect(response.json()).resolves.toEqual({ ok: true, service: 'gg-fund-pages-api', database: 'd1', cache: 'kv' });
  });

  it('stores and returns a default portfolio snapshot through D1', async () => {
    const api = createCloudflareApi();
    const bindings = env();

    const response = await api.fetch(new Request('https://example.com/api/portfolio/default'), bindings);
    const snapshot = await response.json();

    expect(snapshot.portfolio.name).toBe('默认组合');
    expect(snapshot.holdings).toEqual([]);
    expect(snapshot.watchlist).toEqual([]);
  });

  it('uses KV cached fund quotes before calling market data', async () => {
    const bindings = env();
    await bindings.GG_FUND_CACHE.put('fund:000001', JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 9.99, quoteDate: '2026-05-28', source: 'KV缓存' }));
    const api = createCloudflareApi({
      marketData: {
        getIndices: async () => [],
        searchFunds: async () => [],
        getFundHistory: async () => [],
        getTrendingFunds: async () => [],
        getFund: async () => { throw new Error('should use kv'); },
      },
    });

    const response = await api.fetch(new Request('https://example.com/api/funds/000001'), bindings);

    await expect(response.json()).resolves.toEqual(expect.objectContaining({ netValue: 9.99, source: 'KV缓存' }));
  });
});

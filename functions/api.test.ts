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
  authUsers: Array<Record<string, unknown>> = [];
  authSessions: Array<Record<string, unknown>> = [];
  prepare(sql: string) {
    return new FakeD1Prepared(this, sql);
  }
  first<T>(sql: string, params: unknown[]): T | null {
    if (sql.includes('from portfolios order by')) return (this.portfolios[0] as T) ?? null;
    if (sql.includes('from portfolios where id')) return (this.portfolios.find((item) => item.id === params[0]) as T) ?? null;
    if (sql.includes('from auth_users where provider')) return (this.authUsers.find((item) => item.provider === params[0] && item.identifier === params[1]) as T) ?? null;
    if (sql.includes('from auth_sessions')) return (this.authSessions.find((item) => item.token === params[0]) as T) ?? null;
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
    if (sql.includes('insert into auth_users')) this.authUsers.push({ id: params[0], provider: params[1], identifier: params[2], displayName: params[3], createdAt: params[4], updatedAt: params[5] });
    if (sql.includes('insert into auth_sessions')) this.authSessions.push({ token: params[0], userId: params[1], createdAt: params[2], expiresAt: params[3] });
  }
}

const env = () => ({
  GG_FUND_DB: new FakeD1(),
  GG_FUND_CACHE: new FakeKV(),
  DEEPSEEK_API_KEY: 'test-secret-key',
});

const marketData = {
  getIndices: async () => [{ code: '000001.SH', name: '上证指数', value: 4098.64, change: 4.91, changePercent: 0.12, quoteTime: '2026-05-28 15:56:54' }],
  searchFunds: async () => [],
  getFundHistory: async () => [{ date: '2026-05-27', netValue: 1.333 }],
  getTrendingFunds: async () => [],
  getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.3503, officialNetValue: 1.333, dailyChangePercent: 1.29, quoteDate: '2026-05-27', estimateTime: '2026-05-28 15:00', quoteType: 'estimate' as const, source: '天天基金实时估算' }),
};

describe('Cloudflare API', () => {
  it('reports D1 and KV backend readiness', async () => {
    const api = createCloudflareApi({ marketData });
    const response = await api.fetch(new Request('https://example.com/api/health'), env());

    await expect(response.json()).resolves.toEqual({ ok: true, service: 'gg-fund-pages-api', database: 'd1', cache: 'kv', auth: ['email', 'github', 'wechat', 'phone'], ai: 'deepseek-v4-flash' });
  });

  it('stores and returns a default portfolio snapshot through D1', async () => {
    const api = createCloudflareApi({ marketData });
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
        ...marketData,
        getFund: async () => { throw new Error('should use kv'); },
      },
    });

    const response = await api.fetch(new Request('https://example.com/api/funds/000001'), bindings);

    await expect(response.json()).resolves.toEqual(expect.objectContaining({ netValue: 9.99, source: 'KV缓存' }));
  });

  it('refreshes stale fallback KV quotes before returning fund detail', async () => {
    const bindings = env();
    await bindings.GG_FUND_CACHE.put('fund:000001', JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-28', source: '内置示例行情' }));
    const api = createCloudflareApi({
      marketData: {
        ...marketData,
        getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-28', source: '内置示例行情' }),
        searchFunds: async () => [{ code: '000001', name: '华夏成长混合', netValue: 1.333, officialNetValue: 1.333, quoteDate: '2026-05-27', quoteType: 'official', source: '东方财富搜索接口' }],
      },
    });

    const response = await api.fetch(new Request('https://example.com/api/funds/000001'), bindings);

    await expect(response.json()).resolves.toEqual(expect.objectContaining({ source: '东方财富搜索接口', quoteType: 'official' }));
  });
  it('creates demo auth sessions for supported login providers', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();
    const response = await api.fetch(new Request('https://example.com/api/auth/start', {
      method: 'POST',
      body: JSON.stringify({ provider: 'github', identifier: 'octocat', displayName: 'Octocat' }),
    }), bindings);

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user).toEqual(expect.objectContaining({ provider: 'github', identifier: 'octocat' }));
    expect(body.session.token).toMatch(/^session_/);
  });

  it('reuses existing auth users for repeated login', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();
    const request = () => new Request('https://example.com/api/auth/start', {
      method: 'POST',
      body: JSON.stringify({ provider: 'github', identifier: 'octocat', displayName: 'Octocat' }),
    });

    const first = await api.fetch(request(), bindings);
    const second = await api.fetch(request(), bindings);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await second.json()).user.identifier).toBe('octocat');
  });
  it('rejects unsupported login providers', async () => {
    const api = createCloudflareApi({ marketData });
    const response = await api.fetch(new Request('https://example.com/api/auth/start', {
      method: 'POST',
      body: JSON.stringify({ provider: 'passwordless' }),
    }), env());

    await expect(response.json()).resolves.toEqual({ error: { code: 'AUTH_PROVIDER_UNSUPPORTED', message: '暂不支持该登录方式' } });
    expect(response.status).toBe(400);
  });

  it('analyzes a fund with DeepSeek using server-side secret only', async () => {
    let authHeader = '';
    const bindings = env();
    await bindings.GG_FUND_CACHE.put('fund:000001', JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 1.333, officialNetValue: 1.333, dailyChangePercent: 1.29, quoteDate: '2026-05-27', quoteType: 'official', source: '东方财富搜索接口' }));
    const api = createCloudflareApi({
      marketData: {
        ...marketData,
        getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.35, dailyChangePercent: 0.8, quoteDate: '2026-05-28', source: '内置示例行情' }),
      },
      deepSeekFetch: (async (_url, init) => {
        authHeader = init?.headers instanceof Headers ? String(init.headers.get('Authorization')) : String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '');
        return new Response(JSON.stringify({ choices: [{ message: { content: '上涨原因：估算净值走强。风险：注意波动。' } }] }), { status: 200 });
      }) as typeof fetch,
    });

    const response = await api.fetch(new Request('https://example.com/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: '000001' }),
    }), bindings);

    const body = await response.json();
    expect(authHeader).toBe('Bearer test-secret-key');
    expect(body.fund.source).toBe('东方财富搜索接口');
    expect(body.analysis).toContain('上涨原因');
    expect(JSON.stringify(body)).not.toContain('test-secret-key');
  });
});

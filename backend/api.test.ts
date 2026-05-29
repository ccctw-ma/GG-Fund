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
  authChallenges: Array<Record<string, unknown>> = [];

  prepare(sql: string) {
    return new FakeD1Prepared(this, sql);
  }

  first<T>(sql: string, params: unknown[]): T | null {
    if (sql.includes('from portfolios where user_id = ?')) return (this.portfolios.find((item) => item.userId === params[0]) as T) ?? null;
    if (sql.includes('from portfolios where user_id is null')) return (this.portfolios.find((item) => !item.userId) as T) ?? null;
    if (sql.includes('from portfolios order by')) return (this.portfolios[0] as T) ?? null;
    if (sql.includes('from portfolios where id')) return (this.portfolios.find((item) => item.id === params[0]) as T) ?? null;
    if (sql.includes('from auth_users where provider')) return (this.authUsers.find((item) => item.provider === params[0] && item.identifier === params[1]) as T) ?? null;
    if (sql.includes('from auth_challenges where id')) return (this.authChallenges.find((item) => item.id === params[0]) as T) ?? null;
    if (sql.includes('from auth_sessions s')) {
      const session = this.authSessions.find((item) => item.token === params[0]);
      const user = session ? this.authUsers.find((item) => item.id === session.userId) : undefined;
      return session && user ? ({
        token: session.token,
        userId: session.userId,
        sessionCreatedAt: session.createdAt,
        sessionExpiresAt: session.expiresAt,
        id: user.id,
        provider: user.provider,
        identifier: user.identifier,
        displayName: user.displayName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } as T) : null;
    }
    if (sql.includes('from auth_sessions')) return (this.authSessions.find((item) => item.token === params[0]) as T) ?? null;
    return null;
  }

  all<T>(sql: string, params: unknown[]): T[] {
    if (sql.includes('from holdings')) return this.holdings.filter((item) => item.portfolioId === params[0]) as T[];
    if (sql.includes('from watchlist')) return this.watchlist.filter((item) => item.portfolioId === params[0]) as T[];
    return [];
  }

  run(sql: string, params: unknown[]) {
    if (sql.includes('insert into portfolios')) this.portfolios.push({ id: params[0], userId: params[1], name: params[2], createdAt: params[3], updatedAt: params[4] });
    if (sql.includes('insert into holdings')) this.holdings.push({ id: params[0], portfolioId: params[1], fundCode: params[2], fundName: params[3], shares: params[4], costAmount: params[5], purchaseDate: params[6], note: params[7], createdAt: params[8], updatedAt: params[9] });
    if (sql.includes('insert into watchlist')) this.watchlist.push({ portfolioId: params[0], fundCode: params[1], fundName: params[2], createdAt: params[3] });
    if (sql.includes('insert into auth_users')) this.authUsers.push({ id: params[0], provider: params[1], identifier: params[2], displayName: params[3], createdAt: params[4], updatedAt: params[5] });
    if (sql.includes('insert into auth_sessions')) this.authSessions.push({ token: params[0], userId: params[1], createdAt: params[2], expiresAt: params[3] });
    if (sql.includes('insert into auth_challenges')) this.authChallenges.push({ id: params[0], provider: params[1], identifier: params[2], code: params[3], createdAt: params[4], expiresAt: params[5], consumedAt: null });
    if (sql.includes('delete from auth_sessions')) this.authSessions = this.authSessions.filter((item) => item.token !== params[0]);
    if (sql.includes('update auth_challenges set consumed_at')) {
      const challenge = this.authChallenges.find((item) => item.id === params[1]);
      if (challenge) challenge.consumedAt = params[0];
    }
  }
}

const env = () => ({
  GG_FUND_DB: new FakeD1(),
  GG_FUND_CACHE: new FakeKV(),
  DEEPSEEK_API_KEY: 'test-secret-key',
  GITHUB_CLIENT_ID: 'github-client-id',
  WECHAT_CLIENT_ID: 'wechat-client-id',
});

const marketData = {
  getIndices: async () => [{ code: '000001.SH', name: '上证指数', value: 4098.64, change: 4.91, changePercent: 0.12, quoteTime: '2026-05-28 15:56:54' }],
  searchFunds: async () => [{ code: '000001', name: '华夏成长混合', netValue: 1.333, officialNetValue: 1.333, quoteDate: '2026-05-27', quoteType: 'official' as const, source: '东方财富搜索接口' }],
  getFundHistory: async () => [{ date: '2026-05-27', netValue: 1.333 }],
  getTrendingFunds: async () => [],
  getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.3503, officialNetValue: 1.333, dailyChangePercent: 1.29, quoteDate: '2026-05-27', estimateTime: '2026-05-28 15:00', quoteType: 'estimate' as const, source: '天天基金实时估算' }),
};

describe('Cloudflare API', () => {
  it('reports D1, KV, auth, and agent readiness', async () => {
    const api = createCloudflareApi({ marketData });
    const response = await api.fetch(new Request('https://example.com/api/health'), env());

    await expect(response.json()).resolves.toEqual({ ok: true, service: 'gg-fund-pages-api', database: 'd1', cache: 'kv', auth: ['email-otp', 'phone-otp', 'github-oauth', 'wechat-oauth'], ai: 'deepseek-v4-flash-agent' });
  });

  it('starts OTP challenge for email and verifies code before creating a session', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();
    const challengeResponse = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'demo@example.com' }),
    }), bindings);
    const challenge = await challengeResponse.json();

    expect(challengeResponse.status).toBe(201);
    expect(challenge.delivery).toBe('email');
    expect(challenge.devCode).toMatch(/^\d{6}$/);

    const verifyResponse = await api.fetch(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), bindings);
    const verified = await verifyResponse.json();

    expect(verifyResponse.status).toBe(201);
    expect(verified.user).toEqual(expect.objectContaining({ provider: 'email', identifier: 'demo@example.com' }));
    expect(verified.session.token).toMatch(/^session_/);
  });

  it('returns OAuth redirect metadata for GitHub and WeChat providers', async () => {
    const api = createCloudflareApi({ marketData });
    const github = await api.fetch(new Request('https://example.com/api/auth/oauth-url?provider=github&redirect=/'), env());
    const wechat = await api.fetch(new Request('https://example.com/api/auth/oauth-url?provider=wechat&redirect=/'), env());

    expect(await github.json()).toEqual(expect.objectContaining({ provider: 'github', authUrl: expect.stringContaining('github.com/login/oauth/authorize') }));
    expect(await wechat.json()).toEqual(expect.objectContaining({ provider: 'wechat', authUrl: expect.stringContaining('open.weixin.qq.com') }));
  });

  it('rejects invalid OTP identifiers before creating a challenge', async () => {
    const api = createCloudflareApi({ marketData });
    const response = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'not-an-email' }),
    }), env());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'AUTH_IDENTIFIER_INVALID', message: '登录标识格式不正确' } });
  });

  it('restores the current user with a valid session token and logs out', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();
    const challengeResponse = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'persist@example.com' }),
    }), bindings);
    const challenge = await challengeResponse.json();
    const verifyResponse = await api.fetch(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), bindings);
    const verified = await verifyResponse.json();

    const meResponse = await api.fetch(new Request('https://example.com/api/auth/me', {
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), bindings);

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toEqual(expect.objectContaining({
      user: expect.objectContaining({ identifier: 'persist@example.com' }),
      session: expect.objectContaining({ token: verified.session.token }),
    }));

    const logoutResponse = await api.fetch(new Request('https://example.com/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), bindings);
    expect(logoutResponse.status).toBe(200);
    await expect(logoutResponse.json()).resolves.toEqual({ ok: true });

    const afterLogout = await api.fetch(new Request('https://example.com/api/auth/me', {
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), bindings);
    expect(afterLogout.status).toBe(401);
  });

  it('keeps authenticated default portfolios isolated by user', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();

    async function login(identifier: string) {
      const challengeResponse = await api.fetch(new Request('https://example.com/api/auth/challenge', {
        method: 'POST',
        body: JSON.stringify({ provider: 'email', identifier }),
      }), bindings);
      const challenge = await challengeResponse.json();
      const verifyResponse = await api.fetch(new Request('https://example.com/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
      }), bindings);
      const verified = await verifyResponse.json();
      return verified.session.token as string;
    }

    const alphaToken = await login('alpha@example.com');
    const betaToken = await login('beta@example.com');

    await api.fetch(new Request('https://example.com/api/portfolio/default/holdings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alphaToken}` },
      body: JSON.stringify({ fundCode: '000001', fundName: '华夏成长混合', shares: 100, costAmount: 120, purchaseDate: '2026-05-29' }),
    }), bindings);

    const alphaPortfolio = await api.fetch(new Request('https://example.com/api/portfolio/default', {
      headers: { Authorization: `Bearer ${alphaToken}` },
    }), bindings);
    const betaPortfolio = await api.fetch(new Request('https://example.com/api/portfolio/default', {
      headers: { Authorization: `Bearer ${betaToken}` },
    }), bindings);

    await expect(alphaPortfolio.json()).resolves.toEqual(expect.objectContaining({
      holdings: [expect.objectContaining({ fundCode: '000001' })],
    }));
    await expect(betaPortfolio.json()).resolves.toEqual(expect.objectContaining({
      holdings: [],
    }));
  });

  it('rejects direct demo session creation', async () => {
    const api = createCloudflareApi({ marketData });
    const response = await api.fetch(new Request('https://example.com/api/auth/start', { method: 'POST', body: JSON.stringify({ provider: 'github' }) }), env());

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: { code: 'AUTH_FLOW_REQUIRED', message: '请使用 OTP 验证或 OAuth 跳转登录' } });
  });

  it('adds holdings and watchlist items through default portfolio endpoints', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();

    const holdingResponse = await api.fetch(new Request('https://example.com/api/portfolio/default/holdings', {
      method: 'POST',
      body: JSON.stringify({ fundCode: '000001', fundName: '华夏成长混合', shares: 1000, costAmount: 1200, purchaseDate: '2026-05-29', note: '核心持仓' }),
    }), bindings);
    const holdingSnapshot = await holdingResponse.json();

    expect(holdingResponse.status).toBe(201);
    expect(holdingSnapshot.portfolio.name).toBe('默认组合');
    expect(holdingSnapshot.holdings).toEqual([
      expect.objectContaining({ fundCode: '000001', fundName: '华夏成长混合', shares: 1000, costAmount: 1200, purchaseDate: '2026-05-29', note: '核心持仓' }),
    ]);

    const watchResponse = await api.fetch(new Request('https://example.com/api/portfolio/default/watchlist', {
      method: 'POST',
      body: JSON.stringify({ fundCode: '110022', fundName: '易方达消费行业股票' }),
    }), bindings);
    const watchSnapshot = await watchResponse.json();

    expect(watchResponse.status).toBe(201);
    expect(watchSnapshot.watchlist).toEqual([
      expect.objectContaining({ fundCode: '110022', fundName: '易方达消费行业股票' }),
    ]);
  });

  it('uses KV cached fund quotes before calling market data', async () => {
    const bindings = env();
    await bindings.GG_FUND_CACHE.put('fund:000001', JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 9.99, quoteDate: '2026-05-28', source: 'KV缓存' }));
    const api = createCloudflareApi({ marketData: { ...marketData, getFund: async () => { throw new Error('should use kv'); } } });

    const response = await api.fetch(new Request('https://example.com/api/funds/000001'), bindings);

    await expect(response.json()).resolves.toEqual(expect.objectContaining({ netValue: 9.99, source: 'KV缓存' }));
  });

  it('refreshes stale fallback KV quotes before returning fund detail', async () => {
    const bindings = env();
    await bindings.GG_FUND_CACHE.put('fund:000001', JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-28', source: '内置示例行情' }));
    const api = createCloudflareApi({ marketData: { ...marketData, getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-28', source: '内置示例行情' }) } });

    const response = await api.fetch(new Request('https://example.com/api/funds/000001'), bindings);

    await expect(response.json()).resolves.toEqual(expect.objectContaining({ source: '东方财富搜索接口', quoteType: 'official' }));
  });

  it('analyzes a fund through an agent pipeline with server-side secret only', async () => {
    let authHeader = '';
    const bindings = env();
    await bindings.GG_FUND_CACHE.put('fund:000001', JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 1.333, officialNetValue: 1.333, dailyChangePercent: 1.29, quoteDate: '2026-05-27', quoteType: 'official', source: '东方财富搜索接口' }));
    const api = createCloudflareApi({
      marketData: { ...marketData, getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.35, dailyChangePercent: 0.8, quoteDate: '2026-05-28', source: '内置示例行情' }) },
      deepSeekFetch: (async (_url, init) => {
        authHeader = init?.headers instanceof Headers ? String(init.headers.get('Authorization')) : String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '');
        return new Response(JSON.stringify({ choices: [{ message: { content: '上涨原因：估算净值走强。风险：注意波动。' } }] }), { status: 200 });
      }) as typeof fetch,
    });

    const response = await api.fetch(new Request('https://example.com/api/ai/analyze-fund', { method: 'POST', body: JSON.stringify({ code: '000001' }) }), bindings);
    const body = await response.json();

    expect(authHeader).toBe('Bearer test-secret-key');
    expect(body.fund.source).toBe('东方财富搜索接口');
    expect(body.agent.steps.map((step: { name: string }) => step.name)).toEqual(['collect_market_context', 'evaluate_price_action', 'generate_research_prompt', 'call_deepseek']);
    expect(body.analysis).toContain('上涨原因');
    expect(JSON.stringify(body)).not.toContain('test-secret-key');
  });
});

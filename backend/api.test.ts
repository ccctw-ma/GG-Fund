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
  RESEND_API_KEY: '',
  AUTH_EMAIL_FROM: '',
});

const marketData = {
  getIndices: async () => [{ code: '000001.SH', name: '上证指数', value: 4098.64, change: 4.91, changePercent: 0.12, quoteTime: '2026-05-28 15:56:54' }],
  getIndexHistory: async () => [{ date: '2026-05-27', netValue: 4098.64 }],
  searchFunds: async () => [{ code: '000001', name: '华夏成长混合', netValue: 1.333, officialNetValue: 1.333, quoteDate: '2026-05-27', quoteType: 'official' as const, source: '东方财富搜索接口' }],
  getFundHistory: async () => [{ date: '2026-05-27', netValue: 1.333 }],
  getFundIntraday: async () => [],
  getFundHoldings: async () => ({ reportDate: '2026-03-31', stocks: [{ code: '600519', name: '贵州茅台', weight: 18.33 }] }),
  getTrendingFunds: async () => [],
  getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.3503, officialNetValue: 1.333, dailyChangePercent: 1.29, quoteDate: '2026-05-27', estimateTime: '2026-05-28 15:00', quoteType: 'estimate' as const, source: '天天基金实时估算' }),
};

describe('Cloudflare API', () => {
  it('reports D1, KV, auth, and agent readiness', async () => {
    const api = createCloudflareApi({ marketData });
    const response = await api.fetch(new Request('https://example.com/api/health'), env());

    await expect(response.json()).resolves.toEqual({ ok: true, service: 'gg-fund-pages-api', database: 'd1', cache: 'kv', auth: ['email-otp', 'github-oauth', 'wechat-oauth'], ai: 'deepseek-v4-flash-agent' });
  });

  it('sends an email OTP when mail delivery is configured', async () => {
    const sentMessages: Array<{ url: string; init?: RequestInit }> = [];
    const api = createCloudflareApi({
      marketData,
      emailFetch: (async (url, init) => {
        sentMessages.push({ url: String(url), init });
        return new Response(JSON.stringify({ id: 'email_1' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch,
    });
    const bindings = env();
    bindings.RESEND_API_KEY = 'resend-test-key';
    bindings.AUTH_EMAIL_FROM = 'GG Fund <onboarding@resend.dev>';

    const response = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'demo@example.com' }),
    }), bindings);
    const challenge = await response.json();

    expect(response.status).toBe(201);
    expect(challenge.devCode).toBeUndefined();
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].url).toBe('https://api.resend.com/emails');
    expect(sentMessages[0].init?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer resend-test-key' }));
    expect(JSON.parse(String(sentMessages[0].init?.body))).toEqual(expect.objectContaining({
      from: 'GG Fund <onboarding@resend.dev>',
      to: ['demo@example.com'],
      subject: 'GG Fund 登录验证码',
    }));
    expect(String(sentMessages[0].init?.body)).toContain(String(bindings.GG_FUND_DB.authChallenges[0].code));
  });

  it('returns a specific Resend delivery error when email OTP sending fails', async () => {
    const api = createCloudflareApi({
      marketData,
      emailFetch: (async () => new Response(JSON.stringify({
        message: 'The from address is not verified',
      }), { status: 403, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch,
    });
    const bindings = env();
    bindings.RESEND_API_KEY = 'resend-test-key';
    bindings.AUTH_EMAIL_FROM = 'GG Fund <noreply@example.com>';

    const response = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'demo@example.com' }),
    }), bindings);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'EMAIL_OTP_DELIVERY_FAILED',
        message: '邮件发送失败：Resend 返回 403，{"message":"The from address is not verified"}。请检查 Resend API Key、发件域名验证和 AUTH_EMAIL_FROM 配置。',
      },
    });
  });

  it('returns dev code only when email delivery is not configured', async () => {
    const api = createCloudflareApi({
      marketData,
      emailFetch: (async () => {
        throw new Error('should not send email without configuration');
      }) as unknown as typeof fetch,
    });
    const response = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'demo@example.com' }),
    }), env());
    const challenge = await response.json();

    expect(response.status).toBe(201);
    expect(challenge.devCode).toMatch(/^\d{6}$/);
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

  it('rejects expired OTP challenges before creating a session', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();
    const challengeResponse = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'expired@example.com' }),
    }), bindings);
    const challenge = await challengeResponse.json();
    const storedChallenge = bindings.GG_FUND_DB.authChallenges.find((item) => item.id === challenge.challengeId);
    if (storedChallenge) storedChallenge.expiresAt = '2000-01-01T00:00:00.000Z';

    const verifyResponse = await api.fetch(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), bindings);

    expect(verifyResponse.status).toBe(400);
    expect(bindings.GG_FUND_DB.authSessions).toEqual([]);
    await expect(verifyResponse.json()).resolves.toEqual({ error: { code: 'AUTH_CHALLENGE_INVALID', message: '验证码无效或已过期' } });
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
    await expect(response.json()).resolves.toEqual({ error: { code: 'AUTH_IDENTIFIER_INVALID', message: '邮箱格式不正确' } });
  });

  it('rejects phone OTP because phone login is not supported', async () => {
    const api = createCloudflareApi({ marketData });
    const response = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'phone', identifier: '13800000000' }),
    }), env());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'AUTH_PROVIDER_UNSUPPORTED', message: '暂不支持该登录方式' } });
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

  it('returns intraday trend points from the compatibility API', async () => {
    const api = createCloudflareApi({ marketData: { ...marketData, getFundIntraday: async () => [{ time: '09:30', price: 1.23 }] } });

    const response = await api.fetch(new Request('https://example.com/api/funds/000001/intraday'), env());

    await expect(response.json()).resolves.toEqual([{ time: '09:30', price: 1.23 }]);
  });

  it('analyzes a fund through an agent pipeline with server-side secret only', async () => {
    let authHeader = '';
    const bindings = env();
    await bindings.GG_FUND_CACHE.put('fund:000001', JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 1.333, officialNetValue: 1.333, dailyChangePercent: 1.29, quoteDate: '2026-05-27', quoteType: 'official', source: '东方财富搜索接口' }));
    const api = createCloudflareApi({
      marketData: { ...marketData, getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.35, dailyChangePercent: 0.8, quoteDate: '2026-05-28', source: '内置示例行情' }) },
      deepSeekFetch: (async (_url, init) => {
        authHeader = init?.headers instanceof Headers ? String(init.headers.get('Authorization')) : String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '');
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: '上涨原因：估算净值走强。', trend: '趋势偏强', risk: '风险：注意波动。', scenarios: [{ name: '中性情景', probability: 'medium', description: '维持震荡上行' }], watchPoints: ['最大回撤'], chartAnnotations: [{ label: '动量改善', description: '短期净值走强', tone: 'positive' }], disclaimer: '不构成投资建议' }) } }] }), { status: 200 });
      }) as typeof fetch,
    });

    const response = await api.fetch(new Request('https://example.com/api/ai/analyze-fund', { method: 'POST', body: JSON.stringify({ code: '000001' }) }), bindings);
    const body = await response.json();

    expect(authHeader).toBe('Bearer test-secret-key');
    expect(body.fund.source).toBe('东方财富搜索接口');
    expect(body.agent.steps.map((step: { name: string }) => step.name)).toEqual([
      'collect_fund_quote',
      'collect_history',
      'collect_market_context',
      'compute_indicators',
      'build_research_prompt',
      'call_deepseek',
      'normalize_report',
    ]);
    expect(body.agent.indicators).toEqual(expect.objectContaining({ totalReturn: expect.any(Number), maxDrawdown: expect.any(Number) }));
    expect(body.report).toEqual(expect.objectContaining({ summary: expect.any(String), risk: expect.any(String), scenarios: expect.any(Array) }));
    expect(body.chartAnnotations).toEqual(expect.any(Array));
    expect(body.analysis).toContain('上涨原因');
    expect(JSON.stringify(body)).not.toContain('test-secret-key');
  });

  it('falls back to a deterministic local report when DEEPSEEK_API_KEY is missing', async () => {
    const bindings = env();
    bindings.DEEPSEEK_API_KEY = '';
    await bindings.GG_FUND_CACHE.put('fund:000001', JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 1.333, officialNetValue: 1.333, dailyChangePercent: 1.29, quoteDate: '2026-05-27', quoteType: 'official', source: '东方财富搜索接口' }));
    const api = createCloudflareApi({
      marketData: {
        ...marketData,
        getFundHistory: async () => [
          { date: '2025-06-01', netValue: 1.0 },
          { date: '2025-09-01', netValue: 1.05 },
          { date: '2025-12-01', netValue: 1.1 },
          { date: '2026-03-01', netValue: 1.2 },
          { date: '2026-05-27', netValue: 1.333 },
        ],
      },
      deepSeekFetch: (async () => {
        throw new Error('should not call deepseek');
      }) as unknown as typeof fetch,
    });

    const response = await api.fetch(new Request('https://example.com/api/ai/analyze-fund', { method: 'POST', body: JSON.stringify({ code: '000001' }) }), bindings);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.agent.model).toBe('local-fallback');
    expect(body.agent.steps.map((step: { name: string }) => step.name)).toEqual([
      'collect_fund_quote',
      'collect_history',
      'collect_market_context',
      'compute_indicators',
      'build_research_prompt',
      'call_deepseek',
      'normalize_report',
    ]);
    expect(body.report.summary).toContain('华夏成长混合');
    expect(body.report.disclaimer).toContain('不构成投资建议');
    expect(body.chartAnnotations[0]).toEqual(expect.objectContaining({ label: '本地降级', tone: 'neutral' }));
  });

  it('covers route guards, market endpoints, and fund not found branches', async () => {
    const api = createCloudflareApi({
      marketData: {
        ...marketData,
        getFund: async () => undefined,
        searchFunds: async (query: string) => query === 'missing' ? [] : marketData.searchFunds(),
      },
    });
    const bindings = env();

    await expect((await api.fetch(new Request('https://example.com/api/market/indices'), bindings)).json()).resolves.toEqual([
      expect.objectContaining({ code: '000001.SH' }),
    ]);
    await expect((await api.fetch(new Request('https://example.com/api/funds/search?q=000001'), bindings)).json()).resolves.toEqual([
      expect.objectContaining({ code: '000001' }),
    ]);
    await expect((await api.fetch(new Request('https://example.com/api/funds/trending'), bindings)).json()).resolves.toEqual([]);
    await expect((await api.fetch(new Request('https://example.com/api/funds/000001/history?range=all'), bindings)).json()).resolves.toEqual([
      { date: '2026-05-27', netValue: 1.333 },
    ]);

    const fundMissing = await api.fetch(new Request('https://example.com/api/funds/999999'), bindings);
    expect(fundMissing.status).toBe(404);
    await expect(fundMissing.json()).resolves.toEqual({ error: { code: 'FUND_NOT_FOUND', message: '未找到该基金' } });

    const notFound = await api.fetch(new Request('https://example.com/api/unknown'), bindings);
    expect(notFound.status).toBe(404);
    const method = await api.fetch(new Request('https://example.com/api/health', { method: 'PUT' }), bindings);
    expect(method.status).toBe(405);
  });

  it('reads sessions from cookies, rejects expired sessions, and supports no-token logout', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();
    const challengeResponse = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'cookie@example.com' }),
    }), bindings);
    const challenge = await challengeResponse.json();
    const verifyResponse = await api.fetch(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), bindings);
    const verified = await verifyResponse.json();

    const cookieMe = await api.fetch(new Request('https://example.com/api/auth/me', {
      headers: { Cookie: `foo=bar; gg_fund_session=${encodeURIComponent(verified.session.token)}` },
    }), bindings);
    expect(cookieMe.status).toBe(200);
    await expect(cookieMe.json()).resolves.toEqual(expect.objectContaining({ user: expect.objectContaining({ identifier: 'cookie@example.com' }) }));

    const stored = bindings.GG_FUND_DB.authSessions.find((session) => session.token === verified.session.token);
    if (stored) stored.expiresAt = '2000-01-01T00:00:00.000Z';
    const expired = await api.fetch(new Request('https://example.com/api/auth/me', {
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), bindings);
    expect(expired.status).toBe(401);

    const logout = await api.fetch(new Request('https://example.com/api/auth/logout', { method: 'POST' }), bindings);
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects reused and malformed OTP verification attempts', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();
    const challengeResponse = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'reuse@example.com' }),
    }), bindings);
    const challenge = await challengeResponse.json();

    const wrong = await api.fetch(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: '000000' }),
    }), bindings);
    expect(wrong.status).toBe(400);

    const valid = await api.fetch(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), bindings);
    expect(valid.status).toBe(201);

    const replay = await api.fetch(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), bindings);
    expect(replay.status).toBe(400);
  });

  it('handles AI analysis validation, missing funds, and DeepSeek upstream failures', async () => {
    const invalidApi = createCloudflareApi({ marketData });
    const invalid = await invalidApi.fetch(new Request('https://example.com/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: 'bad' }),
    }), env());
    expect(invalid.status).toBe(400);

    const missingApi = createCloudflareApi({ marketData: { ...marketData, getFund: async () => undefined, searchFunds: async () => [] } });
    const missing = await missingApi.fetch(new Request('https://example.com/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: '999999' }),
    }), env());
    expect(missing.status).toBe(404);

    const upstreamApi = createCloudflareApi({
      marketData,
      deepSeekFetch: (async () => new Response('bad gateway', { status: 502 })) as unknown as typeof fetch,
    });
    const upstream = await upstreamApi.fetch(new Request('https://example.com/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: '000001' }),
    }), env());
    expect(upstream.status).toBe(502);
    await expect(upstream.json()).resolves.toEqual({ error: { code: 'DEEPSEEK_UPSTREAM_ERROR', message: 'DeepSeek 分析服务暂不可用' } });
  });

  it('returns upstream errors when route handlers throw unexpectedly', async () => {
    const api = createCloudflareApi({
      marketData: {
        ...marketData,
        getIndices: async () => {
          throw new Error('network');
        },
      },
    });

    const response = await api.fetch(new Request('https://example.com/api/market/indices'), env());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: { code: 'UPSTREAM_ERROR', message: 'Cloudflare 后端服务暂不可用，请稍后重试' } });
  });
});

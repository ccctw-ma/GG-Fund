import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../lib/http';

const {
  marketService,
  getCloudflareContextMock,
} = vi.hoisted(() => ({
  marketService: {
    getIndices: vi.fn(),
    getIndexHistory: vi.fn(),
    searchFunds: vi.fn(),
    getFund: vi.fn(),
    getFundHistory: vi.fn(),
    getFundIntraday: vi.fn(),
    getFundHoldings: vi.fn(),
    getTrendingFunds: vi.fn(),
  },
  getCloudflareContextMock: vi.fn(),
}));

vi.mock('../features/market/service', () => ({
  getDefaultMarketService: vi.fn(() => marketService),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: getCloudflareContextMock,
}));

vi.mock('../features/ai/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/ai/service')>();
  return {
    ...actual,
    buildAnalyzeFundResponse: vi.fn(),
    streamAnalyzeFundResponse: vi.fn(),
  };
});

vi.mock('../features/ai/recognizeHoldings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/ai/recognizeHoldings')>();
  return {
    ...actual,
    recognizeHoldingsFromImage: vi.fn(),
  };
});

import { buildAnalyzeFundResponse, streamAnalyzeFundResponse } from '../features/ai/service';
import { recognizeHoldingsFromImage } from '../features/ai/recognizeHoldings';
import { GET as getAuth, POST as postAuth } from '../app/api/auth/[action]/route';
import { POST as analyzeFund } from '../app/api/ai/analyze-fund/route';
import { POST as analyzeFundStream } from '../app/api/ai/analyze-fund/stream/route';
import { POST as recognizeHoldings } from '../app/api/ai/recognize-holdings/route';
import { GET as getFund } from '../app/api/funds/[code]/route';
import { GET as getFundHistory } from '../app/api/funds/[code]/history/route';
import { GET as getFundIntraday } from '../app/api/funds/[code]/intraday/route';
import { GET as getFundHoldings } from '../app/api/funds/[code]/holdings/route';
import { GET as searchFunds } from '../app/api/funds/search/route';
import { GET as getTrendingFunds } from '../app/api/funds/trending/route';
import { GET as getHealth } from '../app/api/health/route';
import { GET as getIndices } from '../app/api/market/indices/route';
import { GET as getIndexHistory } from '../app/api/market/indices/[code]/history/route';
import { GET as getDefaultPortfolio, PUT as syncDefaultPortfolio } from '../app/api/portfolio/default/route';

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
  authSessions: Array<Record<string, unknown>> = [];

  prepare(sql: string) {
    return new FakePrepared(this, sql);
  }

  first<T>(sql: string, params: unknown[]): T | null {
    if (sql.includes('from portfolios where user_id = ?')) {
      const portfolio = this.portfolios.find((item) => item.userId === params[0]);
      return portfolio ? ({
        id: portfolio.id,
        name: portfolio.name,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt,
      } as T) : null;
    }
    if (sql.includes('from portfolios where user_id is null')) {
      const portfolio = this.portfolios.find((item) => item.userId == null);
      return portfolio ? ({
        id: portfolio.id,
        name: portfolio.name,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt,
      } as T) : null;
    }
    if (sql.includes('from portfolios where id = ?')) {
      const portfolio = this.portfolios.find((item) => item.id === params[0]);
      return portfolio ? ({
        id: portfolio.id,
        name: portfolio.name,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt,
      } as T) : null;
    }
    if (sql.includes('from auth_sessions where token = ?')) {
      const session = this.authSessions.find((item) => item.token === params[0]);
      return session ? ({
        userId: session.userId,
        expiresAt: session.expiresAt,
      } as T) : null;
    }
    return null;
  }

  all<T>(sql: string, params: unknown[]): T[] {
    if (sql.includes('from holdings')) {
      return this.holdings
        .filter((item) => item.portfolioId === params[0])
        .map((item) => ({
          id: item.id,
          fundCode: item.fundCode,
          fundName: item.fundName,
          shares: item.shares,
          costAmount: item.costAmount,
          recordedMarketValue: item.recordedMarketValue ?? null,
          purchaseDate: item.purchaseDate,
          note: item.note,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })) as T[];
    }
    if (sql.includes('from watchlist')) {
      return this.watchlist
        .filter((item) => item.portfolioId === params[0])
        .map((item) => ({
          fundCode: item.fundCode,
          fundName: item.fundName,
          createdAt: item.createdAt,
        })) as T[];
    }
    return [];
  }

  run(sql: string, params: unknown[]) {
    if (sql.includes('insert into portfolios')) {
      this.portfolios.push({ id: params[0], userId: params[1], name: params[2], createdAt: params[3], updatedAt: params[4] });
      return;
    }
    if (sql.includes('update portfolios set updated_at')) {
      const target = this.portfolios.find((item) => item.id === params[1]);
      if (target) target.updatedAt = params[0];
      return;
    }
    if (sql.includes('delete from holdings')) {
      this.holdings = this.holdings.filter((item) => item.portfolioId !== params[0]);
      return;
    }
    if (sql.includes('delete from watchlist')) {
      this.watchlist = this.watchlist.filter((item) => item.portfolioId !== params[0]);
      return;
    }
    if (sql.includes('insert into holdings')) {
      const existing = this.holdings.find((item) => item.portfolioId === params[1] && item.fundCode === params[2]);
      const next = { id: params[0], portfolioId: params[1], fundCode: params[2], fundName: params[3], shares: params[4], costAmount: params[5], recordedMarketValue: params[6], purchaseDate: params[7], note: params[8], createdAt: params[9], updatedAt: params[10] };
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

const buildAnalyzeFundResponseMock = vi.mocked(buildAnalyzeFundResponse);
const streamAnalyzeFundResponseMock = vi.mocked(streamAnalyzeFundResponse);
const recognizeHoldingsFromImageMock = vi.mocked(recognizeHoldingsFromImage);

function resetMarketServiceMocks() {
  marketService.getIndices.mockReset();
  marketService.getIndexHistory.mockReset();
  marketService.searchFunds.mockReset();
  marketService.getFund.mockReset();
  marketService.getFundHistory.mockReset();
  marketService.getFundIntraday.mockReset();
  marketService.getFundHoldings.mockReset();
  marketService.getTrendingFunds.mockReset();
}

describe('app api routes', () => {
  let previousDb: unknown;
  let hadDb = false;
  let previousDeepSeekApiKey: string | undefined;

  beforeEach(() => {
    hadDb = 'GG_FUND_DB' in globalThis;
    previousDb = (globalThis as { GG_FUND_DB?: unknown }).GG_FUND_DB;
    previousDeepSeekApiKey = process.env.DEEPSEEK_API_KEY;

    resetMarketServiceMocks();
    buildAnalyzeFundResponseMock.mockReset();
    streamAnalyzeFundResponseMock.mockReset();
    recognizeHoldingsFromImageMock.mockReset();
    getCloudflareContextMock.mockReset().mockRejectedValue(new Error('Cloudflare context not available'));
    delete (globalThis as { GG_FUND_DB?: unknown }).GG_FUND_DB;
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
  });

  afterEach(() => {
    if (hadDb) {
      (globalThis as { GG_FUND_DB?: unknown }).GG_FUND_DB = previousDb;
    } else {
      delete (globalThis as { GG_FUND_DB?: unknown }).GG_FUND_DB;
    }

    if (previousDeepSeekApiKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousDeepSeekApiKey;
    }
  });

  it('returns the health readiness payload', async () => {
    const response = await getHealth();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'gg-fund-next-api',
      runtime: 'edge',
      market: 'ready',
      portfolio: 'ready',
      ai: 'deepseek-ready',
      auth: 'resend-email-otp',
    });
  });

  it('returns fallback ai status when DeepSeek key is unavailable', async () => {
    delete process.env.DEEPSEEK_API_KEY;

    const response = await getHealth();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'gg-fund-next-api',
      runtime: 'edge',
      market: 'ready',
      portfolio: 'ready',
      ai: 'local-fallback',
      auth: 'resend-email-otp',
    });
  });

  it('creates and verifies a local Resend OTP session when D1 is unavailable', async () => {
    const previousResendKey = process.env.RESEND_API_KEY;
    const previousEmailFrom = process.env.AUTH_EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    const challengeResponse = await postAuth(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'demo@example.com' }),
    }), { params: Promise.resolve({ action: 'challenge' }) });
    const challenge = await challengeResponse.json() as { challengeId: string; devCode: string };

    const verifyResponse = await postAuth(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), { params: Promise.resolve({ action: 'verify' }) });
    const payload = await verifyResponse.json() as { session: { token: string }; user: { identifier: string } };

    expect(challengeResponse.status).toBe(201);
    expect(verifyResponse.status).toBe(201);
    expect(payload.user.identifier).toBe('demo@example.com');

    const meResponse = await getAuth(new Request('https://example.com/api/auth/me', {
      headers: { Authorization: `Bearer ${payload.session.token}` },
    }), { params: Promise.resolve({ action: 'me' }) });
    expect(meResponse.status).toBe(200);

    if (previousResendKey) process.env.RESEND_API_KEY = previousResendKey;
    if (previousEmailFrom) process.env.AUTH_EMAIL_FROM = previousEmailFrom;
  });

  it('returns market indices', async () => {
    marketService.getIndices.mockResolvedValueOnce([
      { code: '000001.SH', name: '上证指数', value: 3200, change: 10, changePercent: 0.31, quoteTime: '2026-05-30 15:00:00' },
    ]);

    const response = await getIndices();

    expect(marketService.getIndices).toHaveBeenCalledTimes(1);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    await expect(response.json()).resolves.toEqual([
      { code: '000001.SH', name: '上证指数', value: 3200, change: 10, changePercent: 0.31, quoteTime: '2026-05-30 15:00:00' },
    ]);
  });

  it('maps unexpected index upstream failures to 502', async () => {
    marketService.getIndices.mockRejectedValueOnce(new Error('market offline'));

    const response = await getIndices();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'UPSTREAM_ERROR', message: 'Cloudflare 后端服务暂不可用，请稍后重试' },
    });
  });

  it('reads code and range params before returning index history', async () => {
    marketService.getIndexHistory.mockResolvedValueOnce([{ date: '2026-05-29', netValue: 3128.42 }]);

    const response = await getIndexHistory(new Request('https://example.com/api/market/indices/000001.SH/history?range=all'), {
      params: Promise.resolve({ code: '000001.SH' }),
    });

    expect(marketService.getIndexHistory).toHaveBeenCalledWith('000001.SH', 'all');
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate=604800');
    await expect(response.json()).resolves.toEqual([{ date: '2026-05-29', netValue: 3128.42 }]);
  });

  it('maps HttpErrors from index history lookups', async () => {
    marketService.getIndexHistory.mockRejectedValueOnce(new HttpError(400, 'INDEX_CODE_INVALID', '指数代码格式不正确'));

    const response = await getIndexHistory(new Request('https://example.com/api/market/indices/bad/history'), {
      params: Promise.resolve({ code: 'bad' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INDEX_CODE_INVALID', message: '指数代码格式不正确' },
    });
  });

  it('passes the q query param to fund search', async () => {
    marketService.searchFunds.mockResolvedValueOnce([
      { code: '000001', name: '华夏成长混合', netValue: 1.23, quoteDate: '2026-05-30', quoteType: 'official', source: 'test-search' },
    ]);

    const response = await searchFunds(new Request('https://example.com/api/funds/search?q=%E6%B6%88%E8%B4%B9'));

    expect(marketService.searchFunds).toHaveBeenCalledWith('消费');
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
    await expect(response.json()).resolves.toEqual([
      { code: '000001', name: '华夏成长混合', netValue: 1.23, quoteDate: '2026-05-30', quoteType: 'official', source: 'test-search' },
    ]);
  });

  it('maps HttpErrors from fund search', async () => {
    marketService.searchFunds.mockRejectedValueOnce(new HttpError(400, 'FUND_QUERY_INVALID', '查询词不能为空'));

    const response = await searchFunds(new Request('https://example.com/api/funds/search?q='));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FUND_QUERY_INVALID', message: '查询词不能为空' },
    });
  });

  it('resolves dynamic fund params before returning fund details', async () => {
    marketService.getFund.mockResolvedValueOnce({
      code: '000001',
      name: '华夏成长混合',
      netValue: 1.35,
      officialNetValue: 1.33,
      dailyChangePercent: 1.2,
      quoteDate: '2026-05-30',
      estimateTime: '2026-05-30 14:30',
      quoteType: 'estimate',
      source: 'test-fund',
    });

    const response = await getFund(new Request('https://example.com/api/funds/000001'), {
      params: Promise.resolve({ code: '000001' }),
    });

    expect(marketService.getFund).toHaveBeenCalledWith('000001');
    expect(response.headers.get('cache-control')).toContain('s-maxage=120');
    await expect(response.json()).resolves.toEqual({
      code: '000001',
      name: '华夏成长混合',
      netValue: 1.35,
      officialNetValue: 1.33,
      dailyChangePercent: 1.2,
      quoteDate: '2026-05-30',
      estimateTime: '2026-05-30 14:30',
      quoteType: 'estimate',
      source: 'test-fund',
    });
  });

  it('maps unexpected fund lookup failures to 502', async () => {
    marketService.getFund.mockRejectedValueOnce(new Error('lookup timed out'));

    const response = await getFund(new Request('https://example.com/api/funds/000001'), {
      params: Promise.resolve({ code: '000001' }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'UPSTREAM_ERROR', message: 'Cloudflare 后端服务暂不可用，请稍后重试' },
    });
  });

  it('reads code and range params before returning history', async () => {
    marketService.getFundHistory.mockResolvedValueOnce([
      { date: '2026-05-30', netValue: 1.31 },
      { date: '2026-05-31', netValue: 1.33 },
    ]);

    const response = await getFundHistory(new Request('https://example.com/api/funds/000001/history?range=6m'), {
      params: Promise.resolve({ code: '000001' }),
    });

    expect(marketService.getFundHistory).toHaveBeenCalledWith('000001', '6m');
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
    await expect(response.json()).resolves.toEqual([
      { date: '2026-05-30', netValue: 1.31 },
      { date: '2026-05-31', netValue: 1.33 },
    ]);
  });

  it('maps HttpErrors from fund history lookups', async () => {
    marketService.getFundHistory.mockRejectedValueOnce(new HttpError(404, 'FUND_NOT_FOUND', '未找到该基金'));

    const response = await getFundHistory(new Request('https://example.com/api/funds/000001/history'), {
      params: Promise.resolve({ code: '000001' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FUND_NOT_FOUND', message: '未找到该基金' },
    });
  });

  it('returns intraday fund trend points with short edge cache', async () => {
    marketService.getFundIntraday.mockResolvedValueOnce([
      { time: '09:30', price: 1.23, average: 1.22 },
      { time: '10:00', price: 1.25, average: 1.23 },
    ]);

    const response = await getFundIntraday(new Request('https://example.com/api/funds/000001/intraday'), {
      params: Promise.resolve({ code: '000001' }),
    });

    expect(marketService.getFundIntraday).toHaveBeenCalledWith('000001');
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    await expect(response.json()).resolves.toEqual([
      { time: '09:30', price: 1.23, average: 1.22 },
      { time: '10:00', price: 1.25, average: 1.23 },
    ]);
  });

  it('reads the code param before returning fund holdings', async () => {
    marketService.getFundHoldings.mockResolvedValueOnce({
      reportDate: '2026-03-31',
      stocks: [{ code: '600519', name: '贵州茅台', weight: 18.33 }],
    });

    const response = await getFundHoldings(new Request('https://example.com/api/funds/161725/holdings'), {
      params: Promise.resolve({ code: '161725' }),
    });

    expect(marketService.getFundHoldings).toHaveBeenCalledWith('161725');
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
    await expect(response.json()).resolves.toEqual({
      reportDate: '2026-03-31',
      stocks: [{ code: '600519', name: '贵州茅台', weight: 18.33 }],
    });
  });

  it('maps HttpErrors from fund holdings lookups', async () => {
    marketService.getFundHoldings.mockRejectedValueOnce(new HttpError(400, 'FUND_CODE_INVALID', '基金代码格式不正确'));

    const response = await getFundHoldings(new Request('https://example.com/api/funds/bad/holdings'), {
      params: Promise.resolve({ code: 'bad' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FUND_CODE_INVALID', message: '基金代码格式不正确' },
    });
  });

  it('returns trending funds', async () => {
    marketService.getTrendingFunds.mockResolvedValueOnce([
      { code: '110022', name: '易方达消费行业股票', netValue: 1.66, quoteDate: '2026-05-30', quoteType: 'official', source: 'test-trending' },
    ]);

    const response = await getTrendingFunds();

    expect(marketService.getTrendingFunds).toHaveBeenCalledTimes(1);
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
    await expect(response.json()).resolves.toEqual([
      { code: '110022', name: '易方达消费行业股票', netValue: 1.66, quoteDate: '2026-05-30', quoteType: 'official', source: 'test-trending' },
    ]);
  });

  it('maps unexpected trending failures to 502', async () => {
    marketService.getTrendingFunds.mockRejectedValueOnce(new Error('trending unavailable'));

    const response = await getTrendingFunds();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'UPSTREAM_ERROR', message: 'Cloudflare 后端服务暂不可用，请稍后重试' },
    });
  });

  it('returns the default portfolio snapshot from the D1 binding', async () => {
    const db = new FakeD1();
    db.portfolios.push({
      id: 'portfolio-1',
      userId: null,
      name: '默认组合',
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    });
    db.holdings.push({
      id: 'holding-1',
      portfolioId: 'portfolio-1',
      fundCode: '000001',
      fundName: '华夏成长混合',
      shares: 100,
      costAmount: 120,
      purchaseDate: '2026-05-01',
      note: '核心持仓',
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    });
    db.watchlist.push({
      portfolioId: 'portfolio-1',
      fundCode: '110022',
      fundName: '易方达消费行业股票',
      createdAt: '2026-05-30T00:00:00.000Z',
    });
    (globalThis as { GG_FUND_DB?: FakeD1 }).GG_FUND_DB = db;

    const response = await getDefaultPortfolio(new Request('https://example.com/api/portfolio/default'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      portfolio: {
        id: 'portfolio-1',
        name: '默认组合',
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-30T00:00:00.000Z',
      },
      holdings: [
        {
          id: 'holding-1',
          fundCode: '000001',
          fundName: '华夏成长混合',
          shares: 100,
          costAmount: 120,
          recordedMarketValue: null,
          purchaseDate: '2026-05-01',
          note: '核心持仓',
          createdAt: '2026-05-30T00:00:00.000Z',
          updatedAt: '2026-05-30T00:00:00.000Z',
        },
      ],
      watchlist: [
        {
          fundCode: '110022',
          fundName: '易方达消费行业股票',
          createdAt: '2026-05-30T00:00:00.000Z',
        },
      ],
    });
  });

  it('replaces the default portfolio snapshot via PUT sync', async () => {
    const db = new FakeD1();
    db.portfolios.push({
      id: 'portfolio-1',
      userId: null,
      name: '默认组合',
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    });
    db.holdings.push({
      id: 'holding-old',
      portfolioId: 'portfolio-1',
      fundCode: '000001',
      fundName: '旧持仓',
      shares: 100,
      costAmount: 120,
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    });
    (globalThis as { GG_FUND_DB?: FakeD1 }).GG_FUND_DB = db;

    const response = await syncDefaultPortfolio(new Request('https://example.com/api/portfolio/default', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        holdings: [
          { fundCode: 'ALIPAY001', fundName: '支付宝自填持仓', costAmount: 8000, recordedMarketValue: 8500 },
          { fundCode: 'bad', fundName: '无效持仓', costAmount: 0 },
        ],
        watchlist: [{ fundCode: '110022', fundName: '易方达消费行业股票' }],
      }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.holdings).toHaveLength(1);
    expect(payload.holdings[0]).toEqual(expect.objectContaining({ fundCode: 'ALIPAY001', recordedMarketValue: 8500 }));
    expect(payload.watchlist).toEqual([expect.objectContaining({ fundCode: '110022' })]);
  });

  it('rejects PUT sync payloads that are not arrays', async () => {
    const db = new FakeD1();
    (globalThis as { GG_FUND_DB?: FakeD1 }).GG_FUND_DB = db;

    const response = await syncDefaultPortfolio(new Request('https://example.com/api/portfolio/default', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ holdings: 'nope', watchlist: [] }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({ code: 'PORTFOLIO_SYNC_INVALID' }),
    });
  });

  it('returns the signed-in user portfolio instead of the anonymous default when a Resend session is available', async () => {
    const db = new FakeD1();
    db.portfolios.push({
      id: 'portfolio-anon',
      userId: null,
      name: '默认组合',
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    });
    db.portfolios.push({
      id: 'portfolio-user',
      userId: 'user-1',
      name: '我的组合',
      createdAt: '2026-05-30T01:00:00.000Z',
      updatedAt: '2026-05-30T01:00:00.000Z',
    });
    db.holdings.push({
      id: 'holding-user-1',
      portfolioId: 'portfolio-user',
      fundCode: '000003',
      fundName: '中欧医疗健康混合',
      shares: 50,
      costAmount: 80,
      purchaseDate: '2026-05-12',
      note: '登录用户持仓',
      createdAt: '2026-05-30T01:00:00.000Z',
      updatedAt: '2026-05-30T01:00:00.000Z',
    });
    db.watchlist.push({
      portfolioId: 'portfolio-user',
      fundCode: '519674',
      fundName: '银河创新成长混合',
      createdAt: '2026-05-30T01:00:00.000Z',
    });
    db.authSessions.push({
      token: 'session-user-1',
      userId: 'user-1',
      expiresAt: '2999-05-30T01:00:00.000Z',
    });
    (globalThis as { GG_FUND_DB?: FakeD1 }).GG_FUND_DB = db;

    const response = await getDefaultPortfolio(new Request('https://example.com/api/portfolio/default', {
      headers: { Authorization: 'Bearer session-user-1' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      portfolio: {
        id: 'portfolio-user',
        name: '我的组合',
        createdAt: '2026-05-30T01:00:00.000Z',
        updatedAt: '2026-05-30T01:00:00.000Z',
      },
      holdings: [
        {
          id: 'holding-user-1',
          fundCode: '000003',
          fundName: '中欧医疗健康混合',
          shares: 50,
          costAmount: 80,
          recordedMarketValue: null,
          purchaseDate: '2026-05-12',
          note: '登录用户持仓',
          createdAt: '2026-05-30T01:00:00.000Z',
          updatedAt: '2026-05-30T01:00:00.000Z',
        },
      ],
      watchlist: [
        {
          fundCode: '519674',
          fundName: '银河创新成长混合',
          createdAt: '2026-05-30T01:00:00.000Z',
        },
      ],
    });
  });

  it('creates an anonymous default portfolio deliberately when request auth is unavailable', async () => {
    const db = new FakeD1();
    (globalThis as { GG_FUND_DB?: FakeD1 }).GG_FUND_DB = db;

    const response = await getDefaultPortfolio(new Request('https://example.com/api/portfolio/default'));
    const snapshot = await response.json();

    expect(response.status).toBe(200);
    expect(snapshot).toEqual({
      portfolio: expect.objectContaining({ name: '默认组合' }),
      holdings: [],
      watchlist: [],
    });
    expect(db.portfolios).toHaveLength(1);
    expect(db.portfolios[0]?.userId).toBeNull();
  });

  it('reads the D1 binding from the OpenNext Cloudflare context when the global binding is unavailable', async () => {
    const db = new FakeD1();
    db.portfolios.push({
      id: 'portfolio-context',
      userId: null,
      name: '上下文组合',
      createdAt: '2026-05-30T02:00:00.000Z',
      updatedAt: '2026-05-30T02:00:00.000Z',
    });
    getCloudflareContextMock.mockResolvedValueOnce({
      env: { GG_FUND_DB: db },
      cf: undefined,
      ctx: {},
    });

    const response = await getDefaultPortfolio(new Request('https://example.com/api/portfolio/default'));

    expect(getCloudflareContextMock).toHaveBeenCalledWith({ async: true });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      portfolio: {
        id: 'portfolio-context',
        name: '上下文组合',
        createdAt: '2026-05-30T02:00:00.000Z',
        updatedAt: '2026-05-30T02:00:00.000Z',
      },
      holdings: [],
      watchlist: [],
    });
  });

  it('returns a structured 500 when the D1 binding is missing', async () => {
    const response = await getDefaultPortfolio(new Request('https://example.com/api/portfolio/default'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'PORTFOLIO_DB_UNAVAILABLE',
        message: 'GG_FUND_DB is not available in the current runtime',
      },
    });
  });

  it('returns AI analysis for a valid POST payload', async () => {
    buildAnalyzeFundResponseMock.mockResolvedValueOnce({
      fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-30', quoteType: 'official', source: 'test' },
      agent: {
        model: 'deepseek-v4-flash',
        steps: [{ name: 'collect_fund_quote', status: 'done', summary: '读取当前净值' }],
        indicators: { totalReturn: 3.2, maxDrawdown: -1.1, volatility: 0.8, shortMomentum: 0.5, trendSlope: 0.2, sampleSize: 30 },
      },
      report: {
        summary: '基金基本面稳定。',
        trend: '短期趋势偏强。',
        marketDrivers: '上涨原因来自持仓方向和市场风险偏好。',
        outlook: '未来关注指数风格和回撤变化。',
        risk: '注意回撤控制。',
        beginnerGuide: {
          riskLevel: 'R4',
          riskExplanation: '波动中等偏高。',
          netValueExplanation: '净值需要结合成本看。',
          trendExplanation: '趋势偏强但不代表收益承诺。',
          suggestedAction: '继续持有',
          actionPath: ['确认期限', '观察回撤', '分批执行'],
          suitableFor: ['三年以上闲钱'],
          avoid: ['追涨杀跌'],
        },
        scenarios: [],
        watchPoints: ['净值波动'],
        sourceNotes: ['参考公开网页材料。'],
        disclaimer: '不构成投资建议',
      },
      chartAnnotations: [{ label: '趋势改善', description: '净值回升', tone: 'positive' }],
      researchSources: [{ title: '东方财富基金概况', url: 'https://example.com', summary: '基金公开材料' }],
      analysis: '基金基本面稳定。',
    });

    const response = await analyzeFund(new Request('https://example.com/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: '000001' }),
    }));

    expect(buildAnalyzeFundResponseMock).toHaveBeenCalledWith(
      { code: '000001' },
      { marketService, deepSeekApiKey: 'test-deepseek-key' },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-30', quoteType: 'official', source: 'test' },
      agent: {
        model: 'deepseek-v4-flash',
        steps: [{ name: 'collect_fund_quote', status: 'done', summary: '读取当前净值' }],
        indicators: { totalReturn: 3.2, maxDrawdown: -1.1, volatility: 0.8, shortMomentum: 0.5, trendSlope: 0.2, sampleSize: 30 },
      },
      report: {
        summary: '基金基本面稳定。',
        trend: '短期趋势偏强。',
        marketDrivers: '上涨原因来自持仓方向和市场风险偏好。',
        outlook: '未来关注指数风格和回撤变化。',
        risk: '注意回撤控制。',
        beginnerGuide: {
          riskLevel: 'R4',
          riskExplanation: '波动中等偏高。',
          netValueExplanation: '净值需要结合成本看。',
          trendExplanation: '趋势偏强但不代表收益承诺。',
          suggestedAction: '继续持有',
          actionPath: ['确认期限', '观察回撤', '分批执行'],
          suitableFor: ['三年以上闲钱'],
          avoid: ['追涨杀跌'],
        },
        scenarios: [],
        watchPoints: ['净值波动'],
        sourceNotes: ['参考公开网页材料。'],
        disclaimer: '不构成投资建议',
      },
      chartAnnotations: [{ label: '趋势改善', description: '净值回升', tone: 'positive' }],
      researchSources: [{ title: '东方财富基金概况', url: 'https://example.com', summary: '基金公开材料' }],
      analysis: '基金基本面稳定。',
    });
  });

  it('recognizes holdings from an uploaded screenshot via DeepSeek', async () => {
    recognizeHoldingsFromImageMock.mockResolvedValueOnce({
      model: 'deepseek-v4-flash',
      holdings: [{ fundName: '招商中证白酒指数', marketValue: 5000, profit: 420 }],
    });

    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const response = await recognizeHoldings(new Request('https://example.com/api/ai/recognize-holdings', {
      method: 'POST',
      body: JSON.stringify({ imageText: '招商中证白酒指数 5,000.00 +420.00', imageDataUrl: dataUrl }),
    }));

    expect(recognizeHoldingsFromImageMock).toHaveBeenCalledWith(
      { imageText: '招商中证白酒指数 5,000.00 +420.00', imageDataUrl: dataUrl },
      { deepSeekApiKey: 'test-deepseek-key' },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      model: 'deepseek-v4-flash',
      holdings: [{ fundName: '招商中证白酒指数', marketValue: 5000, profit: 420 }],
    });
  });

  it('rejects invalid recognize-holdings payloads before calling the service', async () => {
    const response = await recognizeHoldings(new Request('https://example.com/api/ai/recognize-holdings', {
      method: 'POST',
      body: JSON.stringify({ imageText: '招商中证白酒指数', imageDataUrl: 'not-an-image' }),
    }));

    expect(recognizeHoldingsFromImageMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'IMAGE_DATA_INVALID', message: '图片数据格式不正确，请上传 PNG/JPG/WebP/BMP 截图' },
    });
  });

  it('maps invalid AI payloads to JSON errors', async () => {
    const response = await analyzeFund(new Request('https://example.com/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: 'bad' }),
    }));

    expect(buildAnalyzeFundResponseMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FUND_CODE_INVALID', message: '基金代码格式不正确' },
    });
  });

  it('maps analysis service HttpErrors to JSON responses', async () => {
    buildAnalyzeFundResponseMock.mockRejectedValueOnce(new HttpError(404, 'FUND_NOT_FOUND', '未找到该基金'));

    const response = await analyzeFund(new Request('https://example.com/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: '000001' }),
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FUND_NOT_FOUND', message: '未找到该基金' },
    });
  });

  it('streams AI analysis events with Cloudflare env fallback', async () => {
    getCloudflareContextMock.mockResolvedValueOnce({
      env: { DEEPSEEK_API_KEY: 'cf-deepseek-key' },
      cf: undefined,
      ctx: {},
    });
    streamAnalyzeFundResponseMock.mockImplementationOnce(async (_body, _deps, handlers) => {
      handlers?.onStatus?.('正在连接 DeepSeek...');
      handlers?.onDelta?.('【核心判断】\n基金基本面稳定。');
      return {
        fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-30', quoteType: 'official', source: 'test' },
        agent: {
          model: 'deepseek-v4-flash',
          steps: [{ name: 'call_deepseek', status: 'done', summary: 'streamed' }],
          indicators: { totalReturn: 3.2, maxDrawdown: -1.1, volatility: 0.8, shortMomentum: 0.5, trendSlope: 0.2, sampleSize: 30 },
        },
        report: {
          summary: '基金基本面稳定。',
          trend: '短期趋势偏强。',
          marketDrivers: '上涨原因来自持仓方向和市场风险偏好。',
          outlook: '未来关注指数风格和回撤变化。',
          risk: '注意回撤控制。',
          beginnerGuide: {
            riskLevel: 'R4',
            riskExplanation: '波动中等偏高。',
            netValueExplanation: '净值需要结合成本看。',
            trendExplanation: '趋势偏强但不代表收益承诺。',
            suggestedAction: '继续持有',
            actionPath: ['确认期限', '观察回撤', '分批执行'],
            suitableFor: ['三年以上闲钱'],
            avoid: ['追涨杀跌'],
          },
          scenarios: [],
          watchPoints: ['净值波动'],
          sourceNotes: ['参考公开网页材料。'],
          disclaimer: '不构成投资建议',
        },
        chartAnnotations: [{ label: '趋势改善', description: '净值回升', tone: 'positive' }],
        researchSources: [{ title: '东方财富基金概况', url: 'https://example.com', summary: '基金公开材料' }],
        analysis: '基金基本面稳定。',
      };
    });

    const response = await analyzeFundStream(new Request('https://example.com/api/ai/analyze-fund/stream', {
      method: 'POST',
      body: JSON.stringify({ code: '000001' }),
    }));
    const text = await response.text();
    const events = text.trim().split('\n').map((line) => JSON.parse(line) as { type: string; message?: string; delta?: string; data?: { agent: { model: string } } });

    expect(streamAnalyzeFundResponseMock).toHaveBeenCalledWith(
      { code: '000001' },
      { marketService, deepSeekApiKey: 'cf-deepseek-key' },
      expect.any(Object),
    );
    expect(events[0]).toEqual({ type: 'status', message: '正在连接 DeepSeek...' });
    expect(events[1]?.delta).toContain('核心判断');
    expect(events.at(-1)?.data?.agent.model).toBe('deepseek-v4-flash');
  });

  it('maps unexpected analysis upstream failures to 502', async () => {
    buildAnalyzeFundResponseMock.mockRejectedValueOnce(new Error('deepseek timed out'));

    const response = await analyzeFund(new Request('https://example.com/api/ai/analyze-fund', {
      method: 'POST',
      body: JSON.stringify({ code: '000001' }),
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'UPSTREAM_ERROR', message: 'Cloudflare 后端服务暂不可用，请稍后重试' },
    });
  });
});

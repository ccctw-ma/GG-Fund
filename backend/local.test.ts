import { afterEach, describe, expect, it } from 'vitest';
import { createCloudflareApi } from './api';
import { createLocalCloudflareEnv } from './local';

const marketData = {
  getIndices: async () => [],
  getIndexHistory: async () => [],
  searchFunds: async () => [{ code: '000001', name: '华夏成长混合', netValue: 1.333, quoteDate: '2026-05-29', quoteType: 'official' as const, source: 'test' }],
  getFundHistory: async () => [],
  getFundIntraday: async () => [],
  getFundHoldings: async () => ({ stocks: [] }),
  getTrendingFunds: async () => [],
  getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', source: 'test' }),
};

describe('local Cloudflare bindings adapter', () => {
  const envBackup = {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    WECHAT_CLIENT_ID: process.env.WECHAT_CLIENT_ID,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key as keyof typeof envBackup];
      else process.env[key as keyof typeof envBackup] = value;
    }
  });

  it('creates local KV and forwards process secrets into the env binding', async () => {
    process.env.DEEPSEEK_API_KEY = 'deepseek-local';
    process.env.GITHUB_CLIENT_ID = 'github-local';
    process.env.WECHAT_CLIENT_ID = 'wechat-local';
    process.env.RESEND_API_KEY = 'resend-local';
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';
    const env = createLocalCloudflareEnv();

    await env.GG_FUND_CACHE.put('cache-key', 'cache-value');

    await expect(env.GG_FUND_CACHE.get('cache-key')).resolves.toBe('cache-value');
    await expect(env.GG_FUND_CACHE.get('missing-key')).resolves.toBeNull();
    expect(env).toMatchObject({
      DEEPSEEK_API_KEY: 'deepseek-local',
      GITHUB_CLIENT_ID: 'github-local',
      WECHAT_CLIENT_ID: 'wechat-local',
      RESEND_API_KEY: 'resend-local',
      AUTH_EMAIL_FROM: 'noreply@example.com',
    });
  });

  it('persists default portfolio mutations through the same Functions API', async () => {
    const api = createCloudflareApi({ marketData });
    const env = createLocalCloudflareEnv();

    const addHolding = await api.fetch(new Request('http://local.test/api/portfolio/default/holdings', {
      method: 'POST',
      body: JSON.stringify({ fundCode: '000001', fundName: '华夏成长混合', shares: 100, costAmount: 135 }),
    }), env);
    const addWatch = await api.fetch(new Request('http://local.test/api/portfolio/default/watchlist', {
      method: 'POST',
      body: JSON.stringify({ fundCode: '110022', fundName: '易方达消费行业股票' }),
    }), env);
    const snapshotResponse = await api.fetch(new Request('http://local.test/api/portfolio/default'), env);
    const snapshot = await snapshotResponse.json();

    expect(addHolding.status).toBe(201);
    expect(addWatch.status).toBe(201);
    expect(snapshot.holdings).toEqual([expect.objectContaining({ fundCode: '000001', shares: 100 })]);
    expect(snapshot.watchlist).toEqual([expect.objectContaining({ fundCode: '110022' })]);
  });

  it('stores and consumes OTP challenges in local D1 memory', async () => {
    const api = createCloudflareApi({ marketData });
    const env = createLocalCloudflareEnv();
    const challengeResponse = await api.fetch(new Request('http://local.test/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'demo@example.com' }),
    }), env);
    const challenge = await challengeResponse.json();
    const verifyResponse = await api.fetch(new Request('http://local.test/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), env);
    const replayResponse = await api.fetch(new Request('http://local.test/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), env);

    expect(verifyResponse.status).toBe(201);
    expect(await verifyResponse.json()).toEqual(expect.objectContaining({ user: expect.objectContaining({ identifier: 'demo@example.com' }) }));
    expect(replayResponse.status).toBe(400);
  });

  it('updates existing local holdings and watchlist rows instead of duplicating them', async () => {
    const api = createCloudflareApi({ marketData });
    const env = createLocalCloudflareEnv();

    await api.fetch(new Request('http://local.test/api/portfolio/default/holdings', {
      method: 'POST',
      body: JSON.stringify({ fundCode: '000001', fundName: '旧名称', shares: 100, costAmount: 135 }),
    }), env);
    await api.fetch(new Request('http://local.test/api/portfolio/default/holdings', {
      method: 'POST',
      body: JSON.stringify({ fundCode: '000001', fundName: '新名称', shares: 200, costAmount: 250 }),
    }), env);
    await api.fetch(new Request('http://local.test/api/portfolio/default/watchlist', {
      method: 'POST',
      body: JSON.stringify({ fundCode: '110022', fundName: '旧自选名' }),
    }), env);
    await api.fetch(new Request('http://local.test/api/portfolio/default/watchlist', {
      method: 'POST',
      body: JSON.stringify({ fundCode: '110022', fundName: '新自选名' }),
    }), env);

    const snapshotResponse = await api.fetch(new Request('http://local.test/api/portfolio/default'), env);
    const snapshot = await snapshotResponse.json();

    expect(snapshot.holdings).toHaveLength(1);
    expect(snapshot.holdings[0]).toEqual(expect.objectContaining({ fundCode: '000001', fundName: '新名称', shares: 200 }));
    expect(snapshot.watchlist).toEqual([expect.objectContaining({ fundCode: '110022', fundName: '新自选名' })]);
  });

  it('serves auth metadata, session lookup, logout, options, and method guards locally', async () => {
    const api = createCloudflareApi({ marketData });
    const env = createLocalCloudflareEnv();

    const optionsResponse = await api.fetch(new Request('http://local.test/api/health', { method: 'OPTIONS' }), env);
    expect(optionsResponse.status).toBe(200);

    const githubResponse = await api.fetch(new Request('http://local.test/api/auth/oauth-url?provider=github&redirect=/app'), env);
    const wechatResponse = await api.fetch(new Request('http://local.test/api/auth/oauth-url?provider=wechat'), env);
    const unsupportedResponse = await api.fetch(new Request('http://local.test/api/auth/oauth-url?provider=bad'), env);
    expect(await githubResponse.json()).toEqual(expect.objectContaining({ provider: 'github', configured: false }));
    expect(await wechatResponse.json()).toEqual(expect.objectContaining({ provider: 'wechat', configured: false }));
    expect(unsupportedResponse.status).toBe(400);

    const challengeResponse = await api.fetch(new Request('http://local.test/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'session@example.com' }),
    }), env);
    const challenge = await challengeResponse.json();
    const verifyResponse = await api.fetch(new Request('http://local.test/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), env);
    const verified = await verifyResponse.json();

    const meResponse = await api.fetch(new Request('http://local.test/api/auth/me', {
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), env);
    expect(meResponse.status).toBe(200);
    expect(await meResponse.json()).toEqual(expect.objectContaining({ user: expect.objectContaining({ identifier: 'session@example.com' }) }));

    const logoutResponse = await api.fetch(new Request('http://local.test/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), env);
    expect(logoutResponse.status).toBe(200);

    const loggedOutResponse = await api.fetch(new Request('http://local.test/api/auth/me', {
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), env);
    expect(loggedOutResponse.status).toBe(401);

    const methodResponse = await api.fetch(new Request('http://local.test/api/health', { method: 'PUT' }), env);
    expect(methodResponse.status).toBe(405);
  });
});

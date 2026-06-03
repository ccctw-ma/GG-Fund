import { describe, expect, it } from 'vitest';
import { createCloudflareApi } from './api';
import { createLocalCloudflareEnv } from './local';

const marketData = {
  getIndices: async () => [],
  getIndexHistory: async () => [],
  searchFunds: async () => [{ code: '000001', name: '华夏成长混合', netValue: 1.333, quoteDate: '2026-05-29', quoteType: 'official' as const, source: 'test' }],
  getFundHistory: async () => [],
  getFundHoldings: async () => ({ stocks: [] }),
  getTrendingFunds: async () => [],
  getFund: async () => ({ code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', source: 'test' }),
};

describe('local Cloudflare bindings adapter', () => {
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
});

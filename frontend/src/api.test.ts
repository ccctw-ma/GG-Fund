import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

function installLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
  });
}

describe('frontend api client', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    api.clearSessionToken();
    globalThis.localStorage?.clear();
    vi.restoreAllMocks();
  });

  it('encodes fund search query before calling the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await api.searchFunds('消费 基金');

    expect(fetchMock).toHaveBeenCalledWith('/api/funds/search?q=%E6%B6%88%E8%B4%B9%20%E5%9F%BA%E9%87%91');
  });

  it('surfaces server error messages from JSON error payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: '基金代码格式不正确' } }), { status: 400, headers: { 'content-type': 'application/json' } }),
    );

    await expect(api.getFund('bad')).rejects.toThrow('基金代码格式不正确');
  });

  it('uses generic request errors when error payloads are not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad gateway', { status: 502, headers: { 'content-type': 'text/plain' } }),
    );

    await expect(api.getIndices()).rejects.toThrow('请求失败');
  });

  it('calls unauthenticated GET requests without an options object', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: null }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await api.getCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me');
  });

  it('posts OTP challenge payload as JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ challengeId: 'challenge_1', provider: 'email', identifier: 'demo@example.com', delivery: 'email', expiresAt: '2026-05-29T00:00:00.000Z' }), { status: 201, headers: { 'content-type': 'application/json' } }),
    );

    await api.startAuthChallenge('email', 'demo@example.com');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/challenge', {
      method: 'POST',
      headers: expect.objectContaining({ 'content-type': 'application/json' }),
      body: JSON.stringify({ provider: 'email', identifier: 'demo@example.com' }),
    });
  });

  it('uses generic mutation errors when POST and PUT payloads are not JSON', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('bad request', { status: 500, headers: { 'content-type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response('bad request', { status: 500, headers: { 'content-type': 'text/plain' } }));

    await expect(api.logout()).rejects.toThrow('请求失败');
    await expect(api.syncPortfolio([], [])).rejects.toThrow('请求失败');
  });

  it('posts authenticated mutation payloads', async () => {
    api.saveSessionToken('session_mutation');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => (
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    ));

    await api.logout();
    await api.verifyAuthChallenge('challenge_1', '123456');
    await api.recognizeHoldingsFromImage('data:image/png;base64,abc', '持仓文字');
    await api.syncPortfolio([{ fundCode: '000001' }], [{ fundCode: '110022' }]);

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer session_mutation' }),
      body: '{}',
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/verify', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ challengeId: 'challenge_1', code: '123456' }),
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/recognize-holdings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ imageDataUrl: 'data:image/png;base64,abc', imageText: '持仓文字' }),
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/portfolio/default', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ holdings: [{ fundCode: '000001' }], watchlist: [{ fundCode: '110022' }] }),
    }));
  });

  it('posts fund analysis requests to the AI endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ analysis: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await api.analyzeFund('000001');

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/analyze-fund', {
      method: 'POST',
      headers: expect.objectContaining({ 'content-type': 'application/json' }),
      body: JSON.stringify({ code: '000001' }),
    });
  });

  it('posts fund analysis follow-up questions with context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ answer: 'ok', model: 'deepseek-v4-flash' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await api.askFundAnalysisFollowUp('000001', '后续应该关注什么？', { summary: '基金基本面稳定。', risk: '注意回撤。' });

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/analyze-fund/follow-up', {
      method: 'POST',
      headers: expect.objectContaining({ 'content-type': 'application/json' }),
      body: JSON.stringify({ code: '000001', question: '后续应该关注什么？', context: { summary: '基金基本面稳定。', risk: '注意回撤。' } }),
    });
  });

  it('streams fund analysis drafts before receiving the final result', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: 'status', message: '正在连接 DeepSeek...' })}\n`));
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: 'delta', delta: '【核心判断】\n' })}\n`));
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: 'delta', delta: '基金短期仍看风格轮动。' })}\n`));
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: 'result', data: { analysis: 'ok', fund: { code: '000001', name: '华夏成长混合', netValue: 1.2, quoteDate: '2026-06-05', source: 'test' }, agent: { model: 'deepseek-v4-flash', steps: [], indicators: { totalReturn: 1, maxDrawdown: -1, shortMomentum: 1, volatility: 1, trendSlope: 1, sampleSize: 10 } }, report: { summary: 'ok', trend: 'ok', marketDrivers: 'ok', outlook: 'ok', risk: 'ok', beginnerGuide: { riskLevel: 'R3', riskExplanation: 'ok', netValueExplanation: 'ok', trendExplanation: 'ok', suggestedAction: '观察等待', actionPath: [], suitableFor: [], avoid: [] }, scenarios: [], watchPoints: [], sourceNotes: [], disclaimer: 'ok' }, chartAnnotations: [], researchSources: [] } })}\n`));
        controller.close();
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
    );

    const statuses: string[] = [];
    const deltas: string[] = [];
    const result = await api.analyzeFundStream('000001', {
      onStatus: (message) => statuses.push(message),
      onDelta: (delta) => deltas.push(delta),
    });

    expect(statuses).toEqual(['正在连接 DeepSeek...']);
    expect(deltas.join('')).toContain('核心判断');
    expect(result.agent.model).toBe('deepseek-v4-flash');
  });

  it('parses split stream lines and ignores unknown stream events', async () => {
    const payload = [
      '',
      JSON.stringify({ type: 'status', message: '准备中' }),
      JSON.stringify({ type: 'unknown', message: 'ignored' }),
      JSON.stringify({ type: 'delta', delta: '草稿' }),
      JSON.stringify({ type: 'result', data: { analysis: 'ok', fund: { code: '000001', name: '华夏成长混合', netValue: 1.2, quoteDate: '2026-06-05', source: 'test' }, agent: { model: 'deepseek-v4-flash', steps: [], indicators: { totalReturn: 1, maxDrawdown: -1, shortMomentum: 1, volatility: 1, trendSlope: 1, sampleSize: 10 } }, report: { summary: 'ok', trend: 'ok', marketDrivers: 'ok', outlook: 'ok', risk: 'ok', beginnerGuide: { riskLevel: 'R3', riskExplanation: 'ok', netValueExplanation: 'ok', trendExplanation: 'ok', suggestedAction: '观察等待', actionPath: [], suitableFor: [], avoid: [] }, scenarios: [], watchPoints: [], sourceNotes: [], disclaimer: 'ok' }, chartAnnotations: [], researchSources: [] } }),
    ].join('\n') + '\n';
    const firstChunk = payload.slice(0, 20);
    const secondChunk = payload.slice(20);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(firstChunk));
        controller.enqueue(new TextEncoder().encode(secondChunk));
        controller.close();
      },
    }), { status: 200 }));
    const statuses: string[] = [];
    const deltas: string[] = [];

    await expect(api.analyzeFundStream('000001', {
      onStatus: (message) => statuses.push(message),
      onDelta: (delta) => deltas.push(delta),
    })).resolves.toMatchObject({ analysis: 'ok' });
    expect(statuses).toEqual(['准备中']);
    expect(deltas).toEqual(['草稿']);
  });

  it('surfaces stream setup errors before reading the body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: '分析请求失败' } }), { status: 429, headers: { 'content-type': 'application/json' } }),
    );

    await expect(api.analyzeFundStream('000001')).rejects.toThrow('分析请求失败');
  });


  it('builds OAuth metadata URL with provider and redirect', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ provider: 'github', authUrl: 'https://github.com/login/oauth/authorize', configured: true, callback: 'https://example.com/api/auth/oauth-callback' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await api.getOAuthUrl('github');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/oauth-url?provider=github&redirect=/');
  });

  it('attaches the saved bearer token to authenticated requests', async () => {
    localStorage.setItem('gg_fund_session_token', 'session_test');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'u1' }, session: { token: 'session_test' } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await api.getCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer session_test' }),
    }));
  });

  it('saves and clears session tokens', () => {
    api.saveSessionToken('session_abc');
    expect(localStorage.getItem('gg_fund_session_token')).toBe('session_abc');

    api.clearSessionToken();
    expect(localStorage.getItem('gg_fund_session_token')).toBeNull();
  });

  it('uses the in-memory session token when localStorage is unavailable', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'u1' }, session: { token: 'session_memory' } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    api.saveSessionToken('session_memory');
    await api.getCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer session_memory' }),
    }));
    api.clearSessionToken();
  });

  it('hydrates cached fund history when a later network request fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ date: '2026-05-29', netValue: 1.23 }]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockRejectedValueOnce(new Error('network timeout'));

    await expect(api.getFundHistory('000001', '1m')).resolves.toEqual([{ date: '2026-05-29', netValue: 1.23 }]);
    expect(api.getCachedFundHistory('000001', '1m')).toEqual([{ date: '2026-05-29', netValue: 1.23 }]);
    await expect(api.getFundHistory('000001', '1m')).resolves.toEqual([{ date: '2026-05-29', netValue: 1.23 }]);
  });

  it('throws the network error when a cached request has no fallback value', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await expect(api.getFundHistory('999999', '1m')).rejects.toThrow('offline');
  });

  it('fetches and caches intraday trend points', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ time: '09:30', price: 1.23 }]), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await expect(api.getFundIntraday('510300')).resolves.toEqual([{ time: '09:30', price: 1.23 }]);
    expect(api.getCachedFundIntraday('510300')).toEqual([{ time: '09:30', price: 1.23 }]);
  });

  it('fetches cached quote groups for all public market endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => (
      new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    ));

    await api.getIndexHistory('NDX.US', 'all');
    await api.getFund('016452');
    await api.getFundHoldings('016452');
    await api.getTrendingFunds();

    expect(fetchMock).toHaveBeenCalledWith('/api/market/indices/NDX.US/history?range=all&v=20260613');
    expect(fetchMock).toHaveBeenCalledWith('/api/funds/016452');
    expect(fetchMock).toHaveBeenCalledWith('/api/funds/016452/holdings');
    expect(fetchMock).toHaveBeenCalledWith('/api/funds/trending');
    expect(api.getCachedIndexHistory('NDX.US', 'all')).toEqual([]);
    expect(api.getCachedFund('016452')).toEqual([]);
    expect(api.getCachedFundHoldings('016452')).toEqual([]);
    expect(api.getCachedTrendingFunds()).toEqual([]);
  });

  it('ignores old intraday cache envelopes after cache version bumps', () => {
    localStorage.setItem('gg_fund_api_cache:fund-intraday:025856', JSON.stringify({
      version: 2,
      savedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      value: [{ time: '15:00', price: 100 }],
    }));

    expect(api.getCachedFundIntraday('025856')).toBeUndefined();
    expect(localStorage.getItem('gg_fund_api_cache:fund-intraday:025856')).toBeNull();
  });

  it('removes malformed and too-stale cache envelopes', () => {
    localStorage.setItem('gg_fund_api_cache:fund:000001', '{');
    expect(api.getCachedFund('000001')).toBeUndefined();
    expect(localStorage.getItem('gg_fund_api_cache:fund:000001')).toBeNull();

    localStorage.setItem('gg_fund_api_cache:fund:000001', JSON.stringify({
      version: 3,
      savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      expiresAt: Date.now() + 60_000,
      value: { code: '000001' },
    }));
    expect(api.getCachedFund('000001')).toBeUndefined();
    expect(localStorage.getItem('gg_fund_api_cache:fund:000001')).toBeNull();
  });

  it('continues after cache write quota errors', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => { throw new Error('quota exceeded'); },
        removeItem: () => undefined,
        clear: () => undefined,
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: '000001', name: '华夏成长混合', netValue: 1.2, quoteDate: '2026-06-09', source: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await expect(api.getFund('000001')).resolves.toMatchObject({ code: '000001' });
  });

  it('falls back to non-stream analysis when the stream body is missing', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ analysis: 'fallback' }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(api.analyzeFundStream('000001')).resolves.toEqual({ analysis: 'fallback' });
  });

  it('surfaces streamed analysis errors and missing final results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: 'error', code: 'AI_ERROR', message: '模型暂不可用' })}\n`));
        controller.close();
      },
    }), { status: 200 }));
    await expect(api.analyzeFundStream('000001')).rejects.toThrow('模型暂不可用');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: 'status', message: '处理中' })}\n`));
        controller.close();
      },
    }), { status: 200 }));
    await expect(api.analyzeFundStream('000001')).rejects.toThrow('智能分析未返回最终结果');
  });

});

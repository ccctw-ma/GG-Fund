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
    localStorage.clear();
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

  it('posts selected fund code for AI analysis', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', source: 'test' }, analysis: '风险：注意波动。' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await api.analyzeFund('000001');

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/analyze-fund', {
      method: 'POST',
      headers: expect.objectContaining({ 'content-type': 'application/json' }),
      body: JSON.stringify({ code: '000001' }),
    });
  });
});

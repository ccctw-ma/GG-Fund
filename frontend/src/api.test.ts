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

  it('hydrates cached fund history when a later network request fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ date: '2026-05-29', netValue: 1.23 }]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockRejectedValueOnce(new Error('network timeout'));

    await expect(api.getFundHistory('000001', '1m')).resolves.toEqual([{ date: '2026-05-29', netValue: 1.23 }]);
    expect(api.getCachedFundHistory('000001', '1m')).toEqual([{ date: '2026-05-29', netValue: 1.23 }]);
    await expect(api.getFundHistory('000001', '1m')).resolves.toEqual([{ date: '2026-05-29', netValue: 1.23 }]);
  });

  it('fetches and caches intraday trend points', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ time: '09:30', price: 1.23 }]), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await expect(api.getFundIntraday('510300')).resolves.toEqual([{ time: '09:30', price: 1.23 }]);
    expect(api.getCachedFundIntraday('510300')).toEqual([{ time: '09:30', price: 1.23 }]);
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

});

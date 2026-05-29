import type { FundHistoryPoint, FundQuote, IndexQuote } from './types';

const SESSION_TOKEN_KEY = 'gg_fund_session_token';
let memorySessionToken = '';

const browserStorage = () => (typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage);
const getSessionToken = () => browserStorage()?.getItem(SESSION_TOKEN_KEY) ?? memorySessionToken;
const authHeaders = (): Record<string, string> => {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function getJson<T>(path: string): Promise<T> {
  const headers = authHeaders();
  const response = Object.keys(headers).length > 0 ? await fetch(path, { headers }) : await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error?.message ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    throw new Error(payload?.error?.message ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

export type AuthProvider = 'email' | 'phone';
export type OAuthProvider = 'github' | 'wechat';
export type AuthChallengeResponse = {
  challengeId: string;
  provider: AuthProvider;
  identifier: string;
  delivery: AuthProvider;
  devCode?: string;
  expiresAt: string;
};
export type AuthSessionResponse = {
  user: { id: string; provider: string; identifier: string; displayName: string };
  session: { token: string; expiresAt: string };
};
export type OAuthUrlResponse = {
  provider: OAuthProvider;
  authUrl: string;
  configured: boolean;
  callback: string;
};
export type FundAnalysisResponse = {
  fund: FundQuote;
  agent?: { model: string; steps: Array<{ name: string; status: string; summary: string }> };
  analysis: string;
};

export const api = {
  saveSessionToken: (token: string) => {
    memorySessionToken = token;
    browserStorage()?.setItem(SESSION_TOKEN_KEY, token);
  },
  clearSessionToken: () => {
    memorySessionToken = '';
    browserStorage()?.removeItem(SESSION_TOKEN_KEY);
  },
  hasSessionToken: () => Boolean(getSessionToken()),
  getIndices: () => getJson<IndexQuote[]>('/api/market/indices'),
  searchFunds: (query: string) => getJson<FundQuote[]>(`/api/funds/search?q=${encodeURIComponent(query)}`),
  getFund: (code: string) => getJson<FundQuote>(`/api/funds/${code}`),
  getFundHistory: (code: string) => getJson<FundHistoryPoint[]>(`/api/funds/${code}/history?range=1m`),
  getTrendingFunds: () => getJson<FundQuote[]>('/api/funds/trending'),
  getCurrentUser: () => getJson<AuthSessionResponse>('/api/auth/me'),
  logout: () => postJson<{ ok: true }>('/api/auth/logout', {}),
  startAuthChallenge: (provider: AuthProvider, identifier: string) => postJson<AuthChallengeResponse>('/api/auth/challenge', { provider, identifier }),
  verifyAuthChallenge: (challengeId: string, code: string) => postJson<AuthSessionResponse>('/api/auth/verify', { challengeId, code }),
  getOAuthUrl: (provider: OAuthProvider) => getJson<OAuthUrlResponse>(`/api/auth/oauth-url?provider=${provider}&redirect=/`),
  analyzeFund: (code: string) => postJson<FundAnalysisResponse>('/api/ai/analyze-fund', { code }),
};

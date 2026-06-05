import type { FundAnalysisResponse, FundHistoryPoint, FundHoldings, FundIntradayPoint, FundQuote, IndexQuote } from './types';

const SESSION_TOKEN_KEY = 'gg_fund_session_token';
const CACHE_PREFIX = 'gg_fund_api_cache:';
const CACHE_VERSION = 3;
const CACHE_MAX_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
let memorySessionToken = '';

type CacheEnvelope<T> = {
  version: number;
  savedAt: number;
  expiresAt: number;
  value: T;
};

const cacheTtl = {
  indices: 5 * MINUTE,
  indexHistory: 7 * DAY,
  search: 30 * MINUTE,
  fund: 10 * MINUTE,
  fundHistory: 7 * DAY,
  fundIntraday: 1 * MINUTE,
  holdings: 1 * DAY,
  trending: 1 * DAY,
};

const browserStorage = () => (typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage);
const getSessionToken = () => browserStorage()?.getItem(SESSION_TOKEN_KEY) ?? memorySessionToken;
const authHeaders = (): Record<string, string> => {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const cacheKey = (key: string) => `${CACHE_PREFIX}${key}`;

function readCache<T>(key: string): T | undefined {
  const raw = browserStorage()?.getItem(cacheKey(key));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.version !== CACHE_VERSION || Date.now() - parsed.savedAt > CACHE_MAX_STALE_MS) {
      browserStorage()?.removeItem(cacheKey(key));
      return undefined;
    }
    return parsed.value;
  } catch {
    browserStorage()?.removeItem(cacheKey(key));
    return undefined;
  }
}

function writeCache<T>(key: string, value: T, ttlMs: number) {
  const storage = browserStorage();
  if (!storage) return;
  const now = Date.now();
  const envelope: CacheEnvelope<T> = { version: CACHE_VERSION, savedAt: now, expiresAt: now + ttlMs, value };
  try {
    storage.setItem(cacheKey(key), JSON.stringify(envelope));
  } catch {
    // Ignore quota errors; live network responses should still render normally.
  }
}

async function getJson<T>(path: string): Promise<T> {
  const headers = authHeaders();
  const response = Object.keys(headers).length > 0 ? await fetch(path, { headers }) : await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error?.message ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

async function getCachedJson<T>(path: string, key: string, ttlMs: number): Promise<T> {
  try {
    const value = await getJson<T>(path);
    writeCache(key, value, ttlMs);
    return value;
  } catch (error) {
    const cached = readCache<T>(key);
    if (cached !== undefined) return cached;
    throw error;
  }
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

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    throw new Error(payload?.error?.message ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

export type AuthProvider = 'email';
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
  getCachedIndices: () => readCache<IndexQuote[]>('indices'),
  getCachedIndexHistory: (code: string, range = '1y') => readCache<FundHistoryPoint[]>(`index-history:${code}:${range}`),
  getCachedSearchFunds: (query: string) => readCache<FundQuote[]>(`fund-search:${query.trim().toLowerCase()}`),
  getCachedFund: (code: string) => readCache<FundQuote>(`fund:${code}`),
  getCachedFundHistory: (code: string, range = '1y') => readCache<FundHistoryPoint[]>(`fund-history:${code}:${range}`),
  getCachedFundIntraday: (code: string) => readCache<FundIntradayPoint[]>(`fund-intraday:${code}`),
  getCachedFundHoldings: (code: string) => readCache<FundHoldings>(`fund-holdings:${code}`),
  getCachedTrendingFunds: () => readCache<FundQuote[]>('funds-trending'),
  getIndices: () => getCachedJson<IndexQuote[]>('/api/market/indices', 'indices', cacheTtl.indices),
  getIndexHistory: (code: string, range = '1y') => getCachedJson<FundHistoryPoint[]>(`/api/market/indices/${encodeURIComponent(code)}/history?range=${encodeURIComponent(range)}`, `index-history:${code}:${range}`, cacheTtl.indexHistory),
  searchFunds: (query: string) => getCachedJson<FundQuote[]>(`/api/funds/search?q=${encodeURIComponent(query)}`, `fund-search:${query.trim().toLowerCase()}`, cacheTtl.search),
  getFund: (code: string) => getCachedJson<FundQuote>(`/api/funds/${code}`, `fund:${code}`, cacheTtl.fund),
  getFundHistory: (code: string, range = '1y') => getCachedJson<FundHistoryPoint[]>(`/api/funds/${code}/history?range=${encodeURIComponent(range)}`, `fund-history:${code}:${range}`, cacheTtl.fundHistory),
  getFundIntraday: (code: string) => getCachedJson<FundIntradayPoint[]>(`/api/funds/${code}/intraday`, `fund-intraday:${code}`, cacheTtl.fundIntraday),
  getFundHoldings: (code: string) => getCachedJson<FundHoldings>(`/api/funds/${code}/holdings`, `fund-holdings:${code}`, cacheTtl.holdings),
  getTrendingFunds: () => getCachedJson<FundQuote[]>('/api/funds/trending', 'funds-trending', cacheTtl.trending),
  analyzeFund: (code: string) => postJson<FundAnalysisResponse>('/api/ai/analyze-fund', { code }),
  syncPortfolio: (holdings: unknown[], watchlist: unknown[]) =>
    putJson<unknown>('/api/portfolio/default', { holdings, watchlist }),
  getCurrentUser: () => getJson<AuthSessionResponse>('/api/auth/me'),
  logout: () => postJson<{ ok: true }>('/api/auth/logout', {}),
  startAuthChallenge: (provider: AuthProvider, identifier: string) => postJson<AuthChallengeResponse>('/api/auth/challenge', { provider, identifier }),
  verifyAuthChallenge: (challengeId: string, code: string) => postJson<AuthSessionResponse>('/api/auth/verify', { challengeId, code }),
  getOAuthUrl: (provider: OAuthProvider) => getJson<OAuthUrlResponse>(`/api/auth/oauth-url?provider=${provider}&redirect=/`),
};

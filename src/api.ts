import type { FundHistoryPoint, FundQuote, IndexQuote } from './types';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error?.message ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    throw new Error(payload?.error?.message ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

export type AuthProvider = 'email' | 'github' | 'wechat' | 'phone';
export type AuthSessionResponse = {
  user: { id: string; provider: AuthProvider; identifier: string; displayName: string };
  session: { token: string; expiresAt: string };
};
export type FundAnalysisResponse = {
  fund: FundQuote;
  analysis: string;
};

export const api = {
  getIndices: () => getJson<IndexQuote[]>('/api/market/indices'),
  searchFunds: (query: string) => getJson<FundQuote[]>(`/api/funds/search?q=${encodeURIComponent(query)}`),
  getFund: (code: string) => getJson<FundQuote>(`/api/funds/${code}`),
  getFundHistory: (code: string) => getJson<FundHistoryPoint[]>(`/api/funds/${code}/history?range=1m`),
  getTrendingFunds: () => getJson<FundQuote[]>('/api/funds/trending'),
  startAuth: (provider: AuthProvider, identifier: string) => postJson<AuthSessionResponse>('/api/auth/start', { provider, identifier, displayName: identifier }),
  analyzeFund: (code: string) => postJson<FundAnalysisResponse>('/api/ai/analyze-fund', { code }),
};

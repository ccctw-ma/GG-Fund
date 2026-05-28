import type { FundHistoryPoint, FundQuote, IndexQuote } from './types';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error?.message ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

export const api = {
  getIndices: () => getJson<IndexQuote[]>('/api/market/indices'),
  searchFunds: (query: string) => getJson<FundQuote[]>(`/api/funds/search?q=${encodeURIComponent(query)}`),
  getFund: (code: string) => getJson<FundQuote>(`/api/funds/${code}`),
  getFundHistory: (code: string) => getJson<FundHistoryPoint[]>(`/api/funds/${code}/history?range=1m`),
  getTrendingFunds: () => getJson<FundQuote[]>('/api/funds/trending'),
};

import { createMarketDataService, type MarketDataService } from '../../shared/marketData';
import type { FundHistoryPoint, FundQuote, IndexQuote } from '../../shared/types';
import { HttpError } from '../../lib/http';

type CacheNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

type MarketServiceOptions = {
  marketData: MarketDataService;
  cache?: CacheNamespace;
};

const isFundCode = (value: string) => /^\d{6}$/.test(value);
const normalizeQuery = (value: string) => value.trim();
const isFundQuote = (value: unknown): value is FundQuote =>
  typeof value === 'object' && value !== null && typeof (value as FundQuote).code === 'string';
const isUsableCachedFund = (fund: unknown): fund is FundQuote =>
  isFundQuote(fund) && fund.source !== '内置示例行情';

async function readCachedFund(cache: CacheNamespace | undefined, code: string) {
  if (!cache) return undefined;
  const raw = await cache.get(`fund:${code}`);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return isUsableCachedFund(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function createMarketService(options: MarketServiceOptions) {
  const { marketData, cache } = options;

  return {
    async getIndices(): Promise<IndexQuote[]> {
      return marketData.getIndices();
    },
    async getIndexHistory(code: string, range = '1m'): Promise<FundHistoryPoint[]> {
      if (!/^[A-Za-z0-9]{1,8}\.[A-Z]{2}$/.test(code)) {
        throw new HttpError(400, 'INDEX_CODE_INVALID', '指数代码格式不正确');
      }
      return marketData.getIndexHistory(code, range);
    },
    async searchFunds(query: string): Promise<FundQuote[]> {
      return marketData.searchFunds(normalizeQuery(query));
    },
    async getFund(code: string): Promise<FundQuote> {
      if (!isFundCode(code)) {
        throw new HttpError(400, 'FUND_CODE_INVALID', '基金代码格式不正确');
      }
      const cached = await readCachedFund(cache, code);
      if (cached) return cached;

      const liveFund = await marketData.getFund(code);
      if (isUsableCachedFund(liveFund)) {
        await cache?.put(`fund:${code}`, JSON.stringify(liveFund), { expirationTtl: 60 });
        return liveFund;
      }

      const searchResult = (await marketData.searchFunds(code)).find((item) => item.code === code);
      if (searchResult) {
        await cache?.put(`fund:${code}`, JSON.stringify(searchResult), { expirationTtl: 60 });
        return searchResult;
      }

      throw new HttpError(404, 'FUND_NOT_FOUND', '未找到该基金');
    },
    async getFundHistory(code: string, range = '1m'): Promise<FundHistoryPoint[]> {
      if (!isFundCode(code)) {
        throw new HttpError(400, 'FUND_CODE_INVALID', '基金代码格式不正确');
      }
      return marketData.getFundHistory(code, range);
    },
    async getTrendingFunds(): Promise<FundQuote[]> {
      return marketData.getTrendingFunds();
    },
  };
}

let defaultMarketService: ReturnType<typeof createMarketService> | undefined;

export function getDefaultMarketService() {
  if (!defaultMarketService) {
    defaultMarketService = createMarketService({
      marketData: createMarketDataService(),
    });
  }
  return defaultMarketService;
}

export type MarketService = ReturnType<typeof createMarketService>;

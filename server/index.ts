import { createDatabaseService, type DatabaseService } from './database';
import { createMarketDataService, type MarketDataService } from './marketData';
import type { ApiError } from './types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });

const error = (status: number, code: string, message: string) => json({ error: { code, message } } satisfies ApiError, status);

type ServerOptions = {
  marketData?: MarketDataService;
  database?: DatabaseService;
};

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function createServer(options: ServerOptions = {}) {
  const database = options.database ?? createDatabaseService();
  const marketData = options.marketData ?? createMarketDataService();

  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method === 'OPTIONS') return json({ ok: true });

      const url = new URL(request.url);
      const path = url.pathname;

      try {
        if (request.method === 'GET') {
          if (path === '/api/health') return json({ ok: true, service: 'gg-fund-api', database: true });
          if (path === '/api/market/indices') return json(await marketData.getIndices());
          if (path === '/api/funds/search') return json(await marketData.searchFunds(url.searchParams.get('q') ?? ''));
          if (path === '/api/funds/trending') return json(await marketData.getTrendingFunds());
          if (path === '/api/portfolio/default') {
            const portfolio = database.ensureDefaultPortfolio();
            return json(database.getPortfolioSnapshot(portfolio.id));
          }

          const fundMatch = path.match(/^\/api\/funds\/(\d{6})(?:\/history)?$/);
          if (fundMatch && path.endsWith('/history')) {
            return json(await marketData.getFundHistory(fundMatch[1], url.searchParams.get('range') ?? '1m'));
          }
          if (fundMatch) {
            const liveFund = await marketData.getFund(fundMatch[1]);
            if (liveFund) database.cacheFundQuote(liveFund);
            const fund = liveFund ?? database.getCachedFundQuote(fundMatch[1]);
            return fund ? json(fund) : error(404, 'FUND_NOT_FOUND', '未找到该基金');
          }
        }

        if (request.method === 'POST') {
          if (path === '/api/portfolio/default/holdings') {
            const portfolio = database.ensureDefaultPortfolio();
            const body = (await readJson(request)) as Record<string, unknown> | undefined;
            database.upsertHolding(portfolio.id, {
              fundCode: String(body?.fundCode ?? ''),
              fundName: String(body?.fundName ?? ''),
              shares: Number(body?.shares ?? 0),
              costAmount: Number(body?.costAmount ?? 0),
              purchaseDate: typeof body?.purchaseDate === 'string' ? body.purchaseDate : undefined,
              note: typeof body?.note === 'string' ? body.note : undefined,
            });
            return json(database.getPortfolioSnapshot(portfolio.id), 201);
          }
          if (path === '/api/portfolio/default/watchlist') {
            const portfolio = database.ensureDefaultPortfolio();
            const body = (await readJson(request)) as Record<string, unknown> | undefined;
            database.upsertWatchItem(portfolio.id, {
              fundCode: String(body?.fundCode ?? ''),
              fundName: String(body?.fundName ?? ''),
            });
            return json(database.getPortfolioSnapshot(portfolio.id), 201);
          }
        }

        if (!['GET', 'POST'].includes(request.method)) return error(405, 'METHOD_NOT_ALLOWED', '仅支持 GET 和 POST 请求');
        return error(404, 'NOT_FOUND', '接口不存在');
      } catch {
        return error(502, 'UPSTREAM_ERROR', '行情或数据库服务暂不可用，请稍后重试');
      }
    },
  };
}

if (import.meta.main) {
  Bun.serve({
    port: Number(process.env.PORT ?? 8787),
    fetch: createServer().fetch,
  });
  console.log(`GG Fund API listening on http://127.0.0.1:${process.env.PORT ?? 8787}`);
}

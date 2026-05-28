import { createMarketDataService, type MarketDataService } from '../server/marketData';

type D1Database = {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results: T[] }>;
    run(): Promise<unknown>;
  };
};

type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type CloudflareEnv = {
  GG_FUND_DB: D1Database;
  GG_FUND_CACHE: KVNamespace;
};

type Options = {
  marketData?: MarketDataService;
};

const nowIso = () => new Date().toISOString();

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

const error = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

async function ensureDefaultPortfolio(db: D1Database) {
  const existing = await db
    .prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios order by created_at limit 1')
    .first<{ id: string; name: string; createdAt: string; updatedAt: string }>();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  await db.prepare('insert into portfolios (id, name, created_at, updated_at) values (?, ?, ?, ?)').bind(id, '默认组合', timestamp, timestamp).run();
  return { id, name: '默认组合', createdAt: timestamp, updatedAt: timestamp };
}

async function getPortfolioSnapshot(db: D1Database, portfolioId: string) {
  const portfolio = await db
    .prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios where id = ?')
    .bind(portfolioId)
    .first();
  const holdings = await db
    .prepare('select id, fund_code as fundCode, fund_name as fundName, shares, cost_amount as costAmount, purchase_date as purchaseDate, note, created_at as createdAt, updated_at as updatedAt from holdings where portfolio_id = ? order by created_at')
    .bind(portfolioId)
    .all();
  const watchlist = await db
    .prepare('select fund_code as fundCode, fund_name as fundName, created_at as createdAt from watchlist where portfolio_id = ? order by created_at')
    .bind(portfolioId)
    .all();
  return { portfolio, holdings: holdings.results, watchlist: watchlist.results };
}

async function addHolding(db: D1Database, portfolioId: string, body: Record<string, unknown> | undefined) {
  const timestamp = nowIso();
  await db
    .prepare(`
      insert into holdings (id, portfolio_id, fund_code, fund_name, shares, cost_amount, purchase_date, note, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(portfolio_id, fund_code) do update set
        fund_name = excluded.fund_name,
        shares = excluded.shares,
        cost_amount = excluded.cost_amount,
        purchase_date = excluded.purchase_date,
        note = excluded.note,
        updated_at = excluded.updated_at
    `)
    .bind(
      crypto.randomUUID(),
      portfolioId,
      String(body?.fundCode ?? ''),
      String(body?.fundName ?? ''),
      Number(body?.shares ?? 0),
      Number(body?.costAmount ?? 0),
      typeof body?.purchaseDate === 'string' ? body.purchaseDate : null,
      typeof body?.note === 'string' ? body.note : null,
      timestamp,
      timestamp,
    )
    .run();
}

async function addWatchItem(db: D1Database, portfolioId: string, body: Record<string, unknown> | undefined) {
  await db
    .prepare(`
      insert into watchlist (portfolio_id, fund_code, fund_name, created_at)
      values (?, ?, ?, ?)
      on conflict(portfolio_id, fund_code) do update set fund_name = excluded.fund_name
    `)
    .bind(portfolioId, String(body?.fundCode ?? ''), String(body?.fundName ?? ''), nowIso())
    .run();
}

export function createCloudflareApi(options: Options = {}) {
  const marketData = options.marketData ?? createMarketDataService();

  return {
    async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
      if (request.method === 'OPTIONS') return json({ ok: true });
      const url = new URL(request.url);
      const path = url.pathname;

      try {
        if (request.method === 'GET') {
          if (path === '/api/health') return json({ ok: true, service: 'gg-fund-pages-api', database: 'd1', cache: 'kv' });
          if (path === '/api/market/indices') return json(await marketData.getIndices());
          if (path === '/api/funds/search') return json(await marketData.searchFunds(url.searchParams.get('q') ?? ''));
          if (path === '/api/funds/trending') return json(await marketData.getTrendingFunds());
          if (path === '/api/portfolio/default') {
            const portfolio = await ensureDefaultPortfolio(env.GG_FUND_DB);
            return json(await getPortfolioSnapshot(env.GG_FUND_DB, portfolio.id));
          }

          const fundMatch = path.match(/^\/api\/funds\/(\d{6})(?:\/history)?$/);
          if (fundMatch && path.endsWith('/history')) return json(await marketData.getFundHistory(fundMatch[1], url.searchParams.get('range') ?? '1m'));
          if (fundMatch) {
            const cacheKey = `fund:${fundMatch[1]}`;
            const cached = await env.GG_FUND_CACHE.get(cacheKey);
            if (cached) return json(JSON.parse(cached));
            const fund = await marketData.getFund(fundMatch[1]);
            if (fund) await env.GG_FUND_CACHE.put(cacheKey, JSON.stringify(fund), { expirationTtl: 60 });
            return fund ? json(fund) : error(404, 'FUND_NOT_FOUND', '未找到该基金');
          }
        }

        if (request.method === 'POST') {
          if (path === '/api/portfolio/default/holdings') {
            const portfolio = await ensureDefaultPortfolio(env.GG_FUND_DB);
            await addHolding(env.GG_FUND_DB, portfolio.id, (await readJson(request)) as Record<string, unknown> | undefined);
            return json(await getPortfolioSnapshot(env.GG_FUND_DB, portfolio.id), 201);
          }
          if (path === '/api/portfolio/default/watchlist') {
            const portfolio = await ensureDefaultPortfolio(env.GG_FUND_DB);
            await addWatchItem(env.GG_FUND_DB, portfolio.id, (await readJson(request)) as Record<string, unknown> | undefined);
            return json(await getPortfolioSnapshot(env.GG_FUND_DB, portfolio.id), 201);
          }
        }

        if (!['GET', 'POST'].includes(request.method)) return error(405, 'METHOD_NOT_ALLOWED', '仅支持 GET 和 POST 请求');
        return error(404, 'NOT_FOUND', '接口不存在');
      } catch {
        return error(502, 'UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试');
      }
    },
  };
}

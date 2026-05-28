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
  DEEPSEEK_API_KEY?: string;
};

type Options = {
  marketData?: MarketDataService;
  deepSeekFetch?: typeof fetch;
};

const nowIso = () => new Date().toISOString();
const AUTH_PROVIDERS = ['email', 'github', 'wechat', 'phone'] as const;

type AuthProvider = (typeof AUTH_PROVIDERS)[number];

const isAuthProvider = (value: unknown): value is AuthProvider => typeof value === 'string' && AUTH_PROVIDERS.includes(value as AuthProvider);

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

async function createAuthSession(db: D1Database, body: Record<string, unknown> | undefined) {
  if (!isAuthProvider(body?.provider)) return undefined;
  const timestamp = nowIso();
  const user = {
    id: crypto.randomUUID(),
    provider: body.provider,
    identifier: String(body.identifier ?? `${body.provider}:demo`),
    displayName: String(body.displayName ?? body.identifier ?? body.provider),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const session = {
    token: `session_${crypto.randomUUID()}`,
    userId: user.id,
    createdAt: timestamp,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };
  const existing = await db
    .prepare('select id, provider, identifier, display_name as displayName, created_at as createdAt, updated_at as updatedAt from auth_users where provider = ? and identifier = ?')
    .bind(user.provider, user.identifier)
    .first<typeof user>();
  const finalUser = existing ?? user;
  if (!existing) {
    await db
      .prepare('insert into auth_users (id, provider, identifier, display_name, created_at, updated_at) values (?, ?, ?, ?, ?, ?)')
      .bind(user.id, user.provider, user.identifier, user.displayName, user.createdAt, user.updatedAt)
      .run();
  }
  await db
    .prepare('insert into auth_sessions (token, user_id, created_at, expires_at) values (?, ?, ?, ?)')
    .bind(session.token, finalUser.id, session.createdAt, session.expiresAt)
    .run();
  return { user: finalUser, session: { ...session, userId: finalUser.id } };
}

async function analyzeFund(request: Request, env: CloudflareEnv, marketData: MarketDataService, deepSeekFetch: typeof fetch) {
  if (!env.DEEPSEEK_API_KEY) return error(503, 'DEEPSEEK_KEY_MISSING', 'DeepSeek API key 未配置');
  const body = (await readJson(request)) as Record<string, unknown> | undefined;
  const code = String(body?.code ?? '');
  if (!/^\d{6}$/.test(code)) return error(400, 'FUND_CODE_INVALID', '基金代码格式不正确');

  const fund = await resolveFundQuote(code, env, marketData);
  const [history, indices] = await Promise.all([
    marketData.getFundHistory(code, '1m'),
    marketData.getIndices(),
  ]);
  if (!fund) return error(404, 'FUND_NOT_FOUND', '未找到该基金');

  const prompt = `请用中文分析基金 ${fund.name} (${fund.code})。当前估算/净值：${fund.netValue}，涨跌幅：${fund.dailyChangePercent ?? '未知'}%，估算时间：${fund.estimateTime ?? fund.quoteDate}。最近净值序列：${JSON.stringify(history.slice(-10))}。主要指数：${JSON.stringify(indices)}。请分析为什么涨跌、短期风险、后续走势情景，不要给确定性投资建议。`;

  const response = await deepSeekFetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: '你是谨慎的基金研究助理。必须强调不构成投资建议。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });
  if (!response.ok) return error(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 分析服务暂不可用');
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json({ fund, analysis: data.choices?.[0]?.message?.content ?? '暂无分析结果' });
}

const isUsableCachedFund = (fund: unknown): boolean =>
  typeof fund === 'object' && fund !== null && (fund as { source?: string }).source !== '内置示例行情';

async function readCachedFund(cache: KVNamespace, code: string) {
  const raw = await cache.get(`fund:${code}`);
  if (!raw) return undefined;
  const parsed = JSON.parse(raw);
  return isUsableCachedFund(parsed) ? parsed : undefined;
}

async function resolveFundQuote(code: string, env: CloudflareEnv, marketData: MarketDataService) {
  const cacheKey = `fund:${code}`;
  const cached = await readCachedFund(env.GG_FUND_CACHE, code);
  if (cached) return cached;
  const liveFund = await marketData.getFund(code);
  if (isUsableCachedFund(liveFund)) {
    await env.GG_FUND_CACHE.put(cacheKey, JSON.stringify(liveFund), { expirationTtl: 60 });
    return liveFund;
  }
  const official = (await marketData.searchFunds(code)).find((item) => item.code === code);
  if (official && isUsableCachedFund(official)) {
    await env.GG_FUND_CACHE.put(cacheKey, JSON.stringify(official), { expirationTtl: 60 });
    return official;
  }
  return undefined;
}

export function createCloudflareApi(options: Options = {}) {
  const marketData = options.marketData ?? createMarketDataService();
  const deepSeekFetch = options.deepSeekFetch ?? fetch;

  return {
    async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
      if (request.method === 'OPTIONS') return json({ ok: true });
      const url = new URL(request.url);
      const path = url.pathname;

      try {
        if (request.method === 'GET') {
          if (path === '/api/health') return json({ ok: true, service: 'gg-fund-pages-api', database: 'd1', cache: 'kv', auth: [...AUTH_PROVIDERS], ai: 'deepseek-v4-flash' });
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
            const fund = await resolveFundQuote(fundMatch[1], env, marketData);
            return fund ? json(fund) : error(404, 'FUND_NOT_FOUND', '未找到该基金');
          }
        }

        if (request.method === 'POST') {
          if (path === '/api/auth/start') {
            const result = await createAuthSession(env.GG_FUND_DB, (await readJson(request)) as Record<string, unknown> | undefined);
            return result ? json(result, 201) : error(400, 'AUTH_PROVIDER_UNSUPPORTED', '暂不支持该登录方式');
          }
          if (path === '/api/ai/analyze-fund') return analyzeFund(request, env, marketData, deepSeekFetch);
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

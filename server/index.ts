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
  deepSeekApiKey?: string;
  deepSeekFetch?: typeof fetch;
};

const AUTH_PROVIDERS = ['email', 'github', 'wechat', 'phone'] as const;
const isAuthProvider = (value: unknown): value is (typeof AUTH_PROVIDERS)[number] => typeof value === 'string' && AUTH_PROVIDERS.includes(value as (typeof AUTH_PROVIDERS)[number]);

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
  const deepSeekFetch = options.deepSeekFetch ?? fetch;
  const deepSeekApiKey = options.deepSeekApiKey ?? process.env.DEEPSEEK_API_KEY;

  async function createAuthSession(body: Record<string, unknown> | undefined) {
    if (!isAuthProvider(body?.provider)) return undefined;
    const timestamp = new Date().toISOString();
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
    const existing = database.raw.prepare('select id, provider, identifier, display_name as displayName, created_at as createdAt, updated_at as updatedAt from auth_users where provider = ? and identifier = ?').get(body.provider, String(body.identifier ?? `${body.provider}:demo`)) as typeof user | undefined;
    const finalUser = existing ?? user;
    if (!existing) database.raw.prepare('insert into auth_users (id, provider, identifier, display_name, created_at, updated_at) values (?, ?, ?, ?, ?, ?)').run(user.id, user.provider, user.identifier, user.displayName, user.createdAt, user.updatedAt);
    database.raw.prepare('insert into auth_sessions (token, user_id, created_at, expires_at) values (?, ?, ?, ?)').run(session.token, finalUser.id, session.createdAt, session.expiresAt);
    return { user: finalUser, session: { ...session, userId: finalUser.id } };
  }

  async function analyzeFund(request: Request) {
    if (!deepSeekApiKey) return error(503, 'DEEPSEEK_KEY_MISSING', 'DeepSeek API key 未配置');
    const body = (await readJson(request)) as Record<string, unknown> | undefined;
    const code = String(body?.code ?? '');
    if (!/^\d{6}$/.test(code)) return error(400, 'FUND_CODE_INVALID', '基金代码格式不正确');
    const [fund, history, indices] = await Promise.all([marketData.getFund(code), marketData.getFundHistory(code, '1m'), marketData.getIndices()]);
    if (!fund) return error(404, 'FUND_NOT_FOUND', '未找到该基金');
    const prompt = `请用中文分析基金 ${fund.name} (${fund.code})。当前估算/净值：${fund.netValue}，涨跌幅：${fund.dailyChangePercent ?? '未知'}%，估算时间：${fund.estimateTime ?? fund.quoteDate}。最近净值序列：${JSON.stringify(history.slice(-10))}。主要指数：${JSON.stringify(indices)}。请分析为什么涨跌、短期风险、后续走势情景，不要给确定性投资建议。`;
    const response = await deepSeekFetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${deepSeekApiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'system', content: '你是谨慎的基金研究助理。必须强调不构成投资建议。' }, { role: 'user', content: prompt }], temperature: 0.3 }),
    });
    if (!response.ok) return error(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 分析服务暂不可用');
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json({ fund, analysis: data.choices?.[0]?.message?.content ?? '暂无分析结果' });
  }

  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method === 'OPTIONS') return json({ ok: true });

      const url = new URL(request.url);
      const path = url.pathname;

      try {
        if (request.method === 'GET') {
          if (path === '/api/health') return json({ ok: true, service: 'gg-fund-api', database: true, auth: [...AUTH_PROVIDERS], ai: 'deepseek-v4-flash' });
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
          if (path === '/api/auth/start') {
            const result = await createAuthSession((await readJson(request)) as Record<string, unknown> | undefined);
            return result ? json(result, 201) : error(400, 'AUTH_PROVIDER_UNSUPPORTED', '暂不支持该登录方式');
          }
          if (path === '/api/ai/analyze-fund') return analyzeFund(request);
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

import { createMarketDataService, type MarketDataService } from '../shared/marketData';
import { buildResearchPrompt, computeFundIndicators, normalizeAnalysisReport, normalizeChartAnnotations } from './fundAnalysis';

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
  GITHUB_CLIENT_ID?: string;
  WECHAT_CLIENT_ID?: string;
};

type Options = {
  marketData?: MarketDataService;
  deepSeekFetch?: typeof fetch;
};

const nowIso = () => new Date().toISOString();
const AUTH_PROVIDERS = ['email-otp', 'phone-otp', 'github-oauth', 'wechat-oauth'] as const;
const OTP_PROVIDERS = ['email', 'phone'] as const;
const OAUTH_PROVIDERS = ['github', 'wechat'] as const;

type OtpProvider = (typeof OTP_PROVIDERS)[number];
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

type AuthUser = {
  id: string;
  provider: string;
  identifier: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

type AuthSession = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

type AuthContext = {
  user: AuthUser;
  session: AuthSession;
};

const isOtpProvider = (value: unknown): value is OtpProvider => typeof value === 'string' && OTP_PROVIDERS.includes(value as OtpProvider);
const isOAuthProvider = (value: unknown): value is OAuthProvider => typeof value === 'string' && OAUTH_PROVIDERS.includes(value as OAuthProvider);

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      ...extraHeaders,
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

function isValidIdentifier(provider: OtpProvider, identifier: string) {
  if (provider === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  return /^\+?\d{8,15}$/.test(identifier);
}

function readBearerToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)gg_fund_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function sessionCookie(token: string, expiresAt: string) {
  return `gg_fund_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${new Date(expiresAt).toUTCString()}`;
}

function clearSessionCookie() {
  return 'gg_fund_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
}

async function ensureDefaultPortfolio(db: D1Database, userId?: string) {
  const existing = userId
    ? await db
      .prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios where user_id = ? order by created_at limit 1')
      .bind(userId)
      .first<{ id: string; name: string; createdAt: string; updatedAt: string }>()
    : await db
      .prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios where user_id is null order by created_at limit 1')
      .first<{ id: string; name: string; createdAt: string; updatedAt: string }>();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  await db.prepare('insert into portfolios (id, user_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)').bind(id, userId ?? null, '默认组合', timestamp, timestamp).run();
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

function createSessionPayload(user: { id: string; provider: string; identifier: string; displayName?: string; createdAt?: string; updatedAt?: string }) {
  const timestamp = nowIso();
  return {
    user,
    session: {
      token: `session_${crypto.randomUUID()}`,
      userId: user.id,
      createdAt: timestamp,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
  };
}

async function upsertUser(db: D1Database, provider: string, identifier: string, displayName: string) {
  const existing = await db
    .prepare('select id, provider, identifier, display_name as displayName, created_at as createdAt, updated_at as updatedAt from auth_users where provider = ? and identifier = ?')
    .bind(provider, identifier)
    .first<{ id: string; provider: string; identifier: string; displayName: string; createdAt: string; updatedAt: string }>();
  if (existing) return existing;
  const timestamp = nowIso();
  const user = { id: crypto.randomUUID(), provider, identifier, displayName, createdAt: timestamp, updatedAt: timestamp };
  await db
    .prepare('insert into auth_users (id, provider, identifier, display_name, created_at, updated_at) values (?, ?, ?, ?, ?, ?)')
    .bind(user.id, user.provider, user.identifier, user.displayName, user.createdAt, user.updatedAt)
    .run();
  return user;
}

async function persistSession(db: D1Database, session: { token: string; userId: string; createdAt: string; expiresAt: string }) {
  await db
    .prepare('insert into auth_sessions (token, user_id, created_at, expires_at) values (?, ?, ?, ?)')
    .bind(session.token, session.userId, session.createdAt, session.expiresAt)
    .run();
}

async function getAuthContext(db: D1Database, request: Request): Promise<AuthContext | undefined> {
  const token = readBearerToken(request);
  if (!token) return undefined;
  const row = await db
    .prepare(`
      select
        s.token as token,
        s.user_id as userId,
        s.created_at as sessionCreatedAt,
        s.expires_at as sessionExpiresAt,
        u.id as id,
        u.provider as provider,
        u.identifier as identifier,
        u.display_name as displayName,
        u.created_at as createdAt,
        u.updated_at as updatedAt
      from auth_sessions s
      join auth_users u on u.id = s.user_id
      where s.token = ?
    `)
    .bind(token)
    .first<Record<string, string>>();
  if (!row || Date.parse(row.sessionExpiresAt) <= Date.now()) return undefined;
  return {
    user: {
      id: row.id,
      provider: row.provider,
      identifier: row.identifier,
      displayName: row.displayName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    session: {
      token: row.token,
      userId: row.userId,
      createdAt: row.sessionCreatedAt,
      expiresAt: row.sessionExpiresAt,
    },
  };
}

async function logout(db: D1Database, request: Request) {
  const token = readBearerToken(request);
  if (token) await db.prepare('delete from auth_sessions where token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}

async function createOtpChallenge(db: D1Database, body: Record<string, unknown> | undefined) {
  if (!isOtpProvider(body?.provider)) return undefined;
  const identifier = String(body?.identifier ?? '');
  if (!identifier) return undefined;
  if (!isValidIdentifier(body.provider, identifier)) return { error: 'invalid_identifier' as const };
  const timestamp = nowIso();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const challenge = {
    challengeId: `challenge_${crypto.randomUUID()}`,
    provider: body.provider,
    identifier,
    delivery: body.provider,
    devCode: code,
    createdAt: timestamp,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  };
  await db
    .prepare('insert into auth_challenges (id, provider, identifier, code, created_at, expires_at) values (?, ?, ?, ?, ?, ?)')
    .bind(challenge.challengeId, challenge.provider, challenge.identifier, code, challenge.createdAt, challenge.expiresAt)
    .run();
  return challenge;
}

async function verifyOtpChallenge(db: D1Database, body: Record<string, unknown> | undefined) {
  const challengeId = String(body?.challengeId ?? '');
  const code = String(body?.code ?? '');
  const challenge = await db
    .prepare('select id, provider, identifier, code, expires_at as expiresAt, consumed_at as consumedAt from auth_challenges where id = ?')
    .bind(challengeId)
    .first<{ id: string; provider: string; identifier: string; code: string; expiresAt: string; consumedAt?: string | null }>();
  if (!challenge || challenge.consumedAt || challenge.code !== code || Date.parse(challenge.expiresAt) <= Date.now()) return undefined;
  await db.prepare('update auth_challenges set consumed_at = ? where id = ?').bind(nowIso(), challengeId).run();
  const user = await upsertUser(db, challenge.provider, challenge.identifier, challenge.identifier);
  const payload = createSessionPayload(user);
  await persistSession(db, payload.session);
  return payload;
}

function oauthMetadata(provider: OAuthProvider, requestUrl: URL, env: CloudflareEnv) {
  const redirect = requestUrl.searchParams.get('redirect') ?? '/';
  const callback = `${requestUrl.origin}/api/auth/oauth-callback?provider=${provider}&redirect=${encodeURIComponent(redirect)}`;
  const clientId = provider === 'github' ? env.GITHUB_CLIENT_ID : env.WECHAT_CLIENT_ID;
  const base = provider === 'github' ? 'https://github.com/login/oauth/authorize' : 'https://open.weixin.qq.com/connect/qrconnect';
  const authUrl = `${base}?client_id=${encodeURIComponent(clientId ?? 'configure-client-id')}&redirect_uri=${encodeURIComponent(callback)}&response_type=code&scope=${provider === 'github' ? 'read:user user:email' : 'snsapi_login'}`;
  return { provider, authUrl, configured: Boolean(clientId), callback };
}

async function analyzeFund(request: Request, env: CloudflareEnv, marketData: MarketDataService, deepSeekFetch: typeof fetch) {
  if (!env.DEEPSEEK_API_KEY) return error(503, 'DEEPSEEK_KEY_MISSING', 'DeepSeek API key 未配置');
  const body = (await readJson(request)) as Record<string, unknown> | undefined;
  const code = String(body?.code ?? '');
  if (!/^\d{6}$/.test(code)) return error(400, 'FUND_CODE_INVALID', '基金代码格式不正确');

  const steps: Array<{ name: string; status: 'done'; summary: string }> = [];
  const fund = await resolveFundQuote(code, env, marketData);
  if (!fund) return error(404, 'FUND_NOT_FOUND', '未找到该基金');
  steps.push({ name: 'collect_fund_quote', status: 'done', summary: `读取 ${fund.name} 当前净值 ${fund.netValue}` });

  const history = await marketData.getFundHistory(code, '1y');
  steps.push({ name: 'collect_history', status: 'done', summary: `读取 ${history.length} 条历史净值` });

  const indices = await marketData.getIndices();
  steps.push({ name: 'collect_market_context', status: 'done', summary: `读取 ${indices.length} 个主要指数` });

  const indicators = computeFundIndicators(history);
  steps.push({ name: 'compute_indicators', status: 'done', summary: `区间收益 ${indicators.totalReturn.toFixed(2)}%，最大回撤 ${indicators.maxDrawdown.toFixed(2)}%` });

  const prompt = buildResearchPrompt({ fund, history, indices, indicators });
  steps.push({ name: 'build_research_prompt', status: 'done', summary: '构建包含指标、行情和输出契约的研究提示' });

  const response = await deepSeekFetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: '你是谨慎的基金研究助理。必须输出结构化 JSON，必须强调不构成投资建议。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.25,
    }),
  });
  if (!response.ok) return error(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 分析服务暂不可用');
  steps.push({ name: 'call_deepseek', status: 'done', summary: 'DeepSeek v4 Flash 返回结构化研究内容' });
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '暂无分析结果';
  const report = normalizeAnalysisReport(content);
  const chartAnnotations = normalizeChartAnnotations(content, report.summary);
  steps.push({ name: 'normalize_report', status: 'done', summary: '规范化研究报告、情景和图表标注' });

  return json({ fund, agent: { model: 'deepseek-v4-flash', steps, indicators }, report, chartAnnotations, analysis: report.summary });
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
          const auth = await getAuthContext(env.GG_FUND_DB, request);
          if (path === '/api/health') return json({ ok: true, service: 'gg-fund-pages-api', database: 'd1', cache: 'kv', auth: [...AUTH_PROVIDERS], ai: 'deepseek-v4-flash-agent' });
          if (path === '/api/auth/me') return auth ? json(auth) : error(401, 'AUTH_REQUIRED', '请先登录');
          if (path === '/api/auth/oauth-url') {
            const provider = url.searchParams.get('provider');
            return isOAuthProvider(provider) ? json(oauthMetadata(provider, url, env)) : error(400, 'AUTH_PROVIDER_UNSUPPORTED', '暂不支持该登录方式');
          }
          if (path === '/api/market/indices') return json(await marketData.getIndices());
          if (path === '/api/funds/search') return json(await marketData.searchFunds(url.searchParams.get('q') ?? ''));
          if (path === '/api/funds/trending') return json(await marketData.getTrendingFunds());
          if (path === '/api/portfolio/default') {
            const portfolio = await ensureDefaultPortfolio(env.GG_FUND_DB, auth?.user.id);
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
          const auth = await getAuthContext(env.GG_FUND_DB, request);
          if (path === '/api/auth/challenge') {
            const result = await createOtpChallenge(env.GG_FUND_DB, (await readJson(request)) as Record<string, unknown> | undefined);
            if (result && 'error' in result && result.error === 'invalid_identifier') return error(400, 'AUTH_IDENTIFIER_INVALID', '登录标识格式不正确');
            return result ? json(result, 201) : error(400, 'AUTH_PROVIDER_UNSUPPORTED', '暂不支持该登录方式');
          }
          if (path === '/api/auth/verify') {
            const result = await verifyOtpChallenge(env.GG_FUND_DB, (await readJson(request)) as Record<string, unknown> | undefined);
            return result ? json(result, 201, { 'set-cookie': sessionCookie(result.session.token, result.session.expiresAt) }) : error(400, 'AUTH_CHALLENGE_INVALID', '验证码无效或已过期');
          }
          if (path === '/api/auth/logout') return logout(env.GG_FUND_DB, request);
          if (path === '/api/auth/start') return error(410, 'AUTH_FLOW_REQUIRED', '请使用 OTP 验证或 OAuth 跳转登录');
          if (path === '/api/ai/analyze-fund') return analyzeFund(request, env, marketData, deepSeekFetch);
          if (path === '/api/portfolio/default/holdings') {
            const portfolio = await ensureDefaultPortfolio(env.GG_FUND_DB, auth?.user.id);
            await addHolding(env.GG_FUND_DB, portfolio.id, (await readJson(request)) as Record<string, unknown> | undefined);
            return json(await getPortfolioSnapshot(env.GG_FUND_DB, portfolio.id), 201);
          }
          if (path === '/api/portfolio/default/watchlist') {
            const portfolio = await ensureDefaultPortfolio(env.GG_FUND_DB, auth?.user.id);
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

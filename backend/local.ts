import { createCloudflareApi, type CloudflareEnv } from './api';

class LocalKV {
  private store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

class LocalD1Prepared {
  private params: unknown[] = [];

  constructor(private db: LocalD1, private sql: string) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T = unknown>() {
    return this.db.first<T>(this.sql, this.params);
  }

  async all<T = unknown>() {
    return { results: this.db.all<T>(this.sql, this.params) };
  }

  async run() {
    this.db.run(this.sql, this.params);
    return { success: true };
  }
}

class LocalD1 {
  private portfolios: Array<Record<string, unknown>> = [];
  private holdings: Array<Record<string, unknown>> = [];
  private watchlist: Array<Record<string, unknown>> = [];
  private authUsers: Array<Record<string, unknown>> = [];
  private authSessions: Array<Record<string, unknown>> = [];
  private authChallenges: Array<Record<string, unknown>> = [];

  prepare(sql: string) {
    return new LocalD1Prepared(this, sql);
  }

  first<T>(sql: string, params: unknown[]): T | null {
    if (sql.includes('from portfolios order by')) return (this.portfolios[0] as T) ?? null;
    if (sql.includes('from portfolios where id')) return (this.portfolios.find((item) => item.id === params[0]) as T) ?? null;
    if (sql.includes('from auth_users where provider')) return (this.authUsers.find((item) => item.provider === params[0] && item.identifier === params[1]) as T) ?? null;
    if (sql.includes('from auth_challenges where id')) return (this.authChallenges.find((item) => item.id === params[0]) as T) ?? null;
    if (sql.includes('from auth_sessions')) return (this.authSessions.find((item) => item.token === params[0]) as T) ?? null;
    return null;
  }

  all<T>(sql: string, params: unknown[]): T[] {
    if (sql.includes('from holdings')) return this.holdings.filter((item) => item.portfolioId === params[0]) as T[];
    if (sql.includes('from watchlist')) return this.watchlist.filter((item) => item.portfolioId === params[0]) as T[];
    return [];
  }

  run(sql: string, params: unknown[]) {
    if (sql.includes('insert into portfolios')) this.portfolios.push({ id: params[0], name: params[1], createdAt: params[2], updatedAt: params[3] });
    if (sql.includes('insert into holdings')) this.upsertHolding(params);
    if (sql.includes('insert into watchlist')) this.upsertWatchItem(params);
    if (sql.includes('insert into auth_users')) this.authUsers.push({ id: params[0], provider: params[1], identifier: params[2], displayName: params[3], createdAt: params[4], updatedAt: params[5] });
    if (sql.includes('insert into auth_sessions')) this.authSessions.push({ token: params[0], userId: params[1], createdAt: params[2], expiresAt: params[3] });
    if (sql.includes('insert into auth_challenges')) this.authChallenges.push({ id: params[0], provider: params[1], identifier: params[2], code: params[3], createdAt: params[4], expiresAt: params[5], consumedAt: null });
    if (sql.includes('update auth_challenges set consumed_at')) {
      const challenge = this.authChallenges.find((item) => item.id === params[1]);
      if (challenge) challenge.consumedAt = params[0];
    }
  }

  private upsertHolding(params: unknown[]) {
    const existing = this.holdings.find((item) => item.portfolioId === params[1] && item.fundCode === params[2]);
    const next = { id: params[0], portfolioId: params[1], fundCode: params[2], fundName: params[3], shares: params[4], costAmount: params[5], purchaseDate: params[6], note: params[7], createdAt: params[8], updatedAt: params[9] };
    if (existing) Object.assign(existing, next, { id: existing.id, createdAt: existing.createdAt });
    else this.holdings.push(next);
  }

  private upsertWatchItem(params: unknown[]) {
    const existing = this.watchlist.find((item) => item.portfolioId === params[0] && item.fundCode === params[1]);
    if (existing) Object.assign(existing, { fundName: params[2] });
    else this.watchlist.push({ portfolioId: params[0], fundCode: params[1], fundName: params[2], createdAt: params[3] });
  }
}

export function createLocalCloudflareEnv(): CloudflareEnv {
  return {
    GG_FUND_DB: new LocalD1(),
    GG_FUND_CACHE: new LocalKV(),
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    WECHAT_CLIENT_ID: process.env.WECHAT_CLIENT_ID,
  };
}

if (import.meta.main) {
  const env = createLocalCloudflareEnv();
  const api = createCloudflareApi();
  const port = Number(process.env.PORT ?? 8787);

  Bun.serve({
    port,
    fetch: (request) => api.fetch(request, env),
  });

  console.log(`GG Fund Functions API listening on http://localhost:${port}`);
}

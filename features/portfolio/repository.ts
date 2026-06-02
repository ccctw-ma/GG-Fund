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

export type PortfolioSnapshot = {
  portfolio: { id: string; name: string; createdAt: string; updatedAt: string } | null;
  holdings: Array<{
    id: string;
    fundCode: string;
    fundName: string;
    shares: number;
    costAmount: number;
    recordedMarketValue?: number | null;
    purchaseDate?: string | null;
    note?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  watchlist: Array<{
    fundCode: string;
    fundName: string;
    createdAt: string;
  }>;
};

export type HoldingInput = {
  fundCode: string;
  fundName: string;
  shares?: number;
  costAmount: number;
  recordedMarketValue?: number;
  purchaseDate?: string;
  note?: string;
};

export type WatchItemInput = {
  fundCode: string;
  fundName: string;
};

export function createPortfolioRepository(db: D1Database, nowIso = () => new Date().toISOString()) {
  return {
    async ensureDefaultPortfolio(userId?: string) {
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
    },

    async getSnapshot(portfolioId: string): Promise<PortfolioSnapshot> {
      const portfolio = await db
        .prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios where id = ?')
        .bind(portfolioId)
        .first<PortfolioSnapshot['portfolio']>();
      const holdings = await db
        .prepare('select id, fund_code as fundCode, fund_name as fundName, shares, cost_amount as costAmount, recorded_market_value as recordedMarketValue, purchase_date as purchaseDate, note, created_at as createdAt, updated_at as updatedAt from holdings where portfolio_id = ? order by created_at')
        .bind(portfolioId)
        .all<PortfolioSnapshot['holdings'][number]>();
      const watchlist = await db
        .prepare('select fund_code as fundCode, fund_name as fundName, created_at as createdAt from watchlist where portfolio_id = ? order by created_at')
        .bind(portfolioId)
        .all<PortfolioSnapshot['watchlist'][number]>();
      return { portfolio, holdings: holdings.results, watchlist: watchlist.results };
    },

    async addHolding(portfolioId: string, input: HoldingInput) {
      const timestamp = nowIso();
      await db
        .prepare(`
          insert into holdings (id, portfolio_id, fund_code, fund_name, shares, cost_amount, recorded_market_value, purchase_date, note, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(portfolio_id, fund_code) do update set
            fund_name = excluded.fund_name,
            shares = excluded.shares,
            cost_amount = excluded.cost_amount,
            recorded_market_value = excluded.recorded_market_value,
            purchase_date = excluded.purchase_date,
            note = excluded.note,
            updated_at = excluded.updated_at
        `)
        .bind(
          crypto.randomUUID(),
          portfolioId,
          input.fundCode,
          input.fundName,
          input.shares ?? 0,
          input.costAmount,
          input.recordedMarketValue ?? null,
          input.purchaseDate ?? null,
          input.note ?? null,
          timestamp,
          timestamp,
        )
        .run();
    },

    async addWatchItem(portfolioId: string, input: WatchItemInput) {
      await db
        .prepare(`
          insert into watchlist (portfolio_id, fund_code, fund_name, created_at)
          values (?, ?, ?, ?)
          on conflict(portfolio_id, fund_code) do update set fund_name = excluded.fund_name
        `)
        .bind(portfolioId, input.fundCode, input.fundName, nowIso())
        .run();
    },

    async replaceSnapshot(portfolioId: string, holdings: HoldingInput[], watchlist: WatchItemInput[]) {
      await db.prepare('delete from holdings where portfolio_id = ?').bind(portfolioId).run();
      await db.prepare('delete from watchlist where portfolio_id = ?').bind(portfolioId).run();
      for (const holding of holdings) {
        await this.addHolding(portfolioId, holding);
      }
      for (const item of watchlist) {
        await this.addWatchItem(portfolioId, item);
      }
      const timestamp = nowIso();
      await db.prepare('update portfolios set updated_at = ? where id = ?').bind(timestamp, portfolioId).run();
    },
  };
}

export type PortfolioRepository = ReturnType<typeof createPortfolioRepository>;

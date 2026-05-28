import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FundQuote } from './types';

type HoldingInput = {
  fundCode: string;
  fundName: string;
  shares: number;
  costAmount: number;
  purchaseDate?: string;
  note?: string;
};

type WatchInput = {
  fundCode: string;
  fundName: string;
};

const nowIso = () => new Date().toISOString();

function ensureColumn(db: Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) db.run(`alter table ${table} add column ${column} ${definition}`);
}

function migrate(db: Database) {
  db.exec(`
    create table if not exists portfolios (
      id text primary key,
      name text not null,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists holdings (
      id text primary key,
      portfolio_id text not null references portfolios(id) on delete cascade,
      fund_code text not null,
      fund_name text not null,
      shares real not null,
      cost_amount real not null,
      purchase_date text,
      note text,
      created_at text not null,
      updated_at text not null,
      unique(portfolio_id, fund_code)
    );
    create table if not exists watchlist (
      portfolio_id text not null references portfolios(id) on delete cascade,
      fund_code text not null,
      fund_name text not null,
      created_at text not null,
      primary key(portfolio_id, fund_code)
    );
    create table if not exists fund_quote_cache (
      code text primary key,
      name text not null,
      net_value real not null,
      official_net_value real,
      daily_change_percent real,
      quote_date text not null,
      estimate_time text,
      quote_type text,
      source text not null,
      cached_at text not null
    );
    create table if not exists auth_users (
      id text primary key,
      provider text not null,
      identifier text not null,
      display_name text,
      created_at text not null,
      updated_at text not null,
      unique(provider, identifier)
    );
    create table if not exists auth_sessions (
      token text primary key,
      user_id text not null references auth_users(id) on delete cascade,
      created_at text not null,
      expires_at text not null
    );
  `);
  ensureColumn(db, 'fund_quote_cache', 'official_net_value', 'real');
  ensureColumn(db, 'fund_quote_cache', 'estimate_time', 'text');
  ensureColumn(db, 'fund_quote_cache', 'quote_type', 'text');
}

export function createDatabaseService(filename = process.env.GG_FUND_DB ?? './data/gg-fund.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.run('pragma journal_mode = WAL');
  migrate(db);

  return {
    raw: db,
    migrate: () => migrate(db),
    createPortfolio(name: string) {
      const id = crypto.randomUUID();
      const timestamp = nowIso();
      db.prepare('insert into portfolios (id, name, created_at, updated_at) values (?, ?, ?, ?)').run(id, name, timestamp, timestamp);
      return { id, name, createdAt: timestamp, updatedAt: timestamp };
    },
    ensureDefaultPortfolio() {
      const existing = db.prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios order by created_at limit 1').get() as
        | { id: string; name: string; createdAt: string; updatedAt: string }
        | undefined;
      return existing ?? this.createPortfolio('默认组合');
    },
    upsertHolding(portfolioId: string, input: HoldingInput) {
      const id = crypto.randomUUID();
      const timestamp = nowIso();
      db.prepare(`
        insert into holdings (id, portfolio_id, fund_code, fund_name, shares, cost_amount, purchase_date, note, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(portfolio_id, fund_code) do update set
          fund_name = excluded.fund_name,
          shares = excluded.shares,
          cost_amount = excluded.cost_amount,
          purchase_date = excluded.purchase_date,
          note = excluded.note,
          updated_at = excluded.updated_at
      `).run(id, portfolioId, input.fundCode, input.fundName, input.shares, input.costAmount, input.purchaseDate ?? null, input.note ?? null, timestamp, timestamp);
    },
    upsertWatchItem(portfolioId: string, input: WatchInput) {
      db.prepare(`
        insert into watchlist (portfolio_id, fund_code, fund_name, created_at)
        values (?, ?, ?, ?)
        on conflict(portfolio_id, fund_code) do update set fund_name = excluded.fund_name
      `).run(portfolioId, input.fundCode, input.fundName, nowIso());
    },
    cacheFundQuote(quote: FundQuote) {
      db.prepare(`
        insert into fund_quote_cache (code, name, net_value, official_net_value, daily_change_percent, quote_date, estimate_time, quote_type, source, cached_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(code) do update set
          name = excluded.name,
          net_value = excluded.net_value,
          official_net_value = excluded.official_net_value,
          daily_change_percent = excluded.daily_change_percent,
          quote_date = excluded.quote_date,
          estimate_time = excluded.estimate_time,
          quote_type = excluded.quote_type,
          source = excluded.source,
          cached_at = excluded.cached_at
      `).run(quote.code, quote.name, quote.netValue, quote.officialNetValue ?? null, quote.dailyChangePercent ?? null, quote.quoteDate, quote.estimateTime ?? null, quote.quoteType ?? null, quote.source, nowIso());
    },
    getCachedFundQuote(code: string): FundQuote | undefined {
      const row = db.prepare('select code, name, net_value as netValue, official_net_value as officialNetValue, daily_change_percent as dailyChangePercent, quote_date as quoteDate, estimate_time as estimateTime, quote_type as quoteType, source from fund_quote_cache where code = ?').get(code) as FundQuote | undefined;
      return row;
    },
    getPortfolioSnapshot(portfolioId: string) {
      const portfolio = db.prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios where id = ?').get(portfolioId) as { id: string; name: string; createdAt: string; updatedAt: string };
      const holdings = db.prepare('select id, fund_code as fundCode, fund_name as fundName, shares, cost_amount as costAmount, purchase_date as purchaseDate, note, created_at as createdAt, updated_at as updatedAt from holdings where portfolio_id = ? order by created_at').all(portfolioId);
      const watchlist = db.prepare('select fund_code as fundCode, fund_name as fundName, created_at as createdAt from watchlist where portfolio_id = ? order by created_at').all(portfolioId);
      return { portfolio, holdings, watchlist };
    },
    close() {
      db.close();
    },
  };
}

export type DatabaseService = ReturnType<typeof createDatabaseService>;

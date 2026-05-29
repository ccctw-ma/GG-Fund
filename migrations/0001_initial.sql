create table if not exists portfolios (
  id text primary key,
  user_id text references auth_users(id) on delete cascade,
  name text not null,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_portfolios_user_id on portfolios(user_id);

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

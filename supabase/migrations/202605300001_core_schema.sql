create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '默认组合',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_code text not null,
  fund_name text not null,
  shares numeric not null default 0,
  cost_amount numeric not null default 0,
  purchase_date date,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (portfolio_id, fund_code)
);

create table if not exists public.watchlist (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_code text not null,
  fund_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (portfolio_id, fund_code)
);

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.watchlist enable row level security;

create policy "profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are writable by owner"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "portfolios are readable by owner"
  on public.portfolios for select
  using (auth.uid() = user_id);

create policy "portfolios are writable by owner"
  on public.portfolios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "holdings are readable by owner"
  on public.holdings for select
  using (auth.uid() = user_id);

create policy "holdings are writable by owner"
  on public.holdings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "watchlist is readable by owner"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "watchlist is writable by owner"
  on public.watchlist for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

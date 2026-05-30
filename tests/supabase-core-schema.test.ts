import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/202605300001_core_schema.sql');
const sql = readFileSync(migrationPath, 'utf8');

describe('supabase core schema migration', () => {
  it('creates the core public tables', () => {
    expect(sql).toMatch(/create table if not exists public\.profiles\s*\(/);
    expect(sql).toMatch(/create table if not exists public\.portfolios\s*\(/);
    expect(sql).toMatch(/create table if not exists public\.holdings\s*\(/);
    expect(sql).toMatch(/create table if not exists public\.watchlist\s*\(/);
    expect(sql).toMatch(/create table if not exists public\.billing_customers\s*\(/);
  });

  it('enables row level security on every core table', () => {
    expect(sql).toContain('alter table public.profiles enable row level security;');
    expect(sql).toContain('alter table public.portfolios enable row level security;');
    expect(sql).toContain('alter table public.holdings enable row level security;');
    expect(sql).toContain('alter table public.watchlist enable row level security;');
    expect(sql).toContain('alter table public.billing_customers enable row level security;');
  });

  it('defines owner-scoped read and write policies for profile and portfolio tables', () => {
    expect(sql).toContain('create policy "profiles are readable by owner"');
    expect(sql).toContain('create policy "profiles are writable by owner"');
    expect(sql).toContain('create policy "portfolios are readable by owner"');
    expect(sql).toContain('create policy "portfolios are writable by owner"');
    expect(sql).toContain('create policy "holdings are readable by owner"');
    expect(sql).toContain('create policy "holdings are writable by owner"');
    expect(sql).toContain('create policy "watchlist is readable by owner"');
    expect(sql).toContain('create policy "watchlist is writable by owner"');
    expect(sql).toContain('using (auth.uid() = id);');
    expect(sql).toContain('using (auth.uid() = user_id);');
    expect(sql).toContain('with check (auth.uid() = id);');
    expect(sql).toContain('with check (auth.uid() = user_id);');
  });

  it('verifies holdings and watchlist access through portfolio ownership checks', () => {
    expect(sql).toMatch(/create policy "holdings are readable by owner"[\s\S]*?using \(\s*auth\.uid\(\) = user_id\s+and exists \(\s*select 1\s+from public\.portfolios p\s+where p\.id = holdings\.portfolio_id\s+and p\.user_id = auth\.uid\(\)\s*\)\s*\);/);
    expect(sql).toMatch(/create policy "holdings are writable by owner"[\s\S]*?with check \(\s*auth\.uid\(\) = user_id\s+and exists \(\s*select 1\s+from public\.portfolios p\s+where p\.id = holdings\.portfolio_id\s+and p\.user_id = auth\.uid\(\)\s*\)\s*\);/);
    expect(sql).toMatch(/create policy "watchlist is readable by owner"[\s\S]*?using \(\s*auth\.uid\(\) = user_id\s+and exists \(\s*select 1\s+from public\.portfolios p\s+where p\.id = watchlist\.portfolio_id\s+and p\.user_id = auth\.uid\(\)\s*\)\s*\);/);
    expect(sql).toMatch(/create policy "watchlist is writable by owner"[\s\S]*?with check \(\s*auth\.uid\(\) = user_id\s+and exists \(\s*select 1\s+from public\.portfolios p\s+where p\.id = watchlist\.portfolio_id\s+and p\.user_id = auth\.uid\(\)\s*\)\s*\);/);
  });

  it('stores Stripe customer status with owner-only read access', () => {
    expect(sql).toMatch(/create table if not exists public\.billing_customers\s*\([\s\S]*?user_id uuid primary key references auth\.users\(id\) on delete cascade,[\s\S]*?stripe_customer_id text not null unique,[\s\S]*?status text not null,[\s\S]*?price_id text,[\s\S]*?created_at timestamptz not null default timezone\('utc', now\(\)\),[\s\S]*?updated_at timestamptz not null default timezone\('utc', now\(\)\)[\s\S]*?\);/);
    expect(sql).toMatch(/create policy "billing customers are readable by owner"[\s\S]*?on public\.billing_customers for select[\s\S]*?using \(auth\.uid\(\) = user_id\);/);
  });
});

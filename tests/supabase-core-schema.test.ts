import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const sqlByFile = new Map(
  migrationFiles.map((file) => [file, readFileSync(join(migrationsDir, file), 'utf8')]),
);

const allSql = [...sqlByFile.values()].join('\n\n');
const coreSchemaSql = sqlByFile.get('202605300001_core_schema.sql') ?? '';
const billingCustomersSql = sqlByFile.get('202605300002_billing_customers.sql') ?? '';

describe('supabase schema migrations', () => {
  it('creates the core public tables across the migration set', () => {
    expect(allSql).toMatch(/create table if not exists public\.profiles\s*\(/);
    expect(allSql).toMatch(/create table if not exists public\.portfolios\s*\(/);
    expect(allSql).toMatch(/create table if not exists public\.holdings\s*\(/);
    expect(allSql).toMatch(/create table if not exists public\.watchlist\s*\(/);
    expect(allSql).toMatch(/create table if not exists public\.billing_customers\s*\(/);
  });

  it('keeps billing_customers in a follow-up migration for existing environments', () => {
    expect(migrationFiles).toContain('202605300002_billing_customers.sql');
    expect(coreSchemaSql).not.toMatch(/billing_customers/);
    expect(billingCustomersSql).toMatch(/create table if not exists public\.billing_customers\s*\(/);
  });

  it('enables row level security on every core table across all migrations', () => {
    expect(allSql).toContain('alter table public.profiles enable row level security;');
    expect(allSql).toContain('alter table public.portfolios enable row level security;');
    expect(allSql).toContain('alter table public.holdings enable row level security;');
    expect(allSql).toContain('alter table public.watchlist enable row level security;');
    expect(allSql).toMatch(/alter table(?: if exists)? public\.billing_customers enable row level security;/);
  });

  it('defines owner-scoped read and write policies for profile and portfolio tables', () => {
    expect(allSql).toContain('create policy "profiles are readable by owner"');
    expect(allSql).toContain('create policy "profiles are writable by owner"');
    expect(allSql).toContain('create policy "portfolios are readable by owner"');
    expect(allSql).toContain('create policy "portfolios are writable by owner"');
    expect(allSql).toContain('create policy "holdings are readable by owner"');
    expect(allSql).toContain('create policy "holdings are writable by owner"');
    expect(allSql).toContain('create policy "watchlist is readable by owner"');
    expect(allSql).toContain('create policy "watchlist is writable by owner"');
    expect(allSql).toContain('using (auth.uid() = id);');
    expect(allSql).toContain('using (auth.uid() = user_id);');
    expect(allSql).toContain('with check (auth.uid() = id);');
    expect(allSql).toContain('with check (auth.uid() = user_id);');
  });

  it('verifies holdings and watchlist access through portfolio ownership checks', () => {
    expect(allSql).toMatch(/create policy "holdings are readable by owner"[\s\S]*?using \(\s*auth\.uid\(\) = user_id\s+and exists \(\s*select 1\s+from public\.portfolios p\s+where p\.id = holdings\.portfolio_id\s+and p\.user_id = auth\.uid\(\)\s*\)\s*\);/);
    expect(allSql).toMatch(/create policy "holdings are writable by owner"[\s\S]*?with check \(\s*auth\.uid\(\) = user_id\s+and exists \(\s*select 1\s+from public\.portfolios p\s+where p\.id = holdings\.portfolio_id\s+and p\.user_id = auth\.uid\(\)\s*\)\s*\);/);
    expect(allSql).toMatch(/create policy "watchlist is readable by owner"[\s\S]*?using \(\s*auth\.uid\(\) = user_id\s+and exists \(\s*select 1\s+from public\.portfolios p\s+where p\.id = watchlist\.portfolio_id\s+and p\.user_id = auth\.uid\(\)\s*\)\s*\);/);
    expect(allSql).toMatch(/create policy "watchlist is writable by owner"[\s\S]*?with check \(\s*auth\.uid\(\) = user_id\s+and exists \(\s*select 1\s+from public\.portfolios p\s+where p\.id = watchlist\.portfolio_id\s+and p\.user_id = auth\.uid\(\)\s*\)\s*\);/);
  });

  it('stores Stripe customer status with owner-only read access in an idempotent follow-up migration', () => {
    expect(billingCustomersSql).toMatch(/create table if not exists public\.billing_customers\s*\([\s\S]*?user_id uuid primary key references auth\.users\(id\) on delete cascade,[\s\S]*?stripe_customer_id text not null unique,[\s\S]*?status text not null,[\s\S]*?price_id text,[\s\S]*?created_at timestamptz not null default timezone\('utc', now\(\)\),[\s\S]*?updated_at timestamptz not null default timezone\('utc', now\(\)\)[\s\S]*?\);/);
    expect(billingCustomersSql).toMatch(/do \$\$[\s\S]*?from pg_policies[\s\S]*?billing customers are readable by owner[\s\S]*?create policy "billing customers are readable by owner"[\s\S]*?on public\.billing_customers for select[\s\S]*?using \(auth\.uid\(\) = user_id\);[\s\S]*?end\s*\$\$;/i);
  });
});

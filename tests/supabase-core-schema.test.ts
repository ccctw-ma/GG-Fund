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
  });

  it('enables row level security on every core table', () => {
    expect(sql).toContain('alter table public.profiles enable row level security;');
    expect(sql).toContain('alter table public.portfolios enable row level security;');
    expect(sql).toContain('alter table public.holdings enable row level security;');
    expect(sql).toContain('alter table public.watchlist enable row level security;');
  });

  it('defines owner-scoped read and write policies for each table', () => {
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
});

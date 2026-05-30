# Cloudflare Next.js Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild GG-Fund as a Cloudflare-first Next.js App Router SaaS foundation with Supabase Auth/Postgres, Stripe billing, Resend email, PostHog analytics, and the existing fund market/AI experience preserved.

**Architecture:** Use Next.js App Router with thin route handlers that delegate to focused `features/*` services. Use OpenNext for Cloudflare Workers deployment, Supabase as the canonical authenticated data store, Cloudflare KV as an optional short-lived market cache, and browser local storage only for anonymous/import compatibility.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, shadcn/ui-style Radix primitives, Supabase JS/SSR, Stripe, Resend, PostHog, OpenNext Cloudflare, Vitest, Playwright, Bun.

---

## Decision policy

The user has instructed that when a decision is needed, the first/recommended option should be chosen without stopping for user selection. This plan therefore uses the first option throughout: OpenNext Cloudflare Workers, Supabase Auth/Postgres, Stripe subscriptions, Resend product email, and PostHog product analytics.

## File Structure

### Create

- `app/layout.tsx`: Root Next.js layout and global metadata.
- `app/page.tsx`: Public landing page.
- `app/app/page.tsx`: Main fund workspace route.
- `app/app/funds/[code]/page.tsx`: Fund detail and AI analysis route.
- `app/app/portfolio/page.tsx`: Portfolio route.
- `app/pricing/page.tsx`: Pricing and checkout entry.
- `app/settings/page.tsx`: Account/data settings route.
- `app/api/health/route.ts`: Cloudflare-compatible health endpoint.
- `app/api/market/indices/route.ts`: Index quote route handler.
- `app/api/funds/search/route.ts`: Fund search route handler.
- `app/api/funds/[code]/route.ts`: Fund detail route handler.
- `app/api/funds/[code]/history/route.ts`: Fund history route handler.
- `app/api/funds/trending/route.ts`: Trending fund route handler.
- `app/api/portfolio/default/route.ts`: Default portfolio read/write route handler.
- `app/api/ai/analyze-fund/route.ts`: Fund analysis route handler.
- `app/api/billing/checkout/route.ts`: Stripe checkout route handler.
- `app/api/billing/webhook/route.ts`: Stripe webhook route handler.
- `app/globals.css`: Tailwind v4 globals and GG-Fund theme tokens.
- `components/workspace/FundWorkspace.tsx`: Client workspace component adapted from current `frontend/src/App.tsx` behavior.
- `features/market/service.ts`: Server-only market service and cache wrapper.
- `features/portfolio/repository.ts`: Supabase-backed portfolio repository.
- `features/portfolio/localStorage.ts`: Browser anonymous holdings/watchlist storage, ported from current storage logic.
- `features/auth/session.ts`: Supabase session helpers for route handlers.
- `features/ai/service.ts`: DeepSeek analysis orchestration wrapper.
- `features/billing/stripe.ts`: Stripe client and checkout/webhook helpers.
- `features/email/resend.ts`: Resend client and send helper.
- `features/analytics/posthog.ts`: PostHog client/server helpers.
- `lib/env.ts`: Runtime environment parsing with public/server accessors.
- `lib/http.ts`: JSON response helpers shared by route handlers.
- `lib/supabase/browser.ts`: Browser Supabase client.
- `lib/supabase/server.ts`: Server Supabase clients.
- `middleware.ts`: Supabase session cookie refresh middleware.
- `next.config.ts`: Next/OpenNext dev initialization.
- `open-next.config.ts`: OpenNext Cloudflare config.
- `postcss.config.mjs`: Tailwind v4 PostCSS config for Next.
- `wrangler.jsonc`: Cloudflare Workers deployment config for OpenNext.
- `public/_headers`: Immutable caching headers for Next static chunks.
- `supabase/migrations/202605300001_core_schema.sql`: Supabase tables and RLS.
- `tests/features/market.service.test.ts`: Market service tests.
- `tests/features/portfolio.repository.test.ts`: Portfolio repository tests with mocked Supabase client.
- `tests/features/billing.stripe.test.ts`: Stripe checkout/webhook helper tests.
- `tests/features/email.resend.test.ts`: Resend helper tests.
- `tests/features/analytics.posthog.test.ts`: PostHog helper tests.
- `tests/api/health.route.test.ts`: Health route test.
- `tests/e2e/next-core.spec.ts`: Next app E2E smoke tests.

### Modify

- `package.json`: Replace Vite scripts with Next/OpenNext scripts and add Next/SaaS dependencies.
- `tsconfig.json`: Add Next-compatible compiler settings and path aliases.
- `eslint.config.js`: Add Next/React lint coverage and ignore generated OpenNext output.
- `vitest.config.ts` or `vite.config.ts`: Keep Vitest config while removing Vite app build responsibility.
- `playwright.config.ts`: Point E2E web server to Next dev or OpenNext preview.
- `.gitignore`: Ignore `.next`, `.open-next`, `.vercel`, and local env files.
- `README.md`: Document the new stack, local dev, APIs, validation, and Cloudflare deploy.
- `README.en.md`: English mirror of user-facing/contributor docs.
- `docs/deployment.md`: Replace Vite Pages Functions deployment with OpenNext Cloudflare deployment.
- `AGENTS.md`: Update required validation commands and Cloudflare/Supabase/Stripe/Resend/PostHog secret rules.
- `.github/workflows/cloudflare-deploy.yml`: Build and deploy through OpenNext Cloudflare.
- `scripts/deploy-cloudflare.sh`: Build/upload/deploy the OpenNext worker.
- `scripts/verify-cloudflare.sh`: Verify app and API endpoints.
- `shared/types.ts`: Ensure DTOs are the canonical app/server contracts.
- `shared/marketData.ts`: Keep server-safe market adapters.
- `backend/fundAnalysis.ts`: Move or re-export AI analysis helpers through `features/ai/service.ts`.

### Delete after replacement

- `index.html`: Replaced by Next App Router.
- `frontend/src/main.tsx`: Replaced by `app/layout.tsx` and route pages.
- `functions/api/[[path]].ts`: Replaced by Next route handlers.
- `backend/local.ts`: Replaced by Next/OpenNext dev and preview scripts.
- Vite-only package/runtime config once no script imports it.

## Tasks

### Task 1: Add Next/OpenNext dependencies and scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `next.config.ts`
- Create: `open-next.config.ts`
- Create: `postcss.config.mjs`
- Create: `wrangler.jsonc`
- Create: `public/_headers`

- [ ] **Step 1: Write a failing package-script smoke check**

Run:

```bash
node -e "const p=require('./package.json'); for (const s of ['dev','build','preview','deploy:cloudflare','cf-typegen']) { if (!p.scripts[s]) throw new Error('missing script '+s); } if (!p.dependencies.next) throw new Error('missing next'); if (!p.devDependencies['@opennextjs/cloudflare']) throw new Error('missing opennext');"
```

Expected: FAIL with `missing next` or `missing script preview`.

- [ ] **Step 2: Install dependencies**

Run:

```bash
bun add next @supabase/ssr stripe resend posthog-js posthog-node
bun add -d @opennextjs/cloudflare wrangler @tailwindcss/postcss eslint-config-next
```

Expected: `package.json` and `bun.lock` include the new dependencies.

- [ ] **Step 3: Replace scripts in `package.json`**

Set the `scripts` object to:

```json
{
  "dev": "next dev --hostname 0.0.0.0",
  "build": "bun run typecheck && next build",
  "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
  "deploy:cloudflare": "bash scripts/deploy-cloudflare.sh",
  "verify:cloudflare": "bash scripts/verify-cloudflare.sh",
  "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "test": "vitest run",
  "test:unit": "vitest run",
  "coverage": "vitest run --coverage",
  "test:e2e": "playwright test tests/e2e/next-core.spec.ts",
  "test:midscene": "zsh scripts/test-midscene.sh",
  "check": "bun run lint && bun run test && bun run coverage && bun run build && bun run test:e2e",
  "precommit:install": "git config core.hooksPath .githooks",
  "ci:test": "bash scripts/ci-test.sh",
  "start": "bun run preview"
}
```

Keep existing dependency entries unless a later cleanup task removes them.

- [ ] **Step 4: Create `next.config.ts`**

```ts
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
```

- [ ] **Step 5: Create `open-next.config.ts`**

```ts
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});
```

- [ ] **Step 6: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 7: Create `wrangler.jsonc`**

```jsonc
{
  "name": "gg-fund",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-05-28",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "gg-fund"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "GG_FUND_CACHE",
      "id": "ab630e246f6943208e41eb6f576686c8",
      "preview_id": "8daa99e7276f424c8c5b19ccf36c756f"
    }
  ],
  "vars": {
    "NODE_VERSION": "22"
  }
}
```

- [ ] **Step 8: Create `public/_headers`**

```txt
/_next/static/*
  Cache-Control: public,max-age=31536000,immutable
```

- [ ] **Step 9: Update `.gitignore`**

Add these lines:

```gitignore
.next
.open-next
.vercel
.env
.env.local
.env*.local
cloudflare-env.d.ts
```

- [ ] **Step 10: Verify package smoke check passes**

Run:

```bash
node -e "const p=require('./package.json'); for (const s of ['dev','build','preview','deploy:cloudflare','cf-typegen']) { if (!p.scripts[s]) throw new Error('missing script '+s); } if (!p.dependencies.next) throw new Error('missing next'); if (!p.devDependencies['@opennextjs/cloudflare']) throw new Error('missing opennext'); console.log('next scripts ok');"
```

Expected: PASS and prints `next scripts ok`.

- [ ] **Step 11: Commit**

```bash
git add package.json bun.lock .gitignore next.config.ts open-next.config.ts postcss.config.mjs wrangler.jsonc public/_headers
git commit -m "chore: add next cloudflare foundation

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 2: Create the Next app shell and theme

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/app/page.tsx`
- Create: `app/app/funds/[code]/page.tsx`
- Create: `app/app/portfolio/page.tsx`
- Create: `app/pricing/page.tsx`
- Create: `app/settings/page.tsx`
- Create: `app/globals.css`
- Create: `components/workspace/FundWorkspace.tsx`

- [ ] **Step 1: Write a failing build check**

Run:

```bash
bun run build
```

Expected: FAIL because `app/layout.tsx` does not exist or Next cannot find a root layout.

- [ ] **Step 2: Create `app/globals.css`**

```css
@import "tailwindcss";

:root {
  --background: #f7f4ed;
  --foreground: #17201a;
  --card: rgba(255, 255, 255, 0.82);
  --card-foreground: #17201a;
  --muted: #eee7d8;
  --muted-foreground: #647066;
  --primary: #b88936;
  --primary-foreground: #fffaf0;
  --mint: #55c7a0;
  --border: rgba(23, 32, 26, 0.12);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(184, 137, 54, 0.22), transparent 34rem),
    radial-gradient(circle at bottom right, rgba(85, 199, 160, 0.2), transparent 30rem),
    var(--background);
  color: var(--foreground);
  font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.fund-card {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(23, 32, 26, 0.08);
  backdrop-filter: blur(18px);
}
```

- [ ] **Step 3: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GG Fund 中国基金行情',
  description: 'Cloudflare-first 的基金行情、持仓和 AI 投研工作台。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Create `components/workspace/FundWorkspace.tsx`**

```tsx
'use client';

import Link from 'next/link';

export function FundWorkspace() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-white/70 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--primary)]">Cloudflare-first · Supabase-ready · AI-ready</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">GG Fund 智能基金账户</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">实时行情、组合盈亏、AI 研究和订阅能力会在 Next.js 架构中逐步恢复。</p>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm font-medium">
          <Link className="rounded-full bg-[var(--primary)] px-4 py-2 text-[var(--primary-foreground)]" href="/app/portfolio">组合</Link>
          <Link className="rounded-full border border-[var(--border)] px-4 py-2" href="/pricing">订阅</Link>
          <Link className="rounded-full border border-[var(--border)] px-4 py-2" href="/settings">设置</Link>
        </nav>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['行情 API', 'Next Route Handlers'],
          ['账户数据', 'Supabase Postgres + RLS'],
          ['部署', 'OpenNext Cloudflare Workers'],
        ].map(([label, value]) => (
          <article className="fund-card p-5" key={label}>
            <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
            <strong className="mt-2 block text-xl">{value}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Create route pages**

Create `app/page.tsx`:

```tsx
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16">
      <section className="fund-card p-8 md:p-12">
        <p className="text-sm font-semibold text-[var(--primary)]">Next.js + Supabase + Cloudflare</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">GG Fund 中国基金行情与 AI 投研工作台</h1>
        <p className="mt-6 max-w-3xl text-lg text-[var(--muted-foreground)]">使用无聊但稳妥的独立开发者栈重构：Next.js App Router、Tailwind、shadcn/ui 风格组件、Supabase、Stripe、Resend、PostHog，并坚持 Cloudflare-first 部署。</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="rounded-full bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--primary-foreground)]" href="/app">进入工作台</Link>
          <Link className="rounded-full border border-[var(--border)] px-5 py-3 font-semibold" href="/pricing">查看订阅</Link>
        </div>
      </section>
    </main>
  );
}
```

Create `app/app/page.tsx`:

```tsx
import { FundWorkspace } from '@/components/workspace/FundWorkspace';

export default function AppPage() {
  return <FundWorkspace />;
}
```

Create `app/app/funds/[code]/page.tsx`:

```tsx
import Link from 'next/link';

export default function FundDetailPage({ params }: { params: { code: string } }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link className="text-sm text-[var(--primary)]" href="/app">← 返回工作台</Link>
      <section className="fund-card mt-6 p-6">
        <p className="text-sm text-[var(--muted-foreground)]">基金代码</p>
        <h1 className="mt-2 text-3xl font-bold">{params.code}</h1>
        <p className="mt-4 text-[var(--muted-foreground)]">基金详情、历史净值和 AI 分析将在市场服务迁移任务中接入。</p>
      </section>
    </main>
  );
}
```

Create `app/app/portfolio/page.tsx`:

```tsx
export default function PortfolioPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <section className="fund-card p-6">
        <h1 className="text-3xl font-bold">我的组合</h1>
        <p className="mt-4 text-[var(--muted-foreground)]">Supabase-backed 持仓和自选会在组合迁移任务中接入。</p>
      </section>
    </main>
  );
}
```

Create `app/pricing/page.tsx`:

```tsx
export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <section className="fund-card p-6">
        <p className="text-sm font-semibold text-[var(--primary)]">Stripe Billing</p>
        <h1 className="mt-2 text-3xl font-bold">订阅方案</h1>
        <p className="mt-4 text-[var(--muted-foreground)]">订阅 checkout 会在 Stripe 任务中接入。</p>
      </section>
    </main>
  );
}
```

Create `app/settings/page.tsx`:

```tsx
export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <section className="fund-card p-6">
        <h1 className="text-3xl font-bold">设置</h1>
        <p className="mt-4 text-[var(--muted-foreground)]">账户、数据导入导出和通知设置会在后续任务中接入。</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Verify Next build reaches compilation**

Run:

```bash
bun run build
```

Expected: build either PASS or fails only on configuration conflicts from legacy Vite/Vitest files. Fix import path errors before continuing.

- [ ] **Step 7: Commit**

```bash
git add app components/workspace
git commit -m "feat: add next app shell

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 3: Add environment and HTTP helpers

**Files:**
- Create: `lib/env.ts`
- Create: `lib/http.ts`
- Create: `tests/lib.env.test.ts`

- [ ] **Step 1: Create failing env tests**

Create `tests/lib.env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getPublicEnv, readRequiredEnv } from '../lib/env';

describe('env helpers', () => {
  it('returns public env values from process.env', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';

    expect(getPublicEnv()).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      posthogKey: 'phc_test',
      posthogHost: 'https://us.i.posthog.com',
    });
  });

  it('throws a named error for missing required server env', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => readRequiredEnv('STRIPE_SECRET_KEY')).toThrow('Missing required environment variable: STRIPE_SECRET_KEY');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/lib.env.test.ts
```

Expected: FAIL because `lib/env.ts` does not exist.

- [ ] **Step 3: Create `lib/env.ts`**

```ts
export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  posthogKey: string;
  posthogHost: string;
};

export function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function readOptionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
    posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  };
}
```

- [ ] **Step 4: Create `lib/http.ts`**

```ts
export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  });
}

export function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message } }, { status });
}
```

- [ ] **Step 5: Verify tests pass**

```bash
bun run test -- tests/lib.env.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/env.ts lib/http.ts tests/lib.env.test.ts
git commit -m "feat: add runtime env helpers

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 4: Add Supabase clients and database schema

**Files:**
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`
- Create: `features/auth/session.ts`
- Create: `middleware.ts`
- Create: `supabase/migrations/202605300001_core_schema.sql`
- Create: `tests/features/auth.session.test.ts`

- [ ] **Step 1: Create failing auth-session tests**

Create `tests/features/auth.session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { authHeaderFromToken, mapSupabaseUser } from '../../features/auth/session';

describe('auth session helpers', () => {
  it('builds bearer auth headers', () => {
    expect(authHeaderFromToken('abc123')).toEqual({ Authorization: 'Bearer abc123' });
  });

  it('maps a Supabase user to UI auth session user fields', () => {
    expect(mapSupabaseUser({ id: 'user-1', email: 'me@example.com', user_metadata: { name: 'Me' } })).toEqual({
      id: 'user-1',
      provider: 'supabase',
      identifier: 'me@example.com',
      displayName: 'Me',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/features/auth.session.test.ts
```

Expected: FAIL because `features/auth/session.ts` does not exist.

- [ ] **Step 3: Create `features/auth/session.ts`**

```ts
import type { User } from '@supabase/supabase-js';

export type UiAuthUser = {
  id: string;
  provider: 'supabase';
  identifier: string;
  displayName: string;
};

export function authHeaderFromToken(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function mapSupabaseUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>): UiAuthUser {
  const identifier = user.email ?? String(user.user_metadata?.email ?? user.id);
  return {
    id: user.id,
    provider: 'supabase',
    identifier,
    displayName: String(user.user_metadata?.name ?? identifier),
  };
}
```

- [ ] **Step 4: Create `lib/supabase/browser.ts`**

```ts
'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';

export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) return undefined;
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
```

- [ ] **Step 5: Create `lib/supabase/server.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getPublicEnv, readRequiredEnv } from '@/lib/env';

export async function createSupabaseRouteClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}

export function createSupabaseServiceClient() {
  const env = getPublicEnv();
  return createClient(env.supabaseUrl, readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

- [ ] **Step 6: Create `middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 7: Create Supabase migration**

Create `supabase/migrations/202605300001_core_schema.sql`:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '默认组合',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_code text not null,
  fund_name text not null,
  shares numeric not null check (shares >= 0),
  cost_amount numeric not null check (cost_amount >= 0),
  purchase_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(portfolio_id, fund_code)
);

create table if not exists public.watchlist (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_code text not null,
  fund_name text not null,
  created_at timestamptz not null default now(),
  primary key(portfolio_id, fund_code)
);

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique not null,
  status text not null default 'inactive',
  price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.watchlist enable row level security;
alter table public.billing_customers enable row level security;

create policy "profiles own rows" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "portfolios own rows" on public.portfolios for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "holdings own rows" on public.holdings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "watchlist own rows" on public.watchlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "billing own rows" on public.billing_customers for select using (user_id = auth.uid());
```

- [ ] **Step 8: Verify tests pass**

```bash
bun run test -- tests/features/auth.session.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/supabase features/auth middleware.ts supabase/migrations tests/features/auth.session.test.ts
git commit -m "feat: add supabase auth foundation

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 5: Port market service and API routes

**Files:**
- Create: `features/market/service.ts`
- Create: `app/api/health/route.ts`
- Create: `app/api/market/indices/route.ts`
- Create: `app/api/funds/search/route.ts`
- Create: `app/api/funds/[code]/route.ts`
- Create: `app/api/funds/[code]/history/route.ts`
- Create: `app/api/funds/trending/route.ts`
- Create: `tests/features/market.service.test.ts`
- Create: `tests/api/health.route.test.ts`

- [ ] **Step 1: Create failing market service test**

Create `tests/features/market.service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createMarketService } from '../../features/market/service';

describe('market service', () => {
  it('returns cached fund quotes before calling live market data', async () => {
    const marketData = { getFund: vi.fn(), searchFunds: vi.fn(), getIndices: vi.fn(), getFundHistory: vi.fn(), getTrendingFunds: vi.fn() };
    const cache = {
      get: vi.fn(async () => JSON.stringify({ code: '000001', name: '华夏成长', netValue: 1.23, source: 'cache' })),
      put: vi.fn(async () => undefined),
    };
    const service = createMarketService({ marketData, cache });

    await expect(service.getFund('000001')).resolves.toMatchObject({ code: '000001', source: 'cache' });
    expect(marketData.getFund).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Create failing health route test**

Create `tests/api/health.route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GET } from '../../app/api/health/route';

describe('/api/health', () => {
  it('reports next cloudflare service capabilities', async () => {
    const response = await GET();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'gg-fund-next-api',
      database: 'supabase',
      cache: 'cloudflare-kv',
      auth: ['supabase'],
      billing: 'stripe',
      email: 'resend',
      analytics: 'posthog',
      ai: 'deepseek-v4-flash-agent',
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
bun run test -- tests/features/market.service.test.ts tests/api/health.route.test.ts
```

Expected: FAIL because the files under `features/market` and `app/api/health` do not exist.

- [ ] **Step 4: Create `features/market/service.ts`**

```ts
import { createMarketDataService, type MarketDataService } from '@/shared/marketData';

type CacheLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

function isUsableCachedFund(fund: unknown): boolean {
  return typeof fund === 'object' && fund !== null && (fund as { source?: string }).source !== '内置示例行情';
}

export function createMarketService(options: { marketData?: MarketDataService; cache?: CacheLike } = {}) {
  const marketData = options.marketData ?? createMarketDataService();
  const cache = options.cache;

  return {
    getIndices() {
      return marketData.getIndices();
    },
    searchFunds(query: string) {
      return marketData.searchFunds(query);
    },
    getTrendingFunds() {
      return marketData.getTrendingFunds();
    },
    getFundHistory(code: string, range: string) {
      return marketData.getFundHistory(code, range);
    },
    async getFund(code: string) {
      const cacheKey = `fund:${code}`;
      const raw = cache ? await cache.get(cacheKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isUsableCachedFund(parsed)) return parsed;
      }
      const liveFund = await marketData.getFund(code);
      if (isUsableCachedFund(liveFund)) {
        await cache?.put(cacheKey, JSON.stringify(liveFund), { expirationTtl: 60 });
        return liveFund;
      }
      const official = (await marketData.searchFunds(code)).find((item) => item.code === code);
      if (official && isUsableCachedFund(official)) {
        await cache?.put(cacheKey, JSON.stringify(official), { expirationTtl: 60 });
        return official;
      }
      return undefined;
    },
  };
}
```

- [ ] **Step 5: Create API route handlers**

Create `app/api/health/route.ts`:

```ts
import { jsonResponse } from '@/lib/http';

export function GET() {
  return jsonResponse({
    ok: true,
    service: 'gg-fund-next-api',
    database: 'supabase',
    cache: 'cloudflare-kv',
    auth: ['supabase'],
    billing: 'stripe',
    email: 'resend',
    analytics: 'posthog',
    ai: 'deepseek-v4-flash-agent',
  });
}
```

Create `app/api/market/indices/route.ts`:

```ts
import { createMarketService } from '@/features/market/service';
import { jsonResponse } from '@/lib/http';

export async function GET() {
  return jsonResponse(await createMarketService().getIndices());
}
```

Create `app/api/funds/search/route.ts`:

```ts
import { createMarketService } from '@/features/market/service';
import { jsonResponse } from '@/lib/http';

export async function GET(request: Request) {
  const url = new URL(request.url);
  return jsonResponse(await createMarketService().searchFunds(url.searchParams.get('q') ?? ''));
}
```

Create `app/api/funds/[code]/route.ts`:

```ts
import { createMarketService } from '@/features/market/service';
import { errorResponse, jsonResponse } from '@/lib/http';

export async function GET(_request: Request, { params }: { params: { code: string } }) {
  if (!/^\d{6}$/.test(params.code)) return errorResponse(400, 'FUND_CODE_INVALID', '基金代码格式不正确');
  const fund = await createMarketService().getFund(params.code);
  return fund ? jsonResponse(fund) : errorResponse(404, 'FUND_NOT_FOUND', '未找到该基金');
}
```

Create `app/api/funds/[code]/history/route.ts`:

```ts
import { createMarketService } from '@/features/market/service';
import { errorResponse, jsonResponse } from '@/lib/http';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  if (!/^\d{6}$/.test(params.code)) return errorResponse(400, 'FUND_CODE_INVALID', '基金代码格式不正确');
  const url = new URL(request.url);
  return jsonResponse(await createMarketService().getFundHistory(params.code, url.searchParams.get('range') ?? '1m'));
}
```

Create `app/api/funds/trending/route.ts`:

```ts
import { createMarketService } from '@/features/market/service';
import { jsonResponse } from '@/lib/http';

export async function GET() {
  return jsonResponse(await createMarketService().getTrendingFunds());
}
```

- [ ] **Step 6: Verify tests pass**

```bash
bun run test -- tests/features/market.service.test.ts tests/api/health.route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add features/market app/api/health app/api/market app/api/funds tests/features/market.service.test.ts tests/api/health.route.test.ts
git commit -m "feat: migrate market api routes to next

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 6: Add Supabase-backed portfolio repository and route

**Files:**
- Create: `features/portfolio/repository.ts`
- Create: `features/portfolio/localStorage.ts`
- Create: `app/api/portfolio/default/route.ts`
- Create: `tests/features/portfolio.repository.test.ts`

- [ ] **Step 1: Create failing repository tests**

Create `tests/features/portfolio.repository.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createPortfolioRepository } from '../../features/portfolio/repository';

describe('portfolio repository', () => {
  it('creates a default portfolio when none exists', async () => {
    const single = vi.fn(async () => ({ data: null, error: null }));
    const insertSingle = vi.fn(async () => ({ data: { id: 'p1', name: '默认组合' }, error: null }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'portfolios') {
          return {
            select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(() => ({ single })) })) })) })),
            insert: vi.fn(() => ({ select: vi.fn(() => ({ single: insertSingle })) })),
          };
        }
        return { select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [], error: null })) })) };
      }),
    } as never;

    const repo = createPortfolioRepository(supabase);
    await expect(repo.getDefaultPortfolio('user-1')).resolves.toMatchObject({ portfolio: { id: 'p1' }, holdings: [], watchlist: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/features/portfolio.repository.test.ts
```

Expected: FAIL because `features/portfolio/repository.ts` does not exist.

- [ ] **Step 3: Create `features/portfolio/repository.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Holding, WatchItem } from '@/frontend/src/types';

type PortfolioRow = { id: string; name: string; created_at?: string; updated_at?: string };

export type PortfolioSnapshot = {
  portfolio: { id: string; name: string; createdAt?: string; updatedAt?: string };
  holdings: Holding[];
  watchlist: WatchItem[];
};

function mapPortfolio(row: PortfolioRow) {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function createPortfolioRepository(supabase: SupabaseClient) {
  async function ensureDefaultPortfolio(userId: string) {
    const existing = await supabase
      .from('portfolios')
      .select('id,name,created_at,updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (existing.data) return mapPortfolio(existing.data as PortfolioRow);

    const created = await supabase
      .from('portfolios')
      .insert({ user_id: userId, name: '默认组合' })
      .select('id,name,created_at,updated_at')
      .single();

    if (created.error || !created.data) throw created.error ?? new Error('portfolio_create_failed');
    return mapPortfolio(created.data as PortfolioRow);
  }

  return {
    async getDefaultPortfolio(userId: string): Promise<PortfolioSnapshot> {
      const portfolio = await ensureDefaultPortfolio(userId);
      const [holdings, watchlist] = await Promise.all([
        supabase.from('holdings').select('*').eq('portfolio_id', portfolio.id),
        supabase.from('watchlist').select('*').eq('portfolio_id', portfolio.id),
      ]);
      if (holdings.error) throw holdings.error;
      if (watchlist.error) throw watchlist.error;
      return {
        portfolio,
        holdings: ((holdings.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          fundCode: String(row.fund_code),
          fundName: String(row.fund_name),
          shares: Number(row.shares),
          costAmount: Number(row.cost_amount),
          purchaseDate: typeof row.purchase_date === 'string' ? row.purchase_date : undefined,
          note: typeof row.note === 'string' ? row.note : undefined,
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
        })),
        watchlist: ((watchlist.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
          fundCode: String(row.fund_code),
          fundName: String(row.fund_name),
          createdAt: String(row.created_at),
        })),
      };
    },
  };
}
```

- [ ] **Step 4: Create `features/portfolio/localStorage.ts` by moving current browser storage behavior**

Copy the logic from `frontend/src/storage.ts` into `features/portfolio/localStorage.ts`, change imports to use the canonical shared/browser types, and export these functions with the same names:

```ts
export { exportLocalData, loadHoldings, loadWatchlist, parseImportedData, saveHoldings, saveWatchlist } from '@/frontend/src/storage';
```

This re-export is acceptable for the first pass because it keeps behavior unchanged while route/page migration continues.

- [ ] **Step 5: Create `app/api/portfolio/default/route.ts`**

```ts
import { createPortfolioRepository } from '@/features/portfolio/repository';
import { errorResponse, jsonResponse } from '@/lib/http';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseRouteClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return errorResponse(401, 'AUTH_REQUIRED', '请先登录');
  const repo = createPortfolioRepository(supabase);
  return jsonResponse(await repo.getDefaultPortfolio(data.user.id));
}
```

- [ ] **Step 6: Verify repository test passes**

```bash
bun run test -- tests/features/portfolio.repository.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add features/portfolio app/api/portfolio tests/features/portfolio.repository.test.ts
git commit -m "feat: add supabase portfolio repository

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 7: Port AI analysis route

**Files:**
- Create: `features/ai/service.ts`
- Create: `app/api/ai/analyze-fund/route.ts`
- Create: `tests/features/ai.service.test.ts`

- [ ] **Step 1: Create failing AI service test**

Create `tests/features/ai.service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { analyzeFundWithFallback } from '../../features/ai/service';

describe('ai service', () => {
  it('returns local fallback when DeepSeek key is missing', async () => {
    const market = {
      getFund: vi.fn(async () => ({ code: '000001', name: '华夏成长', netValue: 1.2 })),
      getFundHistory: vi.fn(async () => [
        { date: '2026-05-01', netValue: 1 },
        { date: '2026-05-30', netValue: 1.2 },
      ]),
      getIndices: vi.fn(async () => []),
    };

    const result = await analyzeFundWithFallback({ code: '000001', market, deepSeekApiKey: undefined, deepSeekFetch: fetch });
    expect(result.agent.model).toBe('local-fallback');
    expect(result.report.disclaimer).toContain('不构成投资建议');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/features/ai.service.test.ts
```

Expected: FAIL because `features/ai/service.ts` does not exist.

- [ ] **Step 3: Create `features/ai/service.ts`**

```ts
import { buildResearchPrompt, computeFundIndicators, normalizeAnalysisReport, normalizeChartAnnotations } from '@/backend/fundAnalysis';

type MarketForAi = {
  getFund(code: string): Promise<any>;
  getFundHistory(code: string, range: string): Promise<any[]>;
  getIndices(): Promise<any[]>;
};

function buildLocalReport(fund: { name: string; code: string; netValue?: number }, indicators: ReturnType<typeof computeFundIndicators>) {
  const trendVerb = indicators.shortMomentum >= 1 ? '近 5 期净值走强' : indicators.shortMomentum <= -1 ? '近 5 期净值走弱' : '近 5 期净值震荡';
  const riskVerb = indicators.maxDrawdown <= -10 ? '历史最大回撤偏深，需关注下行风险' : indicators.maxDrawdown <= -5 ? '历史最大回撤中等，建议设置止损线' : '历史最大回撤可控';
  const probability: 'low' | 'medium' | 'high' = indicators.volatility > 2 ? 'low' : indicators.volatility > 1 ? 'medium' : 'high';
  return {
    summary: `${fund.name}(${fund.code}) 一年区间收益 ${indicators.totalReturn.toFixed(2)}%，${trendVerb}，最大回撤 ${indicators.maxDrawdown.toFixed(2)}%。`,
    trend: `区间收益 ${indicators.totalReturn.toFixed(2)}%、短期动量 ${indicators.shortMomentum.toFixed(2)}%、趋势斜率 ${indicators.trendSlope.toFixed(2)}，${trendVerb}。`,
    risk: `波动率 ${indicators.volatility.toFixed(2)}，${riskVerb}。`,
    scenarios: [
      { name: '乐观情景', probability, description: '若净值持续突破近期高点，区间收益有望延续。' },
      { name: '中性情景', probability: 'medium' as const, description: '若市场维持震荡，净值围绕当前水平波动。' },
      { name: '压力情景', probability: 'low' as const, description: '若回撤再度逼近历史最大值，需关注止损。' },
    ],
    watchPoints: ['净值突破近期高点', '最大回撤是否扩大', '主要指数与板块的联动'],
    disclaimer: '本分析为本地指标推算，仅供学习参考，不构成投资建议。',
  };
}

export async function analyzeFundWithFallback(options: { code: string; market: MarketForAi; deepSeekApiKey?: string; deepSeekFetch: typeof fetch }) {
  const fund = await options.market.getFund(options.code);
  if (!fund) throw new Error('FUND_NOT_FOUND');
  const history = await options.market.getFundHistory(options.code, '1y');
  const indices = await options.market.getIndices();
  const indicators = computeFundIndicators(history);
  const steps = [
    { name: 'collect_fund_quote', status: 'done' as const, summary: `读取 ${fund.name} 当前净值 ${fund.netValue}` },
    { name: 'collect_history', status: 'done' as const, summary: `读取 ${history.length} 条历史净值` },
    { name: 'collect_market_context', status: 'done' as const, summary: `读取 ${indices.length} 个主要指数` },
    { name: 'compute_indicators', status: 'done' as const, summary: `区间收益 ${indicators.totalReturn.toFixed(2)}%，最大回撤 ${indicators.maxDrawdown.toFixed(2)}%` },
  ];

  if (!options.deepSeekApiKey) {
    const report = buildLocalReport(fund, indicators);
    return {
      fund,
      agent: { model: 'local-fallback', steps: [...steps, { name: 'call_deepseek', status: 'done' as const, summary: '未配置 DeepSeek key，使用本地确定性报告作为降级输出' }], indicators },
      report,
      chartAnnotations: [{ label: '本地降级', description: report.summary, tone: 'neutral' as const }],
      analysis: report.summary,
    };
  }

  const prompt = buildResearchPrompt({ fund, history, indices, indicators });
  const response = await options.deepSeekFetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.deepSeekApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: '你是谨慎的基金研究助理。必须输出结构化 JSON，必须强调不构成投资建议。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.25,
    }),
  });
  if (!response.ok) throw new Error('DEEPSEEK_UPSTREAM_ERROR');
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '暂无分析结果';
  const report = normalizeAnalysisReport(content);
  return { fund, agent: { model: 'deepseek-v4-flash', steps, indicators }, report, chartAnnotations: normalizeChartAnnotations(content, report.summary), analysis: report.summary };
}
```

- [ ] **Step 4: Create `app/api/ai/analyze-fund/route.ts`**

```ts
import { analyzeFundWithFallback } from '@/features/ai/service';
import { createMarketService } from '@/features/market/service';
import { errorResponse, jsonResponse } from '@/lib/http';
import { readOptionalEnv } from '@/lib/env';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as { code?: string } | undefined;
  const code = String(body?.code ?? '');
  if (!/^\d{6}$/.test(code)) return errorResponse(400, 'FUND_CODE_INVALID', '基金代码格式不正确');
  try {
    return jsonResponse(await analyzeFundWithFallback({ code, market: createMarketService(), deepSeekApiKey: readOptionalEnv('DEEPSEEK_API_KEY'), deepSeekFetch: fetch }));
  } catch (error) {
    if (error instanceof Error && error.message === 'FUND_NOT_FOUND') return errorResponse(404, 'FUND_NOT_FOUND', '未找到该基金');
    if (error instanceof Error && error.message === 'DEEPSEEK_UPSTREAM_ERROR') return errorResponse(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 分析服务暂不可用');
    return errorResponse(502, 'AI_ANALYSIS_FAILED', 'AI 分析服务暂不可用');
  }
}
```

- [ ] **Step 5: Verify test passes**

```bash
bun run test -- tests/features/ai.service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add features/ai app/api/ai tests/features/ai.service.test.ts
git commit -m "feat: migrate ai analysis route

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 8: Add Stripe billing foundation

**Files:**
- Create: `features/billing/stripe.ts`
- Create: `app/api/billing/checkout/route.ts`
- Create: `app/api/billing/webhook/route.ts`
- Create: `tests/features/billing.stripe.test.ts`
- Modify: `app/pricing/page.tsx`

- [ ] **Step 1: Create failing billing tests**

Create `tests/features/billing.stripe.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCheckoutMetadata, subscriptionStatusFromStripe } from '../../features/billing/stripe';

describe('stripe helpers', () => {
  it('adds user id metadata to checkout sessions', () => {
    expect(buildCheckoutMetadata('user-1')).toEqual({ supabaseUserId: 'user-1' });
  });

  it('normalizes active subscription status', () => {
    expect(subscriptionStatusFromStripe({ status: 'active', items: { data: [{ price: { id: 'price_123' } }] } })).toEqual({ status: 'active', priceId: 'price_123' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/features/billing.stripe.test.ts
```

Expected: FAIL because `features/billing/stripe.ts` does not exist.

- [ ] **Step 3: Create `features/billing/stripe.ts`**

```ts
import Stripe from 'stripe';
import { readRequiredEnv } from '@/lib/env';

export function createStripeClient() {
  return new Stripe(readRequiredEnv('STRIPE_SECRET_KEY'), { apiVersion: '2025-04-30.basil' });
}

export function buildCheckoutMetadata(userId: string) {
  return { supabaseUserId: userId };
}

export function subscriptionStatusFromStripe(subscription: { status?: string; items?: { data?: Array<{ price?: { id?: string } }> } }) {
  return {
    status: subscription.status ?? 'inactive',
    priceId: subscription.items?.data?.[0]?.price?.id ?? null,
  };
}
```

- [ ] **Step 4: Create `app/api/billing/checkout/route.ts`**

```ts
import { buildCheckoutMetadata, createStripeClient } from '@/features/billing/stripe';
import { errorResponse, jsonResponse } from '@/lib/http';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as { priceId?: string } | undefined;
  if (!body?.priceId) return errorResponse(400, 'PRICE_REQUIRED', '缺少订阅价格');

  const supabase = await createSupabaseRouteClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return errorResponse(401, 'AUTH_REQUIRED', '请先登录');

  const url = new URL(request.url);
  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: body.priceId, quantity: 1 }],
    success_url: `${url.origin}/settings?checkout=success`,
    cancel_url: `${url.origin}/pricing?checkout=cancelled`,
    client_reference_id: data.user.id,
    customer_email: data.user.email ?? undefined,
    metadata: buildCheckoutMetadata(data.user.id),
  });

  return jsonResponse({ url: session.url });
}
```

- [ ] **Step 5: Create `app/api/billing/webhook/route.ts`**

```ts
import { createStripeClient, subscriptionStatusFromStripe } from '@/features/billing/stripe';
import { errorResponse, jsonResponse } from '@/lib/http';
import { readRequiredEnv } from '@/lib/env';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const stripe = createStripeClient();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return errorResponse(400, 'STRIPE_SIGNATURE_REQUIRED', '缺少 Stripe 签名');

  const payload = await request.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, readRequiredEnv('STRIPE_WEBHOOK_SECRET'));
  } catch {
    return errorResponse(400, 'STRIPE_SIGNATURE_INVALID', 'Stripe 签名验证失败');
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as any;
    const userId = subscription.metadata?.supabaseUserId;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (userId && customerId) {
      const normalized = subscriptionStatusFromStripe(subscription);
      await createSupabaseServiceClient().from('billing_customers').upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        status: normalized.status,
        price_id: normalized.priceId,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return jsonResponse({ received: true });
}
```

- [ ] **Step 6: Update `app/pricing/page.tsx`**

Replace the placeholder page with:

```tsx
export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <section className="fund-card p-6">
        <p className="text-sm font-semibold text-[var(--primary)]">Stripe Billing</p>
        <h1 className="mt-2 text-3xl font-bold">订阅方案</h1>
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white/70 p-5">
          <h2 className="text-xl font-semibold">GG Fund Pro</h2>
          <p className="mt-2 text-[var(--muted-foreground)]">为 AI 投研、组合同步和未来高级提醒预留订阅入口。</p>
          <form action="/api/billing/checkout" method="post" className="mt-4">
            <input name="priceId" type="hidden" value="price_configure_in_stripe" />
            <button className="rounded-full bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--primary-foreground)]" type="submit">开始订阅</button>
          </form>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Verify tests pass**

```bash
bun run test -- tests/features/billing.stripe.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add features/billing app/api/billing app/pricing/page.tsx tests/features/billing.stripe.test.ts
git commit -m "feat: add stripe billing foundation

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 9: Add Resend email foundation

**Files:**
- Create: `features/email/resend.ts`
- Create: `tests/features/email.resend.test.ts`

- [ ] **Step 1: Create failing email test**

Create `tests/features/email.resend.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildWelcomeEmail } from '../../features/email/resend';

describe('resend email helpers', () => {
  it('builds a Chinese welcome email', () => {
    expect(buildWelcomeEmail('me@example.com')).toEqual({
      to: ['me@example.com'],
      subject: '欢迎使用 GG Fund',
      text: '欢迎使用 GG Fund。你的基金行情、持仓同步和 AI 投研工作台已准备好。',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/features/email.resend.test.ts
```

Expected: FAIL because `features/email/resend.ts` does not exist.

- [ ] **Step 3: Create `features/email/resend.ts`**

```ts
import { Resend } from 'resend';
import { readRequiredEnv } from '@/lib/env';

export function buildWelcomeEmail(to: string) {
  return {
    to: [to],
    subject: '欢迎使用 GG Fund',
    text: '欢迎使用 GG Fund。你的基金行情、持仓同步和 AI 投研工作台已准备好。',
  };
}

export async function sendWelcomeEmail(to: string) {
  const resend = new Resend(readRequiredEnv('RESEND_API_KEY'));
  const message = buildWelcomeEmail(to);
  return resend.emails.send({
    from: readRequiredEnv('AUTH_EMAIL_FROM'),
    ...message,
  });
}
```

- [ ] **Step 4: Verify test passes**

```bash
bun run test -- tests/features/email.resend.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/email tests/features/email.resend.test.ts
git commit -m "feat: add resend email foundation

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 10: Add PostHog analytics foundation

**Files:**
- Create: `features/analytics/posthog.ts`
- Create: `tests/features/analytics.posthog.test.ts`

- [ ] **Step 1: Create failing analytics test**

Create `tests/features/analytics.posthog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { safeAnalyticsProperties } from '../../features/analytics/posthog';

describe('posthog analytics helpers', () => {
  it('keeps only safe event properties', () => {
    expect(safeAnalyticsProperties({ fundCode: '000001', shares: 1000, query: '消费', token: 'secret' })).toEqual({ fundCode: '000001', query: '消费' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/features/analytics.posthog.test.ts
```

Expected: FAIL because `features/analytics/posthog.ts` does not exist.

- [ ] **Step 3: Create `features/analytics/posthog.ts`**

```ts
import posthog from 'posthog-js';
import { PostHog } from 'posthog-node';
import { getPublicEnv, readOptionalEnv } from '@/lib/env';

const SAFE_KEYS = new Set(['fundCode', 'query', 'route', 'source', 'status', 'plan']);

export function safeAnalyticsProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(properties).filter(([key]) => SAFE_KEYS.has(key)));
}

export function initBrowserPostHog() {
  const env = getPublicEnv();
  if (!env.posthogKey) return;
  posthog.init(env.posthogKey, { api_host: env.posthogHost, capture_pageview: true });
}

export function createServerPostHog() {
  const key = readOptionalEnv('POSTHOG_API_KEY') ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return undefined;
  return new PostHog(key, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com' });
}
```

- [ ] **Step 4: Verify test passes**

```bash
bun run test -- tests/features/analytics.posthog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/analytics tests/features/analytics.posthog.test.ts
git commit -m "feat: add posthog analytics foundation

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 11: Wire workspace client to Next APIs

**Files:**
- Modify: `components/workspace/FundWorkspace.tsx`
- Reuse: `frontend/src/api.ts` or create `features/market/client.ts` if direct import causes Vite env coupling.
- Modify: `app/app/funds/[code]/page.tsx`
- Modify: `app/app/portfolio/page.tsx`

- [ ] **Step 1: Run current E2E to capture missing behavior**

```bash
bun run test:e2e
```

Expected: FAIL because `tests/e2e/next-core.spec.ts` does not exist or because the workspace only shows placeholders.

- [ ] **Step 2: Create `tests/e2e/next-core.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('landing and workspace load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /GG Fund 中国基金行情/ })).toBeVisible();
  await page.getByRole('link', { name: '进入工作台' }).click();
  await expect(page.getByRole('heading', { name: 'GG Fund 智能基金账户' })).toBeVisible();
});

test('health api responds', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ service: 'gg-fund-next-api' });
});
```

- [ ] **Step 3: Update `playwright.config.ts` web server**

Use this `webServer` block:

```ts
webServer: {
  command: 'bun run dev',
  url: 'http://127.0.0.1:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
},
use: {
  baseURL: 'http://127.0.0.1:3000',
  trace: 'on-first-retry',
},
```

- [ ] **Step 4: Replace `components/workspace/FundWorkspace.tsx` with API-backed client shell**

```tsx
'use client';

import { useEffect, useState } from 'react';

type IndexQuote = { code: string; name: string; price: number; changePercent: number };

export function FundWorkspace() {
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetch('/api/market/indices')
      .then((response) => {
        if (!response.ok) throw new Error('行情加载失败');
        return response.json();
      })
      .then(setIndices)
      .catch((nextError: Error) => setError(nextError.message));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="fund-card p-6">
        <p className="text-sm font-semibold text-[var(--primary)]">Cloudflare-first · Supabase-ready · AI-ready</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">GG Fund 智能基金账户</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">实时行情、组合盈亏、AI 研究和订阅能力运行在 Next.js + Cloudflare 架构上。</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {indices.slice(0, 3).map((index) => (
          <article className="fund-card p-5" key={index.code}>
            <p className="text-sm text-[var(--muted-foreground)]">{index.name}</p>
            <strong className="mt-2 block text-xl">{index.price}</strong>
            <span className={index.changePercent >= 0 ? 'text-red-600' : 'text-emerald-600'}>{index.changePercent.toFixed(2)}%</span>
          </article>
        ))}
        {!indices.length && !error ? <article className="fund-card p-5">正在加载行情...</article> : null}
        {error ? <article className="fund-card p-5 text-red-600">{error}</article> : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verify E2E passes**

```bash
bun run test:e2e
```

Expected: PASS for landing/workspace and health API.

- [ ] **Step 6: Commit**

```bash
git add components/workspace app/app tests/e2e/next-core.spec.ts playwright.config.ts
git commit -m "feat: wire next workspace to api

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 12: Update deployment scripts and CI

**Files:**
- Modify: `scripts/deploy-cloudflare.sh`
- Modify: `scripts/verify-cloudflare.sh`
- Modify: `scripts/ci-test.sh`
- Modify: `.github/workflows/cloudflare-deploy.yml`

- [ ] **Step 1: Replace `scripts/deploy-cloudflare.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"

echo "Building Next.js app for Cloudflare Worker ${CF_WORKER_NAME}"
bun run build
bunx opennextjs-cloudflare build
bunx opennextjs-cloudflare deploy
```

- [ ] **Step 2: Replace `scripts/verify-cloudflare.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CF_VERIFY_BASE_URL:-https://gg-fund.pages.dev}"

echo "Verifying ${BASE_URL}"
curl --fail --silent --show-error "${BASE_URL}/" >/dev/null
curl --fail --silent --show-error "${BASE_URL}/api/health" >/dev/null
curl --fail --silent --show-error "${BASE_URL}/api/market/indices" >/dev/null
curl --fail --silent --show-error "${BASE_URL}/api/funds/000001" >/dev/null
```

- [ ] **Step 3: Replace `scripts/ci-test.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

- [ ] **Step 4: Update `.github/workflows/cloudflare-deploy.yml` deployment commands**

Use these job steps after dependency installation:

```yaml
      - name: Build OpenNext worker
        run: bunx opennextjs-cloudflare build

      - name: Deploy Cloudflare worker
        run: bunx opennextjs-cloudflare deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Verify deployment
        run: bun run verify:cloudflare
```

- [ ] **Step 5: Run script syntax checks**

```bash
bash -n scripts/deploy-cloudflare.sh
bash -n scripts/verify-cloudflare.sh
bash -n scripts/ci-test.sh
```

Expected: PASS with no output.

- [ ] **Step 6: Commit**

```bash
git add scripts/deploy-cloudflare.sh scripts/verify-cloudflare.sh scripts/ci-test.sh .github/workflows/cloudflare-deploy.yml
git commit -m "chore: update cloudflare deployment pipeline

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 13: Update documentation and env examples

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/deployment.md`
- Modify: `AGENTS.md`
- Create or Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**

```env
# Public browser-safe values
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Server secrets, configure in Cloudflare and local .env.local
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
RESEND_API_KEY=re_your_key
AUTH_EMAIL_FROM=GG Fund <login@example.com>
DEEPSEEK_API_KEY=your-deepseek-key
POSTHOG_API_KEY=phx_your_private_key
```

- [ ] **Step 2: Update `README.md` stack section**

Replace the technology stack bullets with:

```md
- Next.js App Router + TypeScript
- Tailwind CSS v4 + Radix UI + shadcn/ui 风格组件
- Supabase Auth + Supabase Postgres + RLS
- Stripe Checkout/Webhook 订阅基础
- Resend 产品邮件
- PostHog 产品分析
- OpenNext Cloudflare Workers 部署
- 东方财富/腾讯/天天基金公开接口 + fallback 示例行情
- DeepSeek v4 Flash 服务端分析
- ESLint + TypeScript 严格检查
- Vitest + Playwright E2E
```

- [ ] **Step 3: Update local development commands in `README.md`**

Use:

```md
## 本地开发

```bash
bun install
cp .env.example .env.local
bun run dev
```

打开 `http://127.0.0.1:3000`。
```

- [ ] **Step 4: Update `docs/deployment.md` architecture section**

Use:

```md
## 架构

- Web/App/API：Next.js App Router，通过 OpenNext 输出 Cloudflare Worker。
- API：`app/api/**/route.ts`，业务逻辑收敛到 `features/*`。
- 数据库/Auth：Supabase Auth + Supabase Postgres + RLS。
- 缓存：Cloudflare KV 可作为行情短缓存，访问封装在 market service 中。
- 支付：Stripe Checkout 与 webhook。
- 邮件：Resend 产品邮件。
- 分析：PostHog。
- Secret：所有服务端 key 通过 Cloudflare Secret 或本地 `.env.local` 注入，不进入前端 bundle。
```

- [ ] **Step 5: Update `AGENTS.md` secret section**

Use:

```md
## Secrets

Never commit API keys, tokens, OAuth secrets, Supabase service role keys, Stripe secrets, Resend keys, PostHog private keys, or provider client secrets. Use Cloudflare secrets for server values and `NEXT_PUBLIC_*` only for browser-safe public keys.

Required server secrets for production:

```bash
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put STRIPE_SECRET_KEY
bunx wrangler secret put STRIPE_WEBHOOK_SECRET
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put AUTH_EMAIL_FROM
bunx wrangler secret put DEEPSEEK_API_KEY
bunx wrangler secret put POSTHOG_API_KEY
```
```

- [ ] **Step 6: Mirror user-facing changes into `README.en.md`**

Translate the same stack, local development, deployment, API, and secret changes into English.

- [ ] **Step 7: Commit**

```bash
git add README.md README.en.md docs/deployment.md AGENTS.md .env.example
git commit -m "docs: document next cloudflare architecture

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 14: Remove legacy Vite/Pages Functions entrypoints

**Files:**
- Delete: `index.html`
- Delete: `frontend/src/main.tsx`
- Delete: `functions/api/[[path]].ts`
- Modify or delete: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `eslint.config.js`

- [ ] **Step 1: Verify no Next task imports legacy entrypoints**

```bash
rg "frontend/src/main|functions/api|vite --host|@tailwindcss/vite|index.html" package.json app components features lib shared tests scripts docs README.md README.en.md AGENTS.md
```

Expected before cleanup: matches in legacy scripts/docs. After the next steps, only historical design/plan docs may mention them.

- [ ] **Step 2: Delete replaced entrypoints**

```bash
git rm index.html frontend/src/main.tsx 'functions/api/[[path]].ts'
```

Expected: files staged for deletion.

- [ ] **Step 3: Update `tsconfig.json` paths**

Ensure these options exist:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "jsx": "preserve",
    "moduleResolution": "bundler",
    "allowJs": false,
    "strict": true,
    "noEmit": true,
    "isolatedModules": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".open-next"]
}
```

- [ ] **Step 4: Update ESLint ignores**

Add these ignores to `eslint.config.js`:

```js
ignores: ['dist', 'coverage', 'node_modules', '.next', '.open-next', 'cloudflare-env.d.ts'],
```

- [ ] **Step 5: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS. If imports from deleted entrypoints fail, update the importing file to the new Next route or feature module.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json eslint.config.js
git commit -m "refactor: remove legacy vite entrypoints

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

### Task 15: Final validation and release notes

**Files:**
- Modify as needed: files touched by validation fixes

- [ ] **Step 1: Run lint**

```bash
bun run lint
```

Expected: PASS.

- [ ] **Step 2: Run unit tests**

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 3: Run coverage**

```bash
bun run coverage
```

Expected: PASS with configured thresholds.

- [ ] **Step 4: Run build**

```bash
bun run build
```

Expected: PASS and `.next` output created.

- [ ] **Step 5: Run E2E**

```bash
bun run test:e2e
```

Expected: PASS for landing/workspace and health API.

- [ ] **Step 6: Run Cloudflare preview build**

```bash
bunx opennextjs-cloudflare build
```

Expected: PASS and `.open-next/worker.js` plus `.open-next/assets` created.

- [ ] **Step 7: Check git status**

```bash
git status --short
```

Expected: no unstaged files except intentionally ignored build output.

- [ ] **Step 8: Commit validation fixes if any**

```bash
git add <changed-files>
git commit -m "fix: stabilize next cloudflare validation

🤖 Generated with [Aiden x Claude Code]

Co-Authored-By: Aiden"
```

Only run this commit step if validation required code or doc fixes.

## Self-review

- Spec coverage: Next.js App Router, Cloudflare-first OpenNext deployment, Supabase Auth/Postgres/RLS, Stripe, Resend, PostHog, server-only market/AI routes, docs, tests, and cleanup are all mapped to tasks.
- Placeholder scan: This plan uses concrete files, commands, snippets, expected outputs, and commit messages. It avoids unresolved markers and unspecified tasks.
- Type consistency: Shared helper names are stable across tasks: `createMarketService`, `analyzeFundWithFallback`, `createPortfolioRepository`, `createSupabaseRouteClient`, `jsonResponse`, `errorResponse`, `buildCheckoutMetadata`, and `safeAnalyticsProperties`.

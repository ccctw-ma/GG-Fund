# GG Fund China Fund Market Dashboard

Chinese version: [README.md](./README.md)

GG Fund is migrating from a React + Vite setup toward a Cloudflare-first Next.js App Router architecture. The repository currently keeps both layers: `app/` contains the new Next.js pages and Route Handlers, while `frontend/` still hosts the existing fund workspace UI reused inside the new app shell.

## Features

- Next.js App Router shell: public landing page, `/app` workspace, fund detail route, portfolio route, pricing page, and settings page are now in place.
- Market overview: reads major China indices through Eastmoney push2 with Tencent quote fallback.
- Real fund search: searches public fund data by code or name, with built-in fallback samples.
- Fund detail: prefers Tiantian Fund intraday estimate and keeps the latest official net value.
- Local portfolio: calculates market value, cost, profit/loss, return rate, and position weight in the browser.
- Watchlist: tracks followed funds without counting them as holdings.
- Supabase foundation: browser/server helpers, normalized request session helpers, Next middleware, and the paired `supabase/migrations/202605300001_core_schema.sql` plus `supabase/migrations/202605300002_billing_customers.sql` schema migrations are now included; `/api/portfolio/default` now maps request sessions to signed-in user portfolios and only falls back to the anonymous default deliberately.
- Stripe billing: `/api/billing/checkout` now writes `supabaseUserId` into both Checkout Session and Subscription metadata, only accepts server-configured `STRIPE_PRICE_ID` / `STRIPE_PRICE_PRO_MONTHLY` values or the optional `STRIPE_ALLOWED_PRICE_IDS` allowlist, and stores webhook subscription state in `billing_customers`.
- Auth entry: the frontend now uses Supabase email login wording and client flow; legacy Cloudflare OTP endpoints remain in `backend/` for compatibility during migration.
- DeepSeek analysis: computes deterministic return, drawdown, momentum, volatility, and trend indicators before calling `deepseek-v4-flash`, then renders structured trend, risk, scenario, and watch-point reports. When `DEEPSEEK_API_KEY` is missing the API automatically returns a deterministic local report (`agent.model: "local-fallback"`) with the same shape, so the UI stays fully usable offline.
- Cloudflare-first deployment: Next Route Handlers are kept edge-friendly and resolve bindings such as `GG_FUND_DB` through `wrangler.jsonc` and the OpenNext Cloudflare runtime context.
- Privacy-first: Supabase service role and DeepSeek secrets stay server-only.

## Project Structure

- `app/`: Next.js App Router pages and `app/api/*` Route Handlers.
- `components/workspace/FundWorkspace.tsx`: reused fund workspace mounted inside Next.js.
- `features/market`, `features/portfolio`, `features/auth`, `features/ai`: migration service modules.
- `lib/`: environment, HTTP, and Supabase helpers.
- `frontend/src/`: existing React workspace, styling, local portfolio logic, and API client.
- `backend/api.ts`: existing Cloudflare Pages Functions business API kept for compatibility.
- `shared/`: shared DTOs, market data adapters, and tests.
- `migrations/`: existing Cloudflare D1 migrations.
- `supabase/migrations/`: new Supabase Postgres schema migrations.
- `scripts/`: CI, deployment, and verification scripts.

## Tech Stack

- Next.js App Router + React + TypeScript
- Transitional compatibility with the React + Vite workspace
- Tailwind CSS v4 + Radix UI style components
- Cloudflare Pages / OpenNext Cloudflare
- Supabase SSR helpers + Supabase Auth / Postgres foundation
- Eastmoney / Tencent / Tiantian Fund public data sources
- DeepSeek v4 Flash server-side analysis
- ESLint + TypeScript checks
- Vitest unit, component, service-layer, and market adapter tests
- Vitest coverage thresholds: statements 70%, branches 60%, functions 70%, lines 70%
- Apache ECharts market and fund research charts with range controls, return, drawdown, zoom, and tooltip support
- Playwright E2E and Midscene test skeleton

## Local Development

```bash
bun install
bun run dev
```

Open `http://127.0.0.1:3000` for the Next.js app.

To keep using the legacy Vite workspace and local API pair during migration:

```bash
bun run dev:api
bun run dev:web
```

## Environment Variables

Public browser variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Server variables:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEEPSEEK_API_KEY=your-deepseek-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
STRIPE_PRICE_ID=price_monthly_default
STRIPE_ALLOWED_PRICE_IDS=price_monthly_default,price_annual_optional
```

## Quality Gates

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

Install the repository Git hook:

```bash
bun run precommit:install
```

The new focused tests cover env helpers, HTTP helpers, Supabase helpers, request session normalization, market services, portfolio repository/local storage, and AI analysis services.

## Cloudflare Secrets

Never commit API keys, OAuth secrets, or provider credentials. Configure secrets in Cloudflare Pages and your Next/OpenNext deployment environment.

## Cloudflare Deployment

After Cloudflare login, binding setup, and secret configuration:

```bash
bun run deploy:cloudflare
bun run verify:cloudflare
```

Current default smoke endpoints:

- `GET /api/health`
- `GET /api/market/indices`
- `GET /api/funds/000001`

## Next API

- `GET /api/health`
- `GET /api/market/indices`
- `GET /api/funds/search?q=消费`
- `GET /api/funds/:code`
- `GET /api/funds/:code/history?range=1m|3m|6m|1y|all`
- `GET /api/funds/trending`
- `GET /api/portfolio/default`
- `POST /api/ai/analyze-fund`

## Disclaimer

The data and AI analysis in this project are for learning and reference only. They do not constitute investment advice, return promises, or trading instructions.

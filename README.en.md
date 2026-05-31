# GG Fund China Fund Market Dashboard

Chinese version: [README.md](./README.md)

GG Fund now uses a Cloudflare-first Next.js App Router architecture as its main application surface. `app/` contains pages and Route Handlers, the root path `/` redirects directly to the `/app` workspace, `components/workspace/FundWorkspace.tsx` mounts the reusable workspace entry, OpenNext builds the Cloudflare Worker output, and focused server responsibilities live in `features/*` and `lib/*`.

## Features

- Next.js App Router workspace: the root path `/` redirects directly to the `/app` workspace, `/settings` is available today, and `/app/portfolio` currently serves as a landing page while local-first holdings and watchlist stay in the main workspace.
- Tool Universe: reorganizes common stock/fund website capabilities into a browsable map for quotes, screening, comparison, diagnostics, accounts, news, disclosures, and open-source quant research.
- Multi-asset navigation: A-share indices and fund NAVs are live; ETF / LOF, REITs, bonds and convertible bonds, new bonds / newly issued funds, and global market watch are labeled as connectable or roadmap capabilities.
- Fund research tools: fund discovery, diagnostics, local holdings, watchlist, and AI research summaries are live today; fund comparison, ETF / LOF topics, and recurring investment paths are explicitly marked as connectable.
- Research sources and disclosures: separates Eastmoney/10jqka/Tiantian-style market data, Howbuy-style fund screening and diagnostics, Snowball-style community opinions, and exchange official disclosures into explicit content layers.
- Open research stack roadmap: AKShare / AKTools, Qlib, Tushare, Backtrader, Pyfolio, and Streamlit are documented as inspiration for data ingestion, quant research, backtesting, portfolio attribution, and dashboards.
- Market overview: reads SSE Composite, SZSE Component, ChiNext, and CSI 300 from Eastmoney push2 with Tencent quote fallback.
- Real fund search: searches public fund data by code or name, with built-in fallback samples when upstream APIs fail.
- Fund details: prefers Tiantian intraday estimated NAV, estimated change, and estimate time while keeping the previous official NAV.
- Beginner decision map: explains fund type, NAV, market temperature, holding status, risk level, single-fund concentration, and monthly review paths.
- Local portfolio: calculates market value, cost, profit/loss, return rate, and weights after adding funds.
- Watchlist: follows funds without counting them as holdings.
- Supabase foundation: browser/server helpers, normalized request sessions, Next middleware, and the core Supabase schema migration; `/api/portfolio/default` prefers the signed-in user's portfolio.
- DeepSeek analysis: computes deterministic return, drawdown, momentum, and volatility indicators before calling `deepseek-v4-flash`; falls back to a local deterministic report when `DEEPSEEK_API_KEY` is missing.
- Cloudflare Worker deployment: Next Route Handlers are built by OpenNext into the Worker runtime with `GG_FUND_DB` and `GG_FUND_CACHE` bindings.

## Project Structure

- `app/`: Next.js App Router pages and `app/api/*` Route Handlers.
- `components/workspace/FundWorkspace.tsx`: Next workspace entry.
- `features/market`, `features/portfolio`, `features/auth`, `features/ai`, `features/email`: service modules.
- `lib/`: environment, HTTP, and Supabase runtime helpers.
- `frontend/src/`: React components, styles, and browser-side logic still reused by Next; no longer a standalone Vite app entry.
- `shared/`: shared DTOs, market adapters, and tests.
- `migrations/`: Cloudflare D1 migrations.
- `supabase/migrations/`: Supabase Postgres schema migrations.
- `scripts/`: CI, deployment, and verification scripts.

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4 + Radix UI + shadcn/ui-style components
- Supabase Auth + Supabase Postgres + RLS
- Resend transactional email
- OpenNext Cloudflare Workers deployment
- Eastmoney / Tencent / Tiantian Fund public APIs + fallback sample market data
- DeepSeek v4 Flash server-side analysis
- ESLint + strict TypeScript checks
- Vitest + Playwright E2E

## Local Development

```bash
bun install
cp .env.example .env.local
bun run dev
```

Open `http://127.0.0.1:3000`.

## Environment Variables

Public browser-safe values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Server values:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=re_your_key
AUTH_EMAIL_FROM="GG Fund <onboarding@resend.dev>"
DEEPSEEK_API_KEY=your-deepseek-api-key
```

## Testing

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

`bun run test:e2e` runs both the Next core smoke spec and the fund workspace flow in `tests/fund-flow.spec.ts`.

For Midscene:

```bash
bun run test:midscene
```

For CI-parity locally:

```bash
bun run ci:test
```

## Cloudflare Deployment

After configuring Cloudflare login, bindings, and secrets:

```bash
bun run deploy:cloudflare
bun run verify:cloudflare
```

`bun run deploy:cloudflare` now runs `bun run build`, builds the OpenNext worker, applies remote D1 migrations, and publishes the Worker through `bunx wrangler deploy --config wrangler.jsonc --name "$CF_WORKER_NAME"`. The defaults are:

- `CF_WORKER_NAME=gg-fund`
- `CF_D1_DATABASE=gg-fund-db`
- `CF_VERIFY_BASE_URL` falls back to `https://$CF_WORKER_NAME.workers.dev` when unset

GitHub Actions deployments must provide these public build-time values as repository Variables so OpenNext can inject browser config during the build:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

CI dependency installation runs `npm ci --include=optional --ignore-scripts` through `scripts/ci-install.sh`, with the Linux `workerd`, esbuild, Lightning CSS, Tailwind Oxide, and ast-grep packages pinned in root-level `optionalDependencies` so the runner installs binaries required by OpenNext / Wrangler / CSS builds.

Default smoke endpoints:

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

## Capability Status

GG Fund uses three explicit status labels:

- `Live`: real API or local product capability is available today, such as A-share indices, fund NAVs, fund discovery/search, diagnostics, history, local holdings, watchlist, AI analysis, import, and export.
- `Connectable`: the product shape is defined and can be wired to real data or stronger algorithms later, such as ETF / LOF topics, fund comparison, recurring investment plans, and AKShare / AKTools data infrastructure.
- `Roadmap`: shown as the reconstructed product direction, not as a live production claim, such as REITs, convertible bonds, issuance calendars, official disclosure aggregation, community opinions, Qlib backtesting, and portfolio optimization.

All displayed data and AI analysis are for learning and reference only and are not investment advice.

## Disclaimer

The data and AI analysis in this project are for learning and reference only. They do not constitute investment advice, return promises, or trading instructions.

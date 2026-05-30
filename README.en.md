# GG Fund China Fund Market Dashboard

Chinese version: [README.md](./README.md)

GG Fund now uses a Cloudflare-first Next.js App Router architecture as its main application surface. `app/` contains pages and Route Handlers, the root path `/` redirects directly to the `/app` workspace, `components/workspace/FundWorkspace.tsx` mounts the reusable workspace entry, OpenNext builds the Cloudflare Worker output, and focused server responsibilities live in `features/*` and `lib/*`.

## Features

- Next.js App Router pages with the root path entering the `/app` workspace directly, plus fund detail, portfolio, and settings pages.
- Market overview via Eastmoney push2 with Tencent fallback for major China indices.
- Real fund search by code or name, with built-in fallback samples when upstreams fail.
- Fund detail that prefers Tiantian Fund intraday estimate data while keeping the latest official net value.
- Local portfolio calculations for market value, cost basis, profit/loss, return rate, and allocation weight.
- Watchlist management without counting items as holdings.
- Supabase foundation with browser/server helpers, normalized request session handling, Next middleware, and `supabase/migrations/202605300001_core_schema.sql`.
- DeepSeek analysis that computes deterministic indicators before calling `deepseek-v4-flash`, with an automatic local fallback when `DEEPSEEK_API_KEY` is missing.
- Cloudflare Worker deployment with edge-compatible Route Handlers, OpenNext output, and bindings such as `GG_FUND_DB` and `GG_FUND_CACHE` configured via `wrangler.jsonc`.

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
- `CF_D1_MIGRATIONS_DIR=migrations`
- `CF_VERIFY_BASE_URL` falls back to `https://$CF_WORKER_NAME.workers.dev` when unset

GitHub Actions deployments must provide these public build-time values as repository Variables so OpenNext can inject browser config during the build:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

CI dependency installation runs `npm ci --include=optional --ignore-scripts` through `scripts/ci-install.sh` so the Linux runner installs the `workerd` platform binary required by OpenNext / Wrangler.

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

## Disclaimer

The data and AI analysis in this project are for learning and reference only. They do not constitute investment advice, return promises, or trading instructions.

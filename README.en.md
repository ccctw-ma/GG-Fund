# GG Fund China Fund Market Dashboard

Chinese version: [README.md](./README.md)

GG Fund now uses a Cloudflare-first Next.js App Router architecture as its main application surface. `app/` contains pages and Route Handlers, `components/workspace/FundWorkspace.tsx` mounts the reusable workspace entry, OpenNext builds the Cloudflare Worker output, and focused server responsibilities live in `features/*` and `lib/*`.

## Features

- Next.js App Router pages for the public landing page, `/app` workspace, fund detail route, portfolio page, pricing page, and settings page.
- Market overview via Eastmoney push2 with Tencent fallback for major China indices.
- Real fund search by code or name, with built-in fallback samples when upstreams fail.
- Fund detail that prefers Tiantian Fund intraday estimate data while keeping the latest official net value.
- Local portfolio calculations for market value, cost basis, profit/loss, return rate, and allocation weight.
- Watchlist management without counting items as holdings.
- Supabase foundation with browser/server helpers, normalized request session handling, Next middleware, and the paired `supabase/migrations/202605300001_core_schema.sql` plus `supabase/migrations/202605300002_billing_customers.sql` migrations.
- Stripe billing with Checkout Session and Subscription metadata tied to `supabaseUserId`, plus server-side price allowlisting.
- DeepSeek analysis that computes deterministic indicators before calling `deepseek-v4-flash`, with an automatic local fallback when `DEEPSEEK_API_KEY` is missing.
- Cloudflare Worker deployment with edge-compatible Route Handlers, OpenNext output, and bindings such as `GG_FUND_DB` and `GG_FUND_CACHE` configured via `wrangler.jsonc`.
- Privacy-first handling for Supabase service role keys, Stripe secrets, Resend keys, PostHog private keys, and DeepSeek credentials.

## Project Structure

- `app/`: Next.js App Router pages and `app/api/*` Route Handlers.
- `components/workspace/FundWorkspace.tsx`: Next workspace entry.
- `features/market`, `features/portfolio`, `features/auth`, `features/ai`, `features/billing`, `features/email`, `features/analytics`: service modules.
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
- Stripe Checkout/Webhook subscription foundation
- Resend transactional email
- PostHog product analytics
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
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Server values:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
STRIPE_PRICE_ID=price_monthly_default
STRIPE_PRICE_PRO_MONTHLY=price_monthly_default
STRIPE_ALLOWED_PRICE_IDS=price_monthly_default,price_annual_optional
RESEND_API_KEY=re_your_key
AUTH_EMAIL_FROM="GG Fund <login@example.com>"
DEEPSEEK_API_KEY=your-deepseek-api-key
POSTHOG_API_KEY=phx_your_private_key
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
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`

## Disclaimer

The data and AI analysis in this project are for learning and reference only. They do not constitute investment advice, return promises, or trading instructions.

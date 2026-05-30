# GG-Fund Cloudflare-first Next.js Architecture Refactor Design

Date: 2026-05-30

## Decision policy

When a product or technical decision is needed during this refactor, use the first/recommended option by default and continue. Do not stop for user selection unless the user explicitly interrupts with a different direction.

## Context

GG-Fund is currently a React + Vite + TypeScript application with a Cloudflare Pages Functions backend. The existing runtime already aligns with a Cloudflare-first mindset: API logic is centralized in `backend/api.ts`, Cloudflare D1 stores portfolios and custom auth data, KV caches fund quotes, and `wrangler.toml` deploys static `dist/` assets plus Pages Functions.

The target independent-developer stack is:

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase for Auth and primary database
- Stripe for subscriptions/payments
- Resend for product email
- PostHog for product analytics
- Cloudflare-first deployment

The main architectural shift is not only a tooling change from Vite to Next.js. It changes routing, server boundaries, authentication, persistence, deployment, and productization capabilities.

## Chosen approach

Use an incremental but decisive migration to Next.js App Router while preserving Cloudflare-first deployment as a hard constraint.

Rejected alternatives:

1. Keep Vite and only add Supabase/Stripe/Resend/PostHog. This is lower risk but does not achieve the requested architecture.
2. Split content into Astro and application into Next.js. This is useful for a content-heavy product, but GG-Fund is currently an app/SaaS/AI product, so the split is premature.

## Goals

- Move the app shell to Next.js App Router.
- Keep TypeScript strictness and shared DTOs.
- Use Tailwind and shadcn/ui as the long-term UI foundation.
- Replace custom auth/session tables with Supabase Auth.
- Move canonical user portfolio/watchlist data to Supabase Postgres with RLS.
- Keep market data and AI provider calls server-side.
- Add Stripe, Resend, and PostHog behind clear integration modules.
- Keep deployment and runtime Cloudflare-first.
- Update repository documentation and validation scripts with the new architecture.

## Non-goals

- Do not build a separate Astro site in this refactor.
- Do not keep D1 as the canonical authenticated user database after Supabase is introduced.
- Do not expose DeepSeek, Stripe, Supabase service role, Resend, or other secrets to the browser.
- Do not implement every future paid feature before the billing foundation exists.
- Do not rewrite working market-data parsing logic unless the Next.js server boundary requires it.

## Target repository structure

```text
app/
  layout.tsx
  page.tsx
  app/
    page.tsx
    funds/[code]/page.tsx
    portfolio/page.tsx
  pricing/page.tsx
  settings/page.tsx
  api/
    health/route.ts
    market/indices/route.ts
    funds/search/route.ts
    funds/[code]/route.ts
    funds/[code]/history/route.ts
    funds/trending/route.ts
    portfolio/default/route.ts
    ai/analyze-fund/route.ts
    billing/checkout/route.ts
    billing/webhook/route.ts
components/
  ui/
  layout/
  fund/
  portfolio/
  auth/
features/
  market/
  portfolio/
  auth/
  ai/
  billing/
  email/
  analytics/
lib/
  supabase/
  stripe.ts
  resend.ts
  posthog.ts
  runtime.ts
shared/
  types.ts
  marketData.ts
supabase/
  migrations/
  seed.sql
docs/
  deployment.md
  architecture.md
```

This structure keeps the Next.js routes thin and pushes domain logic into `features/*` modules. The `shared/*` directory remains the place for DTOs, deterministic calculations, and market adapters that are safe to use from server code and tests.

## Application routes

- `/`: public product landing page, explanation of GG-Fund, CTA to app, login entry.
- `/app`: authenticated or local-first workspace dashboard.
- `/app/funds/[code]`: fund detail, history, AI analysis, watch/holding actions.
- `/app/portfolio`: holdings, watchlist, summary, import/export.
- `/pricing`: Stripe subscription plans.
- `/settings`: account, data migration, notification preferences, export/delete actions.

The initial migration can keep most existing UI behavior in `/app`, then split pages once the Next.js shell is stable.

## Server/API design

Next.js Route Handlers replace the current Pages Functions route switch. Each route delegates to a feature service:

- `features/market`: index quotes, fund search, fund detail, history, trending funds.
- `features/ai`: DeepSeek analysis orchestration and local deterministic fallback.
- `features/portfolio`: portfolio CRUD, holdings, watchlist, import/sync.
- `features/billing`: Stripe checkout, customer portal, webhook handling.
- `features/email`: Resend transactional email.
- `features/analytics`: PostHog server-side capture where needed.

Route handlers must remain Cloudflare-compatible. Avoid Node-only APIs unless the chosen Cloudflare Next adapter explicitly supports them. Stripe webhook verification must preserve raw request body semantics.

## Authentication and data model

Supabase Auth becomes the source of truth for identity.

Recommended Supabase tables:

- `profiles`
  - `id uuid primary key references auth.users(id)`
  - `email text`
  - `display_name text`
  - `created_at timestamptz`
  - `updated_at timestamptz`
- `portfolios`
  - `id uuid primary key`
  - `user_id uuid references auth.users(id)`
  - `name text`
  - timestamps
- `holdings`
  - `id uuid primary key`
  - `portfolio_id uuid references portfolios(id)`
  - `user_id uuid references auth.users(id)`
  - `fund_code text`
  - `fund_name text`
  - `shares numeric`
  - `cost_amount numeric`
  - `purchase_date date null`
  - `note text null`
  - timestamps
  - unique per `portfolio_id, fund_code`
- `watchlist`
  - `portfolio_id uuid references portfolios(id)`
  - `user_id uuid references auth.users(id)`
  - `fund_code text`
  - `fund_name text`
  - `created_at timestamptz`
  - primary key per `portfolio_id, fund_code`
- `billing_customers`
  - `user_id uuid primary key references auth.users(id)`
  - `stripe_customer_id text unique`
  - `status text`
  - `price_id text null`
  - timestamps

RLS must enforce that users can only read/write rows where `user_id = auth.uid()` or where the parent portfolio belongs to `auth.uid()`.

The existing browser local-first data remains as anonymous-mode storage and migration input. Once a user signs in, the app should offer/import local holdings into Supabase and then treat Supabase as canonical.

## Cloudflare deployment design

Cloudflare remains the deployment default.

- Use the Next.js Cloudflare adapter selected during implementation planning.
- Keep route handlers and service modules edge-compatible.
- Replace `pages_build_output_dir = "dist"` with the adapter output directory required by the selected Cloudflare integration.
- Keep `wrangler.toml` as the Cloudflare deployment source of truth.
- Keep Cloudflare secrets for server-side keys.
- Keep KV as the preferred short-lived market quote cache if the adapter supports bindings cleanly; otherwise hide cache access behind `features/market/cache` so a fallback HTTP/Supabase cache can be used without changing route handlers.

Environment variables:

Public browser variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

Server secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`
- `DEEPSEEK_API_KEY`
- Optional OAuth/provider keys handled by Supabase provider configuration where possible.

## UI design system

Tailwind remains the styling layer. shadcn/ui becomes the component baseline.

- Keep the current “financial glass card” brand direction as a theme layer.
- Move reusable primitives to `components/ui`.
- Move feature-specific components to `components/fund`, `components/portfolio`, `components/auth`, and `components/layout`.
- Reduce large bespoke CSS classes over time. Prefer Tailwind utilities, CSS variables, and small component-local class composition.
- Keep accessibility behavior from Radix/shadcn patterns.

## Analytics design

PostHog is added with minimal but useful events:

- app opened
- fund searched
- fund viewed
- holding added
- watchlist toggled
- AI analysis requested
- sign-in completed
- checkout started
- subscription status changed

Client analytics must not include secrets or sensitive holdings details beyond safe product events. Server analytics should be centralized in `features/analytics`.

## Billing design

Stripe integration starts with subscription foundations:

- `/pricing` displays plans.
- `/api/billing/checkout` creates a Checkout Session for the signed-in Supabase user.
- `/api/billing/webhook` verifies Stripe webhook signatures and upserts subscription status into `billing_customers`.
- Future premium gates can read subscription state from Supabase.

The first implementation does not need a complex entitlement engine; a small `getSubscriptionStatus(userId)` service is enough.

## Email design

Resend handles product transactional email. Supabase Auth handles auth email where possible. Resend is used for non-auth product communication such as onboarding, billing notices that are not Stripe-managed, or future alerts.

React Email may be added when templates become complex, but the first pass can keep simple template functions in `features/email`.

## Testing and validation

Maintain or replace current validation gates with Next-compatible equivalents:

- Typecheck
- ESLint
- Unit tests for market data, portfolio calculations, AI normalization, Supabase repository logic, Stripe webhook handling
- Coverage thresholds, adjusted only when the migration has equivalent meaningful tests
- Playwright E2E for core flows:
  - landing page loads
  - fund search works
  - fund details/history render
  - local holding can be added
  - Supabase auth happy path can be mocked or run in a configured environment
  - AI fallback works without `DEEPSEEK_API_KEY`

Cloudflare deploy verification should still check:

- `/api/health`
- `/api/market/indices`
- `/api/funds/000001`
- app landing page

## Migration phases

1. Create Next.js App Router skeleton with TypeScript, Tailwind, shadcn/ui, and Cloudflare build target.
2. Port shared DTOs, market adapters, portfolio calculation, and AI normalization into the new structure.
3. Port current UI into Next pages, initially preserving user-visible behavior.
4. Replace custom auth with Supabase Auth client/server helpers.
5. Add Supabase schema and RLS for profiles, portfolios, holdings, watchlist, and billing status.
6. Move logged-in portfolio/watchlist writes to Supabase while retaining local anonymous mode and import/export.
7. Add Stripe checkout and webhook foundation.
8. Add Resend product email module.
9. Add PostHog client/server analytics.
10. Update Cloudflare deployment scripts, GitHub workflow, README, README.en, AGENTS, and deployment docs.
11. Run and fix validation: lint, tests, coverage, build, E2E, and Cloudflare smoke checks where credentials are available.

## Risks and mitigations

- Cloudflare + Next.js adapter constraints: decide adapter first in implementation planning, then keep routes edge-compatible.
- Auth migration complexity: do not support two authenticated sources of truth long-term; Supabase wins.
- Portfolio data migration: preserve export/import and anonymous local mode so existing users are not blocked.
- Stripe webhook raw body handling: write focused tests before relying on production webhooks.
- Large UI rewrite risk: port behavior first, then polish design system incrementally.
- Dependency drift: replace broad `latest` dependency pins with explicit versions during migration.

## Acceptance criteria

The refactor is complete when:

- The app runs as a Next.js App Router project.
- Cloudflare is the documented and working deployment path.
- Supabase Auth and Postgres are integrated for signed-in users.
- Portfolio/watchlist data has a server-backed Supabase path with RLS.
- Market data and DeepSeek remain server-only.
- Stripe checkout/webhook foundation exists.
- Resend email module exists.
- PostHog instrumentation exists for core events.
- README, README.en, deployment docs, scripts, and tests match the new architecture.
- Required validation commands are run and reported.

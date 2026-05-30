# Remove Stripe Runtime Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Stripe product/runtime functionality while preserving already-created Supabase migration history.

**Architecture:** Treat Stripe as a retired integration: remove its SDK dependency, helper module, billing API routes, pricing page, user-facing links, active tests, and deployment documentation. Preserve `supabase/migrations/202605300002_billing_customers.sql` because historical migrations may already be applied in deployed environments.

**Tech Stack:** Next.js App Router, TypeScript, Bun, Vitest, Playwright, Supabase migrations, Cloudflare/OpenNext docs.

---

## File Structure

- Delete `features/billing/stripe.ts`: central Stripe SDK/helper module, no replacement.
- Delete `app/api/billing/checkout/route.ts`: checkout endpoint is removed.
- Delete `app/api/billing/webhook/route.ts`: webhook endpoint is removed.
- Delete `app/pricing/page.tsx`: pricing/checkout page is removed.
- Modify `app/page.tsx`: remove `/pricing` CTA and keep `/app` as the primary action.
- Modify `middleware.ts`: remove `/pricing` from `PUBLIC_PATHS`.
- Modify `package.json` and `bun.lock`: remove `stripe` dependency and lockfile entries via `bun remove stripe`.
- Modify `.env.example`: remove all `STRIPE_*` variables.
- Delete `tests/features/billing.stripe.test.ts`: Stripe helper tests removed with helper.
- Delete `tests/billing-api-routes.test.ts`: checkout/webhook route tests removed with routes.
- Modify `tests/supabase-core-schema.test.ts`: preserve migration-exists checks but remove current-feature assertions that describe Stripe as active functionality.
- Modify `tests/midscene-fund-flow.test.ts`: remove natural-language expectation for pricing link.
- Modify `README.md`, `README.en.md`, `docs/deployment.md`, `AGENTS.md`: remove Stripe runtime/API/env/deployment instructions.
- Preserve `supabase/migrations/202605300002_billing_customers.sql`: no changes to historical migration.

---

### Task 1: Add tests that assert Stripe runtime is absent

**Files:**
- Modify: `tests/middleware.test.ts`
- Modify: `tests/supabase-core-schema.test.ts`
- Modify: `tests/midscene-fund-flow.test.ts`

- [ ] **Step 1: Add a middleware assertion for removed pricing route**

In `tests/middleware.test.ts`, extend the public route test to make `/pricing` absence explicit:

```ts
it('does not keep the retired pricing route in the explicit public path list', () => {
  const response = middleware({ nextUrl: { pathname: '/pricing' } } as never);

  expect(response).toBeInstanceOf(Response);
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(config).toEqual({
    matcher: ['/app/:path*', '/api/:path*'],
  });
});
```

Because current middleware returns `NextResponse.next()` for all paths, this test documents that `/pricing` is not a configured matcher/public-path requirement after removal.

- [ ] **Step 2: Update Supabase schema tests for historical migration only**

In `tests/supabase-core-schema.test.ts`, keep these assertions:

```ts
expect(migrationFiles).toContain('202605300002_billing_customers.sql');
expect(coreSchemaSql).not.toMatch(/billing_customers/);
expect(billingCustomersSql).toMatch(/create table if not exists public\.billing_customers\s*\(/);
```

Remove the test named `stores Stripe customer status with owner-only read access in an idempotent follow-up migration`. The migration remains, but the product should no longer describe Stripe billing as active runtime behavior.

- [ ] **Step 3: Update Midscene natural-language expectation**

Change the final `agent.aiAct` in `tests/midscene-fund-flow.test.ts` to:

```ts
await agent.aiAct('verify the page shows the Chinese GG Fund landing page and workspace entry, including the main heading, workspace link, and access to the fund workspace');
```

- [ ] **Step 4: Run targeted tests and observe current failures**

Run:

```bash
bun test tests/middleware.test.ts tests/supabase-core-schema.test.ts tests/midscene-fund-flow.test.ts
```

Expected: failures may occur until implementation/docs cleanup is complete; no TypeScript import errors should be introduced by these edits.

---

### Task 2: Remove Stripe runtime code and dependency

**Files:**
- Delete: `features/billing/stripe.ts`
- Delete: `app/api/billing/checkout/route.ts`
- Delete: `app/api/billing/webhook/route.ts`
- Delete: `app/pricing/page.tsx`
- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Remove the Stripe package**

Run:

```bash
bun remove stripe
```

Expected: `package.json` no longer contains `"stripe"`, and `bun.lock` no longer contains Stripe package resolution entries.

- [ ] **Step 2: Delete runtime files**

Remove these files:

```bash
rm features/billing/stripe.ts
rm app/api/billing/checkout/route.ts
rm app/api/billing/webhook/route.ts
rm app/pricing/page.tsx
```

Expected: these paths no longer exist.

- [ ] **Step 3: Run typecheck to find dangling imports**

Run:

```bash
bun run typecheck
```

Expected before dependent cleanup: any failures should identify remaining imports of deleted Stripe files/routes. Fix those in later tasks.

---

### Task 3: Remove user-facing pricing entry points

**Files:**
- Modify: `app/page.tsx`
- Modify: `middleware.ts`

- [ ] **Step 1: Remove pricing CTA from homepage**

Change the action block in `app/page.tsx` to only render the workspace link:

```tsx
<div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
  <Link href="/app" style={{ padding: '12px 18px', borderRadius: '999px', background: '#10251f', color: '#fbf1df', fontWeight: 700 }}>
    进入工作台
  </Link>
</div>
```

- [ ] **Step 2: Remove `/pricing` from public paths**

Change `middleware.ts` to:

```ts
const PUBLIC_PATHS = ['/', '/settings', '/api/health'];
```

- [ ] **Step 3: Run focused checks**

Run:

```bash
bun test tests/middleware.test.ts tests/midscene-fund-flow.test.ts
bun run typecheck
```

Expected: middleware and Midscene setup tests pass; typecheck has no references to deleted pricing/billing code.

---

### Task 4: Remove Stripe-specific tests

**Files:**
- Delete: `tests/features/billing.stripe.test.ts`
- Delete: `tests/billing-api-routes.test.ts`

- [ ] **Step 1: Delete obsolete tests**

Remove:

```bash
rm tests/features/billing.stripe.test.ts
rm tests/billing-api-routes.test.ts
```

- [ ] **Step 2: Run tests that previously referenced billing schema and middleware**

Run:

```bash
bun test tests/supabase-core-schema.test.ts tests/middleware.test.ts
```

Expected: pass.

---

### Task 5: Remove Stripe env and documentation references

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/deployment.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Remove Stripe env vars**

Change `.env.example` server section to:

```env
# Server secrets, configure in Cloudflare and local .env.local
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=re_your_key
AUTH_EMAIL_FROM="GG Fund <login@example.com>"
DEEPSEEK_API_KEY=your-deepseek-api-key
```

- [ ] **Step 2: Update `AGENTS.md` secrets guidance**

Change the generic secret warning to omit Stripe:

```md
Never commit API keys, tokens, OAuth secrets, Supabase service role keys, Resend keys, DeepSeek keys, or provider client secrets. Use Cloudflare secrets for server values and `NEXT_PUBLIC_*` only for browser-safe public keys.
```

Change required production secrets to:

```bash
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put AUTH_EMAIL_FROM
bunx wrangler secret put DEEPSEEK_API_KEY
```

- [ ] **Step 3: Update READMEs and deployment docs**

Remove active Stripe billing claims from `README.md`, `README.en.md`, and `docs/deployment.md`:

```md
- Do not list `/pricing` as a current page.
- Do not list `features/billing` as a current service module.
- Do not list `Stripe Checkout/Webhook` in the tech stack.
- Do not list `STRIPE_*` env vars.
- Do not list `POST /api/billing/checkout` or `POST /api/billing/webhook` as current APIs.
- Keep the historical Supabase migration reference only if it is framed as preserved migration history, not active billing functionality.
```

Use concrete wording matching each document's language. In Chinese docs, describe the app as including public home, `/app`, fund detail, portfolio, and settings pages. In English docs, mirror the same meaning.

- [ ] **Step 4: Search for active Stripe references**

Run:

```bash
rg -n "Stripe|stripe|STRIPE|billing/checkout|billing/webhook|/pricing|features/billing" . --glob '!node_modules/**' --glob '!.next/**' --glob '!coverage/**' --glob '!.claude/worktrees/**'
```

Expected: only preserved historical migration or historical superpowers plan/spec references may remain. Active runtime code, tests, env examples, and current docs should not advertise Stripe functionality.

---

### Task 6: Full verification

**Files:**
- No code changes unless verification reveals failures.

- [ ] **Step 1: Run lint**

```bash
bun run lint
```

Expected: pass.

- [ ] **Step 2: Run unit/API tests**

```bash
bun run test
```

Expected: pass.

- [ ] **Step 3: Run coverage**

```bash
bun run coverage
```

Expected: pass or meet existing coverage thresholds.

- [ ] **Step 4: Run build**

```bash
bun run build
```

Expected: pass; no unresolved module errors for deleted Stripe files.

- [ ] **Step 5: Run E2E**

```bash
bun run test:e2e
```

Expected: pass.

- [ ] **Step 6: Final grep audit**

```bash
rg -n "Stripe|stripe|STRIPE|billing/checkout|billing/webhook|/pricing|features/billing" . --glob '!node_modules/**' --glob '!.next/**' --glob '!coverage/**' --glob '!.claude/worktrees/**'
```

Expected: no active runtime/product references. It is acceptable for `supabase/migrations/202605300002_billing_customers.sql` and historical `docs/superpowers/*` files to mention Stripe because option A preserves migration and project history.

---

## Self-Review

- Spec coverage: Option A is covered: runtime, UI, dependency, env, tests, and current docs are removed; historical Supabase migration is preserved.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain. Documentation edits specify exact removals and expected wording constraints.
- Type consistency: Deleted routes/helpers have no replacement API. Remaining tests only reference existing middleware, migrations, and Midscene setup.

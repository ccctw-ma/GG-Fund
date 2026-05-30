# Agent Instructions

## Documentation discipline

Every functional change must update repository documentation in the same branch:

- Update `README.md` when scripts, APIs, deployment, auth, data sources, AI features, or user-facing behavior changes.
- Update `README.en.md` whenever `README.md` changes in a way that affects users or contributors.
- Update `AGENTS.md` when contributor/agent workflow expectations change.
- Update Cloudflare deployment notes when Worker bindings, KV, D1, secrets, migrations, or Wrangler/OpenNext commands change.

## Testing discipline

Before reporting work as complete, run and report:

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

When Midscene behavior changes, also run:

```bash
bun run test:midscene
```

For full local parity with CI, run:

```bash
bun run ci:test
```

Before committing, install the repository hook once:

```bash
bun run precommit:install
```

The hook runs `bun run lint` and `bun run test`.

For Cloudflare changes, also verify deployed endpoints after deployment:

```bash
curl https://gg-fund.workers.dev/api/health
curl https://gg-fund.workers.dev/api/market/indices
curl https://gg-fund.workers.dev/api/funds/000001
```

## Secrets

Never commit API keys, tokens, OAuth secrets, Supabase service role keys, Resend keys, PostHog private keys, DeepSeek credentials, auth mailer secrets, or provider client secrets. Use Cloudflare secrets for server values and `NEXT_PUBLIC_*` only for browser-safe public keys.

Required server secrets for production:

```bash
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put AUTH_EMAIL_FROM
bunx wrangler secret put DEEPSEEK_API_KEY
bunx wrangler secret put POSTHOG_API_KEY
```

If a secret appears in chat, logs, screenshots, or git history, treat it as leaked and rotate it before using it in production.

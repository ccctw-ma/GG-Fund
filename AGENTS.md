# Agent Instructions

## Documentation discipline

Every functional change must update repository documentation in the same branch:

- Update `README.md` when scripts, APIs, deployment, auth, data sources, AI features, or user-facing behavior changes.
- Update `AGENTS.md` when contributor/agent workflow expectations change.
- Update Cloudflare deployment notes when D1, KV, Pages Functions, secrets, migrations, or Wrangler commands change.

## Testing discipline

Before reporting work as complete, run and report:

```bash
bun run test
bun run build
bun run test:e2e
```

For Cloudflare changes, also verify deployed endpoints after deployment:

```bash
curl https://gg-fund.pages.dev/api/health
curl https://gg-fund.pages.dev/api/market/indices
curl https://gg-fund.pages.dev/api/funds/000001
```

## Secrets

Never commit API keys, tokens, OAuth secrets, phone/SMS credentials, or provider client secrets. Use Cloudflare secrets:

```bash
bunx wrangler@3 pages secret put DEEPSEEK_API_KEY --project-name gg-fund
```

If a secret appears in chat, logs, screenshots, or git history, treat it as leaked and rotate it before using it in production.

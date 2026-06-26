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

`bun run coverage` is a hard gate: Statements, Branches, Functions, and Lines must all be at least 90% within the configured unit-coverage scope. Large UI orchestration, route glue, and external market-adapter files excluded from the unit gate must remain covered by focused tests and the E2E suite; do not report work complete if the 90% coverage gate fails.

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

After pushing to `master`, always observe the GitHub Actions deployment before reporting the work as complete:

```bash
npm run actions:list
npm run actions:watch -- <run-id>
```

Do not call `gh run ...` directly in this devbox. `/usr/local/bin/gh` is an internal host lookup tool, not GitHub CLI. This repository provides `scripts/github-actions.js` and npm wrappers so deployment observation is independent of the global `gh` binary. The script uses the public GitHub Actions API with a `User-Agent` header and supports `GH_TOKEN` / `GITHUB_TOKEN` for authenticated requests when anonymous API quota is exhausted:

```bash
GH_TOKEN=<token> npm run actions:list
GH_TOKEN=<token> npm run actions:watch -- <run-id>
```

The `Cloudflare Deploy` workflow's `Verify deployment` step runs `bun run verify:cloudflare` from GitHub-hosted infrastructure and is the authoritative production verification signal when local network access to `*.workers.dev` is blocked, DNS-poisoned, or routed to unreachable IPs. If local `curl` to the Workers URL fails, first check `getent hosts gg-fund.1934202608.workers.dev`; mappings such as `108.160.*` or `2001::/32` indicate local DNS/routing interception rather than a deployment failure.

If the deployment fails, fetch the failed job logs, fix code or configuration when possible, then commit, push, and repeat the observation loop until the deployment succeeds:

```bash
npm run actions:view -- <run-id>
```

If the failure requires account-level or secret-level configuration, stop and ask the user for the missing configuration instead of guessing. Current production verification base URL:

```bash
https://gg-fund.1934202608.workers.dev
```

After a successful Cloudflare deployment, verify the deployed endpoints:

```bash
curl https://gg-fund.1934202608.workers.dev/api/health
curl https://gg-fund.1934202608.workers.dev/api/market/indices
curl https://gg-fund.1934202608.workers.dev/api/funds/000001
```

## Secrets

Never commit API keys, tokens, OAuth secrets, Resend keys, Deepseek keys, auth mailer secrets, or provider client secrets. Use Cloudflare secrets for server values and `NEXT_PUBLIC_*` only for browser-safe public keys.

Required server secrets for production:

```bash
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put AUTH_EMAIL_FROM
bunx wrangler secret put DEEPSEEK_API_KEY
bunx wrangler secret put OCR_SPACE_API_KEY # optional, improves screenshot import OCR quota/stability
```

If a secret appears in chat, logs, screenshots, or git history, treat it as leaked and rotate it before using it in production.

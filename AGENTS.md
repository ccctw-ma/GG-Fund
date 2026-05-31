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

After pushing to `master`, always observe the GitHub Actions deployment before reporting the work as complete:

```bash
gh run list --repo ccctw-ma/GG-Fund --workflow cloudflare-deploy.yml --branch master --limit 5
gh run watch <run-id> --repo ccctw-ma/GG-Fund --exit-status
```

If the deployment fails, fetch the failed job logs, fix code or configuration when possible, then commit, push, and repeat the observation loop until the deployment succeeds:

```bash
gh run view <run-id> --repo ccctw-ma/GG-Fund --log-failed
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

Never commit API keys, tokens, OAuth secrets, Resend keys, auth mailer secrets, or provider client secrets. Use Cloudflare secrets for server values and `NEXT_PUBLIC_*` only for browser-safe public keys.

Required server secrets for production:

```bash
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put AUTH_EMAIL_FROM
```

If a secret appears in chat, logs, screenshots, or git history, treat it as leaked and rotate it before using it in production.

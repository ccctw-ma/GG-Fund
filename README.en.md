# GG Fund China Fund Market Dashboard

Chinese version: [README.md](./README.md)

GG Fund is a production-shaped China mutual fund market and portfolio analysis app. The repository is intentionally split by responsibility: `frontend/` contains the React + Vite web app, `backend/` contains the single business API implementation, root-level `functions/` only keeps the Cloudflare Pages Functions routing shim, and `shared/` contains DTOs plus market data adapters reused by both sides.

## Features

- Market overview: reads major China indices through Eastmoney push2 with Tencent quote fallback.
- Real fund search: searches public fund data by code or name, with built-in fallback samples.
- Fund detail: prefers Tiantian Fund intraday estimate and keeps the latest official net value.
- Local portfolio: calculates market value, cost, profit/loss, return rate, and position weight in the browser.
- Watchlist: tracks followed funds without counting them as holdings.
- Auth entry: email/phone OTP challenge + verify flow; GitHub/WeChat OAuth metadata.
- DeepSeek analysis: collects quote, history, and index context before calling `deepseek-v4-flash`.
- Cloudflare infrastructure: D1 for portfolio/auth data, KV for quote cache, Pages Functions for API.
- Privacy-first: secrets are injected through Cloudflare Secrets and never enter source code or the frontend bundle.

## Project Structure

- `frontend/src/`: React pages, components, local portfolio logic, and frontend API client.
- `backend/api.ts`: the single business API implementation reused by local dev and Cloudflare.
- `backend/local.ts`: Bun local adapter that injects in-memory D1/KV bindings.
- `functions/api/[[path]].ts`: Cloudflare Pages Functions entry shim that delegates to `backend/api.ts`.
- `shared/`: shared types, market data adapters, and tests.
- `migrations/`: Cloudflare D1 migrations.
- `scripts/`: CI test, Cloudflare deploy, and production verification scripts.

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS v4 + Radix UI style components
- Cloudflare Pages Functions + D1 + KV
- Bun local Functions adapter
- Eastmoney / Tencent / Tiantian Fund public data sources
- DeepSeek v4 Flash server-side analysis
- ESLint + TypeScript checks
- Vitest unit, component, Cloudflare API, and market adapter tests
- Vitest coverage thresholds: statements 70%, branches 60%, functions 70%, lines 70%
- Playwright E2E and Midscene test skeleton

## Local Development

```bash
bun install
bun run dev:api
bun run dev:web
```

Open `http://127.0.0.1:5173`.

You can also start both processes together:

```bash
bun run dev
```

The local API uses the same `backend/api.ts` implementation as production. `backend/local.ts` provides in-memory D1/KV bindings for local development and E2E tests.

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

The pre-commit hook runs:

```bash
bun run lint
bun run test
```

Run the complete local gate, including coverage:

```bash
bun run check
```

`bun run test:midscene` reads Midscene model settings from local `~/.zshrc`, starts the local API/Web servers, and verifies the Midscene + Playwright integration. To force a real `aiAct` model action, run:

```bash
MIDSCENE_RUN_AI=1 bun run test:midscene
```

## Cloudflare Secrets

Never commit API keys, OAuth secrets, or provider credentials. Configure secrets in Cloudflare Pages:

```bash
bunx wrangler@3 pages secret put DEEPSEEK_API_KEY --project-name gg-fund
```

If a key appears in chat, logs, screenshots, or git history, treat it as leaked, revoke it, and rotate it before production use.

## Cloudflare Deployment

After login, D1/KV binding setup, and Pages Secret configuration:

```bash
bun run ci:test
bun run deploy:cloudflare
bun run verify:cloudflare
```

`deploy:cloudflare` applies remote D1 migrations and deploys `dist/` to the Cloudflare Pages project `gg-fund`. Defaults can be overridden with `CF_PAGES_PROJECT`, `CF_PAGES_BRANCH`, `CF_D1_DATABASE`, and `CF_VERIFY_BASE_URL`.

GitHub Actions deploys automatically on push/merge to `master`. Configure repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## API

- `GET /api/health`
- `GET /api/market/indices`
- `GET /api/funds/search?q=消费`
- `GET /api/funds/:code`
- `GET /api/funds/:code/history?range=1m`
- `GET /api/funds/trending`
- `GET /api/portfolio/default`
- `POST /api/portfolio/default/holdings`
- `POST /api/portfolio/default/watchlist`
- `GET /api/auth/oauth-url?provider=github|wechat`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `POST /api/ai/analyze-fund`

## Disclaimer

The data and AI analysis in this project are for learning and reference only. They do not constitute investment advice, return promises, or trading instructions.

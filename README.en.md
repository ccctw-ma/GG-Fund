# GG Fund China Fund Market Dashboard

Chinese version: [README.md](./README.md)

GG Fund now uses a Cloudflare-first Next.js App Router architecture as its main application surface. `app/` contains pages and Route Handlers, the root path `/` redirects directly to the `/app` workspace, `components/workspace/FundWorkspace.tsx` mounts the reusable workspace entry, OpenNext builds the Cloudflare Worker output, and focused server responsibilities live in `features/*` and `lib/*`.

## Features

- Next.js App Router workspace: the root path `/` redirects directly to the `/app` workspace, `/login` provides a standalone email OTP sign-in page, `/settings` currently provides a basic information entry, and `/app/portfolio` currently serves as a landing page while local-first holdings and watchlist stay in the main workspace.
- Top navigation workspace: `/app` switches between Overview, Live Workspace, and Portfolio through a sticky top nav, with a compact account status card in the top-right corner; clicking the top-right Login button opens `/login`.
- Yangjibao-style portfolio ledger: the Portfolio page now provides estimated daily profit, multi-platform ledgers, weekly/monthly P/L summaries, contribution breakdowns, concentration checks, missing NAV warnings, 7-day redemption reminders, target-weight drift, educational recurring-investment plans, and target take-profit prompts.
- Multi-platform import assistant: users can paste holding text from Alipay, WeChat Wealth, Tiantian Fund, Snowball, or manual exports, upload Alipay `.txt` / `.csv` / `.json` text-based holding files, or upload Alipay holding screenshots that are recognized into text by in-browser OCR (`tesseract.js`, Simplified Chinese + English) before import. Screenshot OCR runs entirely in the browser and is not uploaded to the server. Platform authorization sync, live trading, and whole-network user buy/sell rankings remain roadmap items and are not faked.
- Global market radar: reads SSE Composite, SZSE Component, ChiNext, CSI 300, STAR 50, BSE 50, Hang Seng, and Nasdaq from Eastmoney push2 with Tencent quote fallback.
- Financial asset search: searches public fund data and A-share live quotes by code or name, with built-in fallback samples when upstream APIs fail.
- Fund details: prefers Tiantian intraday estimated NAV, estimated change, and estimate time while keeping the previous official NAV.
- Fund analysis trend chart: fund details use a dark data-radar ECharts visualization with close/NAV, range return, and max drawdown enabled by default; annualized return, Sharpe ratio, volatility, CSI 300 benchmark return, and excess return are optional indicators that can be toggled for detail while keeping time-range switching.
- Beginner decision map: explains fund type, NAV, market temperature, holding status, risk level, single-fund concentration, and monthly review paths.
- Local portfolio: calculates market value, cost, profit/loss, return rate, weights, estimated daily profit, ledger source, and local risk reminders after adding funds. The holdings list supports sorting by market value / return rate / name and lets you manually edit the held amount and cost amount; edits are saved locally immediately and, when signed in, are synced to Cloudflare D1 via `PUT /api/portfolio/default` (the `holdings.recorded_market_value` column stores the manually entered or screenshot-imported market value so screenshot holdings without 6-digit codes are still valued correctly). Holdings without a 6-digit code are auto-resolved to a real fund code by name, and the detail view labels the code source as "auto-filled / pending / manually confirmed". Each holding detail prefers Eastmoney F10 disclosed stock investment details (up to 100 rows), shows top-10 weight, disclosed weight beyond the top 10, and the estimated undisclosed/non-stock weight; clicking a stock shows its live quote plus a price trend chart (A-share daily history falls back to Tencent forward-adjusted klines).
- Watchlist: follows funds without counting them as holdings.
- Resend email login: `/login` uses a standalone minimal sign-in page, redirects back to `/app#portfolio` after OTP sign-in succeeds, `/api/auth/challenge` sends a 6-digit email OTP and returns Resend delivery failure details to the frontend, and `/api/auth/verify` creates a GG Fund-owned session; `/api/portfolio/default` prefers the signed-in user's portfolio.
- Cloudflare Worker deployment: Next Route Handlers are built by OpenNext into the Worker runtime with `GG_FUND_DB` and `GG_FUND_CACHE` bindings.

## Project Structure

- `app/`: Next.js App Router pages and `app/api/*` Route Handlers.
- `components/workspace/FundWorkspace.tsx`: Next workspace entry.
- `features/market`, `features/portfolio`, `features/auth`, `features/ai`, `features/email`: service modules.
- `lib/`: environment and HTTP runtime helpers.
- `frontend/src/`: React components, styles, and browser-side logic still reused by Next; no longer a standalone Vite app entry.
- `shared/`: shared DTOs, market adapters, and tests.
- `migrations/`: Cloudflare D1 migrations.
- `scripts/`: CI, deployment, and verification scripts.

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4 + Radix UI + shadcn/ui-style components
- Resend email OTP authentication
- OpenNext Cloudflare Workers deployment
- Eastmoney / Tencent / Tiantian Fund public APIs + fallback sample market data
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

Server values:

```bash
RESEND_API_KEY=re_your_key
AUTH_EMAIL_FROM="GG Fund <onboarding@resend.dev>"
```

Local `bun run dev` uses in-memory auth state by default, even when OpenNext discovers the D1 binding from `wrangler.jsonc`; set `GG_FUND_AUTH_USE_D1=1` only when you intentionally want to debug the D1 auth path locally. With `onboarding@resend.dev`, Resend only sends to the account owner's test email. Clear `RESEND_API_KEY` and `AUTH_EMAIL_FROM` to return to the local `devCode` OTP mode.

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

CI dependency installation runs `npm ci --include=optional --ignore-scripts` through `scripts/ci-install.sh`, with the Linux `workerd`, esbuild, Lightning CSS, Tailwind Oxide, and ast-grep packages pinned in root-level `optionalDependencies` so the runner installs binaries required by OpenNext / Wrangler / CSS builds.

Default smoke endpoints:

- `GET /api/health`
- `GET /api/market/indices`
- `GET /api/funds/000001`

## Next API

- `GET /api/health`
- `GET /api/market/indices`
- `GET /api/market/indices/:code/history?range=1m|3m|6m|1y|all`
- `GET /api/funds/search?q=消费`
- `GET /api/funds/:code`
- `GET /api/funds/:code/history?range=1m|3m|6m|1y|all`
- `GET /api/funds/:code/holdings`
- `GET /api/funds/trending`
- `GET /api/auth/me`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `POST /api/auth/logout`
- `GET /api/portfolio/default`
- `PUT /api/portfolio/default` (full sync of holdings and watchlist to D1 when signed in)

## Data Sources

Financial asset search reads Eastmoney fund search, Eastmoney A-share quote lists, and Tencent Securities quote fallback. Fund results include the latest official NAV, while stock results include live price, change percent, open/high/low, volume, and turnover. Fund detail prefers Tiantian Fund `fundgz` intraday valuation and falls back to Eastmoney official NAV. Fund holdings prefer Eastmoney F10 `FundArchivesDatas.aspx?type=jjcc` disclosed stock investment details and fall back to the mobile top-10 holdings endpoint. The global market radar reads Eastmoney push2 indices across A/H/US core markets and falls back to Tencent quotes when the edge runtime cannot reach Eastmoney. Historical NAVs come from Eastmoney fund history. Server routes normalize DTOs, cache responses, and handle fallback; the frontend never calls third-party market APIs directly.

## Capability Status

GG Fund uses three explicit status labels:

- `Live`: real API or local product capability is available today, such as global core indices, A-share live stock quotes, fund NAVs, fund discovery/search, diagnostics, history, local holdings, watchlist, Yangjibao-style ledgers, P/L reports, risk reminders, Alipay text-file upload, in-browser OCR of Alipay screenshots, text import, Resend email login, import, and export.
- `Connectable`: the product shape is defined but still needs real data or stronger algorithms, such as platform authorization sync and whole-network user buy/sell rankings.
- `Roadmap`: not presented as live production functionality, such as platform authorization sync, whole-network user buy/sell rankings, live trading, Qlib backtesting, and portfolio optimization.

All displayed data is for learning and reference only and is not investment advice.

## Disclaimer

The data in this project is for learning and reference only. It does not constitute investment advice, return promises, or trading instructions.

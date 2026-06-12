# GG Fund Global Fund And Index Market Dashboard

Chinese version: [README.md](./README.md)

GG Fund now uses a Cloudflare-first Next.js App Router architecture as its main application surface. `app/` contains pages and Route Handlers, the root path `/` redirects directly to the `/app` workspace, `components/workspace/FundWorkspace.tsx` mounts the reusable workspace entry, OpenNext builds the Cloudflare Worker output, and focused server responsibilities live in `features/*` and `lib/*`.

## Features

- Next.js App Router workspace: the root path `/` redirects directly to the `/app` workspace, `/login` provides a standalone email OTP sign-in page, `/settings` currently provides a basic information entry, and `/app/portfolio` currently serves as a landing page while local-first holdings and watchlist stay in the main workspace.
- Top navigation workspace: `/app` switches between Market and Account through a sticky top nav, with a compact account status card in the top-right corner; clicking the top-right Login button opens `/login`. The previous Overview landing page and feature-card section have been removed, so `/app` now opens the Market page by default.
- Yangjibao-style portfolio ledger: the Account page now provides estimated daily profit, multi-platform ledgers, weekly/monthly P/L summaries, contribution breakdowns, concentration checks, missing NAV warnings, 7-day redemption reminders, target-weight drift, educational recurring-investment plans, and target take-profit prompts.
- Multi-platform import assistant: the Account page keeps the import assistant as the only local entry module. Users can paste holding text from Alipay, WeChat Wealth, Tiantian Fund, Snowball, or manual exports, upload Alipay `.txt` / `.csv` / `.json` text-based holding files, or upload Alipay holding screenshot images (PNG/JPG/JPEG/WebP/BMP). Screenshots are sent to `POST /api/ai/recognize-holdings`, where the server first calls OCR.space (`OCR_SPACE_API_KEY` is optional; the public demo key is used with stricter rate limits when omitted), then sends the OCR text to DeepSeek (`deepseek-v4-flash`) for structured holding recognition and correction; the frontend falls back to in-browser OCR if cloud OCR is unavailable. After recognition the app automatically searches fund codes by fund name, fills them back into the result, and opens a confirmation modal where the user can edit each fund name, code, market value, and profit or click "Find code / Reconfirm" to resolve the code again by name before importing into the local ledger. The server reads `DEEPSEEK_API_KEY` and optional `OCR_SPACE_API_KEY` from the Cloudflare runtime context and returns an explicit error when the DeepSeek key is missing rather than fabricating results. Platform authorization sync, live trading, and whole-network user buy/sell rankings remain roadmap items and are not faked.
- Global index market: the Market page first shows A-share, Hong Kong, US, Nikkei, Korean, and European major indices as horizontal clickable cards, defaults to SSE Composite, and renders the selected index in a full-width trend chart below the cards. Live quotes prefer Eastmoney `push2` `ulist.np/get`; global indices use `100.{code}` secids such as `100.DJIA`, `100.SPX`, `100.NDX`, `100.N225`, `100.KS11`, `100.FTSE`, `100.GDAXI`, `100.FCHI`, and `100.HSI`; when Eastmoney is unavailable from the Worker egress, the API merges Tencent A-share indices and Sina global index quotes as fallbacks, then derives missing required cards such as STAR 50, BSE 50, and Nasdaq 100 from daily history. Global index history first tries Eastmoney `push2his`, then falls back to Naver Chart API daily history for symbols such as `.DJI`, `.INX`, `.IXIC`, `.NDX`, `.N225`, `KOSPI`, `.HSI`, `.FTSE`, `.GDAXI`, and `.FCHI`; BSE 50 additionally falls back to Sohu historical quotes because Tencent only returns a single daily kline.
- Financial asset search: the workspace second section sits below the index market, searches public fund data and A-share live quotes by code or name, and presents results as horizontal switchable cards with built-in fallback samples when upstream APIs fail.
- Fund details: prefers Tiantian Fund `fundgz` intraday estimated NAV, estimated change, and estimate time while keeping the previous official NAV; when the estimate endpoint or mobile NAV endpoint is unavailable, it keeps trying Eastmoney PC `pingzhongdata` NAV data and exact fund-search matches, then chooses the freshest available quote by estimate time or NAV date to avoid 404s or stale data from a single upstream. Both the detail actions and holding rows expose an "AI analysis" entry that opens a draggable, resizable right-side floating panel. The panel position and size are persisted in browser `localStorage` for the next session. The frontend now calls `/api/ai/analyze-fund/stream` to render a live drafting view, while the server reads `DEEPSEEK_API_KEY` from the Cloudflare runtime context, collects the fund quote, historical trend, major indices, and Eastmoney public web pages, then asks Deepseek to stream concise drivers, forward factors, watch points, and source links. When the key is missing, the UI explicitly falls back to a deterministic local report instead of pretending AI is ready.
- Fund analysis trend chart: fund details use a dark data-radar ECharts visualization with candlesticks and close/NAV enabled by default; range return, max drawdown, annualized return, Sharpe ratio, volatility, CSI 300 benchmark return, and excess return are optional indicators that can be toggled for detail while keeping time-range switching. Index, fund, and stock history charts all overlay candlesticks; when upstream data only provides NAV/close points, the frontend derives an approximate OHLC candle from adjacent points.
- Performance caching: `/app` server-prefetches indices, trending funds, and CSI 300 benchmark history; the browser caches indices, search results, fund details, history charts, intraday trends, and holdings locally so repeat visits render cached data first and refresh in the background. Intraday caches are versioned, and approximate trends are also trimmed on the frontend by the fund's estimate time so stale cache entries cannot show future points; market API routes use `s-maxage` plus `stale-while-revalidate`, while upstream requests have timeouts and stale in-memory fallback.
- Local portfolio: calculates market value, cost, profit/loss, return rate, weights, estimated daily profit, ledger source, and local risk reminders after adding funds. The portfolio header keeps only the primary title, removing the top-right return-rate badge and extra explanatory copy. The top holdings metric is selected by default and clicking it only switches back to the holdings-list state without scrolling to an anchor; holdings, estimated daily profit, and cumulative P/L details share the same rectangular panel treatment, and selecting estimated daily profit or cumulative P/L shows only that breakdown without also rendering the holdings list underneath. The estimated daily profit and cumulative P/L cards switch the detail panel between per-holding daily contribution and per-holding cumulative P/L; both detail panels support sorting by contribution, change rate, market value, name, or related dimensions, with arrow indicators for the current direction and repeated clicks toggling ascending/descending order. The daily contribution panel expands the holding-level intraday trend chart directly under the clicked holding row without a separate intraday button, and labels the chart header with "real intraday / approximate trend", the return basis, and the concrete data source; intraday trend charts now overlay intraday candlesticks by default. The displayed return uses the fund's daily change estimate rather than the first-to-last intraday point delta. Estimated daily profit prefers the current trading day; on weekends or when the current day has no trading record, it shows the latest quoted trading day instead and labels the profit date in both the metric card and the breakdown panel. For Nasdaq and other QDII/overseas funds, portfolio daily profit now uses the freshest available intraday estimate or NAV instead of forcibly falling back to stale official NAVs; historical same-day profit parsed from Alipay screenshots is not written into the ledger, so imported holdings are re-estimated from the latest quote. It prefers Eastmoney minute-level trends for tradable symbols and falls back to Tencent minute data when Eastmoney returns no points; OTC fund codes are guarded from accidentally reusing same-code stock minute data, ETF feeder funds first use the Eastmoney-linked target ETF code to read that ETF's Tencent minute line, truncate future points after the fund's own estimate time, and anchor it to the fund's estimated daily change, then fall back to normalized weighted disclosed holdings, with CSI 300 minute data as the final fallback. Ledger, plan, risk diagnosis, and report/reminder modules are moved to the bottom of the portfolio panel. Holding quotes refresh automatically every 1 minute and can also be refreshed manually; holdings copy follows the A-share convention of red for gains and green for losses across profit, return rate, daily change, and daily contribution. For holdings with a 6-digit code, the fund name is standardized to the official name returned by the code lookup and written back locally, preventing OCR/manual name mistakes from continuing to display or sync. The holdings list supports sorting by market value / return rate / name and shows a collapsed Add entry at the top-right of holdings detail; clicking Add expands the manual holding form directly under that toolbar, where entering a 6-digit fund code or fund name fetches the latest NAV and official name, then confirming market value/cost writes the holding and triggers quote refresh; it also lets you manually edit the held amount and cost amount, and edits are saved locally immediately. When signed in, the app first restores the server portfolio through `GET /api/portfolio/default`, and only then syncs local changes to Cloudflare D1 through `PUT /api/portfolio/default`, preventing a new page with empty local storage from overwriting account holdings (the `holdings.recorded_market_value` column stores the manually entered or screenshot-imported market value so screenshot holdings without 6-digit codes are still valued correctly). Holdings without a 6-digit code are auto-resolved to a real fund code by name, and the detail view labels the code source as "auto-filled / pending / manually confirmed"; amount-only screenshot/manual holdings are revalued by estimating shares from the imported amount and the historical NAV near the import date, then recalculating current market value, cumulative P/L, return rate, and estimated daily profit from the latest NAV. Each holding detail prefers Eastmoney F10 disclosed stock investment details (up to 100 rows), shows top-10 weight, disclosed weight beyond the top 10, and the estimated undisclosed/non-stock weight; clicking a stock shows its live quote plus a price trend chart (A-share daily history falls back to Tencent forward-adjusted klines).
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
DEEPSEEK_API_KEY=sk_your_key
OCR_SPACE_API_KEY=your_ocr_space_key # optional; without it the OCR.space public demo key is used with stricter rate limits
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

`bun run test:e2e` runs the Next core smoke spec, the email-login screenshot E2E in `tests/e2e/email-login.spec.ts`, and the fund workspace flow in `tests/fund-flow.spec.ts`.

`bun run coverage` is a hard gate: Statements, Branches, Functions, and Lines must all be above 90% within the configured unit-coverage scope. Large UI orchestration, Route glue, and external market adapters are excluded from the unit gate, but their critical behavior must remain covered by focused tests and E2E.

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
- `POST /api/ai/analyze-fund`
- `POST /api/ai/analyze-fund/stream`
- `GET /api/auth/me`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `POST /api/auth/logout`
- `GET /api/portfolio/default`
- `PUT /api/portfolio/default` (full sync of holdings and watchlist to D1 when signed in)

## Data Sources

Financial asset search reads Eastmoney fund search, Eastmoney A-share quote lists, and Tencent Securities quote fallback. Fund results include the latest official NAV, while stock results include live price, change percent, open/high/low, volume, and turnover. Fund detail prefers Tiantian Fund `fundgz` intraday valuation, falls back to Eastmoney official NAV, Eastmoney PC `pingzhongdata` NAV data, and exact fund-search matches, then chooses the freshest available quote by estimate time or NAV date. Fund holdings prefer Eastmoney F10 `FundArchivesDatas.aspx?type=jjcc` disclosed stock investment details and fall back to the mobile top-10 holdings endpoint. Index live quotes read Eastmoney push2 across A/H/US/Japan/Korea/Europe core markets, merge Tencent A-share plus Sina global index quotes when the edge runtime cannot reach Eastmoney, and complete missing required indices from daily history. Index history reads Eastmoney push2his, falls back to Naver Chart API daily history for global indices, and falls back to Sohu historical quotes for BSE 50; deployment verification checks the full required index universe, every quote field, and the `range=all` history arrays used by the page. Historical NAVs come from Eastmoney fund history. Server routes normalize DTOs, cache responses, enforce timeouts, and handle fallback; the frontend never calls third-party market APIs directly.

## Capability Status

GG Fund uses three explicit status labels:

- `Live`: real API or local product capability is available today, such as global core indices, A-share live stock quotes, fund NAVs, fund discovery/search, diagnostics, history, local holdings, watchlist, Yangjibao-style ledgers, P/L reports, risk reminders, Alipay text-file upload, in-browser OCR of Alipay screenshot images, text import, and Resend email login.
- `Connectable`: the product shape is defined but still needs real data or stronger algorithms, such as platform authorization sync and whole-network user buy/sell rankings.
- `Roadmap`: not presented as live production functionality, such as platform authorization sync, whole-network user buy/sell rankings, live trading, Qlib backtesting, and portfolio optimization.

All displayed data is for learning and reference only and is not investment advice.

## Disclaimer

The data in this project is for learning and reference only. It does not constitute investment advice, return promises, or trading instructions.

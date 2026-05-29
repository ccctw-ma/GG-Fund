# Auth, Fund Chart, and AI Research Agent Design

**Date:** 2026-05-29

## Goal

Turn three currently incomplete core experiences into usable product features:

1. OTP-first login that creates a durable authenticated session, survives refresh, supports logout, and scopes portfolio data to the signed-in user.
2. A professional open-source fund trend chart using Apache ECharts, with useful fund research metrics instead of a small static line chart.
3. A multi-step AI research agent that computes market/fund indicators before calling DeepSeek and returns structured analysis suitable for cards and chart annotations.

## Approved Direction

Use **Approach A: complete product loop**.

- Login: OTP first. Email and phone share the same challenge/verify/session flow. Production delivery provider is abstracted; local/dev can expose a dev code for tests.
- Chart: Apache ECharts research chart. It replaces the fund detail Recharts line chart and supports range controls, tooltip/crosshair, zoom, net value, return, drawdown, and future AI annotations.
- AI: Server-side agent pipeline. The backend computes deterministic indicators first, then sends a structured prompt to DeepSeek, then returns normalized structured output.

## Current State

### Auth

`backend/api.ts` already has challenge and verify endpoints, D1 tables for users/sessions/challenges, and a UI in `frontend/src/components/AuthPanel.tsx`. The feature is not product-complete:

- The frontend stores session only in component state.
- Refresh loses login.
- There is no `me` endpoint or logout endpoint.
- Portfolio/watchlist data is still effectively a default shared portfolio.
- OTP challenge expiration is written but not enforced.
- OAuth only returns metadata; it is out of first implementation scope except keeping the existing buttons from breaking.

### Chart

`frontend/src/components/FundSearch.tsx` renders a fixed-size Recharts `LineChart` with only net value. It has limited interaction and no research metrics.

### AI Analysis

`backend/api.ts` has `analyzeFund()`, but it only gathers one month history, computes a simple five-point momentum, builds one prompt string, calls DeepSeek, and returns unstructured text. `frontend/src/components/AnalysisPanel.tsx` renders the answer in a `<pre>`.

## Architecture

### Auth Architecture

Add a small server-side auth module and a frontend auth state boundary.

Backend responsibilities:

- Issue session tokens after OTP verification.
- Persist sessions in D1.
- Read session from `Authorization: Bearer <token>` or `gg_fund_session=<token>` cookie.
- Expose `GET /api/auth/me`.
- Expose `POST /api/auth/logout`.
- Enforce OTP challenge expiration and one-time use.
- Return `devCode` only outside production-like delivery mode.
- Scope portfolio data by authenticated user when a session exists.

Frontend responsibilities:

- Persist the session token in `localStorage`.
- Add token to API requests.
- Restore login state on app load via `/api/auth/me`.
- Provide logout.
- Show useful OTP states: send code, enter code, verify, logged in.

Data model:

- Keep existing `auth_users`, `auth_sessions`, and `auth_challenges`.
- Add owner metadata to portfolios with a nullable `user_id` column so existing anonymous/default behavior can continue for local tests and unauthenticated browsing.
- For authenticated users, `GET /api/portfolio/default` resolves that user's default portfolio.

Security constraints:

- Do not put provider secrets in frontend code.
- Do not log OTP codes in production mode.
- Expired, consumed, or mismatched OTP challenges fail with a clear error.
- Session expiry is checked in `/api/auth/me` and protected portfolio resolution.

### Chart Architecture

Add Apache ECharts to the frontend and isolate chart logic into focused files:

- `frontend/src/components/FundTrendChart.tsx`: renders the ECharts chart.
- `frontend/src/fundMetrics.ts`: deterministic calculations for return series, max drawdown, range slicing, and summary stats.
- `frontend/src/components/FundSearch.tsx`: delegates chart rendering to `FundTrendChart` and owns search/selection actions only.

Chart behavior:

- Range controls: 1M, 3M, 6M, 1Y, ALL. If available history is shorter, show all available points.
- Main line: unit net value.
- Secondary view/series: cumulative return percentage from first visible point.
- Drawdown area or metric card: max drawdown in the selected range.
- Tooltip: date, net value, cumulative return, drawdown.
- Data zoom: enabled for dense history.
- Empty state: explain when history is unavailable.

Library choice:

- Use `echarts` and `echarts-for-react` if dependency size is acceptable during install.
- If wrapper typing or bundle friction is high, use direct `echarts` init/dispose in a React component. The design prefers the wrapper for speed but does not require it.

### AI Research Agent Architecture

Move analysis into deterministic stages and structured output.

Backend files:

- `backend/fundAnalysis.ts`: pure calculations and prompt construction.
- `backend/api.ts`: route orchestration and response handling.

Agent stages:

1. `collect_fund_quote`: resolve current fund quote.
2. `collect_history`: load fund history for a wider range, preferably `1y` when the data source supports it; otherwise use available fallback history.
3. `collect_market_context`: load major index quotes.
4. `compute_indicators`: calculate returns, volatility proxy, max drawdown, momentum, trend slope, and latest-vs-official context.
5. `build_research_prompt`: create a structured prompt with JSON-like sections and a strict output contract.
6. `call_deepseek`: call DeepSeek server-side with the secret.
7. `normalize_report`: return structured sections even if upstream text is imperfect.

Response shape:

```ts
type FundAnalysisResponse = {
  fund: FundQuote;
  agent: {
    model: string;
    steps: Array<{ name: string; status: 'done'; summary: string }>;
    indicators: FundAnalysisIndicators;
  };
  report: {
    summary: string;
    trend: string;
    risk: string;
    scenarios: Array<{ name: string; probability: 'low' | 'medium' | 'high'; description: string }>;
    watchPoints: string[];
    disclaimer: string;
  };
  chartAnnotations: Array<{ date?: string; label: string; description: string; tone: 'positive' | 'negative' | 'neutral' }>;
  analysis: string;
};
```

`analysis` remains for backward compatibility during the transition.

Prompt principles:

- State that this is not investment advice.
- Require evidence-based language tied to computed indicators.
- Ask for scenarios, not predictions.
- Avoid deterministic buy/sell instructions.
- Ask the model to reference data limitations when history or quote data is incomplete.

Frontend AI UI:

- Replace raw `<pre>` as the primary view.
- Show agent steps, indicator cards, summary, trend, risk, scenarios, watch points, and disclaimer.
- Keep raw text hidden or as a secondary fallback only if structured fields are absent.

## API Changes

Add endpoints:

- `GET /api/auth/me`
  - Returns `{ user, session }` when token is valid.
  - Returns 401 when no or invalid token.
- `POST /api/auth/logout`
  - Invalidates current token if present.
  - Returns `{ ok: true }`.

Modify endpoints:

- `POST /api/auth/challenge`
  - Validate email/phone format.
  - Store expiry.
  - Return dev code only in local/test mode.
- `POST /api/auth/verify`
  - Enforce expiry and consumed state.
  - Return session token.
- Portfolio endpoints
  - Resolve authenticated user's default portfolio when token is present.
  - Preserve anonymous default behavior for unauthenticated users so browsing still works.
- `POST /api/ai/analyze-fund`
  - Return the structured response described above.

## Testing Strategy

Backend tests:

- OTP challenge rejects invalid email/phone.
- OTP verify rejects expired challenges.
- OTP verify rejects replay after consumed.
- `/api/auth/me` returns current user for valid token and 401 for invalid/missing token.
- logout invalidates session.
- authenticated portfolio resolution is isolated by user.
- AI agent computes indicators and sends DeepSeek a prompt containing the deterministic context.
- AI endpoint returns structured report and chart annotations.

Frontend tests:

- AuthPanel restores session through `/api/auth/me`.
- AuthPanel logs out and clears local token.
- API client attaches bearer token after login.
- FundTrendChart renders range controls and summary metrics for history.
- AnalysisPanel renders structured report cards and agent indicators.

E2E test:

- User completes OTP login, refreshes or navigates, remains logged in, adds holding, sees it tied to session, runs analysis, and sees chart/report output.

Verification commands:

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

For full local parity:

```bash
bun run ci:test
```

## Documentation Updates

Update:

- `README.md`
- `README.en.md`
- `docs/deployment.md` if auth secrets, D1 migrations, AI response, or chart library setup changes.
- `AGENTS.md` only if contributor workflow expectations change.

## Out of Scope for This Spec

- Complete GitHub OAuth callback and token exchange.
- Complete WeChat OAuth callback and token exchange.
- Real SMS/email vendor integration. The design leaves a delivery abstraction, but the first implementation keeps local/dev OTP visible for testability unless production provider secrets already exist.
- Investment recommendations or automated buy/sell signals.

## Acceptance Criteria

- Login is usable without losing state on refresh.
- Users can log out.
- Authenticated portfolio data is not shared across different users.
- Fund chart uses an open-source chart library better suited to research than the current Recharts line chart.
- Chart exposes range controls, tooltip, return, and drawdown information.
- AI analysis uses deterministic indicators and a multi-step backend pipeline before calling DeepSeek.
- AI response is structured and rendered as readable report cards.
- All required local gates pass.

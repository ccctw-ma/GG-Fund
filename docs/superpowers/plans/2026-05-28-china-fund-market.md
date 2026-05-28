# China Fund Market Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + Bun Chinese fund market MVP that lets users browse market/fund data and analyze local fund holdings.

**Architecture:** A Vite React client stores holdings and watchlist data locally in the browser, while a Bun TypeScript API server proxies and normalizes public fund/market data with in-memory cache and deterministic fallback data. Tests cover calculation/storage/API units with Vitest, browser flows with Playwright, and an AI-assisted Midscene flow skeleton.

**Tech Stack:** React, Vite, TypeScript, Bun, Vitest, Playwright, Midscene, localStorage, CSS.

---

## File Structure

- `package.json` — scripts and dependencies for web, API, unit tests, and E2E tests.
- `tsconfig.json` — shared TypeScript compiler configuration.
- `vite.config.ts` — React dev server, API proxy, and Vitest browser-like test setup.
- `index.html` — Vite HTML entry.
- `src/main.tsx` — React bootstrap.
- `src/App.tsx` — application shell and page composition.
- `src/styles.css` — responsive Chinese dashboard styling.
- `src/types.ts` — shared client types for holdings, quotes, indices, and history points.
- `src/api.ts` — client API calls to Bun `/api/*` endpoints.
- `src/storage.ts` — local holding/watchlist/import/export persistence.
- `src/portfolio.ts` — pure portfolio math.
- `src/components/*.tsx` — focused UI sections for header, market overview, fund search, portfolio, and settings.
- `server/index.ts` — Bun HTTP server and route dispatch.
- `server/marketData.ts` — public data adapter, in-memory cache, and fallback market/fund data.
- `server/types.ts` — API DTO types.
- `src/**/*.test.ts` and `server/**/*.test.ts` — Vitest unit/API tests.
- `tests/fund-flow.spec.ts` — Playwright E2E flow.
- `tests/midscene-fund-flow.spec.ts` — Midscene + Playwright + Vitest flow skeleton.
- `playwright.config.ts` — E2E server orchestration.
- `docs/deployment.md` — free infrastructure deployment notes.

## Tasks

### Task 1: Repository and toolchain baseline

**Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`

- [ ] Initialize git in the current folder, attach `https://github.com/ccctw-ma/GG-Fund.git` as `origin`, fetch `master`, and keep the local design docs.
- [ ] Add a Vite/React/Bun TypeScript toolchain with scripts: `dev:web`, `dev:api`, `build`, `test`, `test:e2e`, `test:midscene`.
- [ ] Install dependencies with Bun.
- [ ] Run `bun install` and verify a lockfile is generated.

### Task 2: Pure domain model and tests

**Files:** `src/types.ts`, `src/portfolio.ts`, `src/storage.ts`, `src/portfolio.test.ts`, `src/storage.test.ts`

- [ ] Write Vitest tests for portfolio summary calculations and import validation.
- [ ] Implement shared types, portfolio calculations, and local persistence helpers.
- [ ] Run `bun run test src/portfolio.test.ts src/storage.test.ts` and expect PASS.

### Task 3: Bun API server

**Files:** `server/types.ts`, `server/marketData.ts`, `server/index.ts`, `server/marketData.test.ts`, `server/index.test.ts`

- [ ] Write tests for cache behavior, fund search/detail/history, index data, and unified error responses.
- [ ] Implement fallback-backed market data functions and Bun route handling.
- [ ] Run `bun run test server` and expect PASS.

### Task 4: React application UI

**Files:** `src/main.tsx`, `src/App.tsx`, `src/api.ts`, `src/styles.css`, `src/components/Header.tsx`, `src/components/MarketOverview.tsx`, `src/components/FundSearch.tsx`, `src/components/PortfolioPanel.tsx`, `src/components/SettingsPanel.tsx`

- [ ] Build a Chinese dashboard with market overview, fund search/detail, local holding analysis, watchlist, import/export, loading states, and disclaimer.
- [ ] Wire client API calls through the Vite proxy to the Bun server.
- [ ] Ensure holdings remain browser-local only.
- [ ] Run `bun run build` and expect PASS.

### Task 5: E2E and Midscene tests

**Files:** `playwright.config.ts`, `tests/fund-flow.spec.ts`, `tests/midscene-fund-flow.spec.ts`

- [ ] Add Playwright config that starts Bun API and Vite web server.
- [ ] Add Playwright test for search → add holding → portfolio analysis → export flow.
- [ ] Add Midscene/Vitest/Playwright test skeleton using natural-language UI assertions.
- [ ] Run `bun run test:e2e` and expect PASS; run Midscene test when `OPENAI_API_KEY` or compatible model config exists.

### Task 6: Infrastructure documentation and verification

**Files:** `README.md`, `docs/deployment.md`

- [ ] Document local setup, scripts, architecture, privacy model, and free deployment options.
- [ ] Verify `bun run test`, `bun run build`, and Playwright E2E.
- [ ] If a browser can be launched, manually test the UI golden path.

## Self-Review

- Spec coverage: all required MVP pages, local holdings, market data proxy, tests, free infrastructure notes, and privacy constraints are covered by tasks.
- Placeholder scan: no task depends on unspecified implementation details; Midscene is explicitly a runnable skeleton gated by model credentials.
- Type consistency: client and server use `fundCode`, `fundName`, `netValue`, `dailyChangePercent`, `quoteDate`, and `source` consistently.

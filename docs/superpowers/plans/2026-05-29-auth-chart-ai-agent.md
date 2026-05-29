# Auth, Fund Chart, and AI Research Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement OTP-first durable login, replace the weak fund chart with an Apache ECharts research chart, and build a structured multi-step AI fund analysis agent.

**Architecture:** Split the work into three independently verifiable phases. Auth adds server-side session helpers, user-scoped portfolios, and frontend session persistence. Charting adds pure metric calculations plus a focused ECharts component. AI analysis adds pure indicator/prompt logic and returns structured report data rendered by a card-based frontend panel.

**Tech Stack:** Bun, TypeScript, React, Vite, Cloudflare Pages Functions, D1, KV, Vitest, Playwright, Apache ECharts (`echarts`, `echarts-for-react`), DeepSeek chat completions.

---

## File Structure

**Auth**
- Modify `migrations/0001_initial.sql`: add `user_id text` to `portfolios` for new installs.
- Create `migrations/0004_user_portfolios.sql`: add `user_id` to existing D1 deployments and index it.
- Modify `backend/api.ts`: add session helpers, `/api/auth/me`, `/api/auth/logout`, OTP validation/expiry, and authenticated portfolio resolution.
- Modify `backend/local.ts`: teach fake D1 about portfolio `userId`, session deletion, and new SQL patterns.
- Modify `backend/api.test.ts` and `backend/local.test.ts`: cover OTP/session/portfolio behavior.
- Modify `frontend/src/api.ts`: add auth token persistence helpers and new auth endpoints.
- Modify `frontend/src/components/AuthPanel.tsx`: implement restore/logout and usable OTP flow.
- Modify `frontend/src/App.tsx`: load auth state early enough for portfolio calls.
- Modify frontend tests and E2E tests.

**Chart**
- Add dependencies: `echarts`, `echarts-for-react`.
- Create `frontend/src/fundMetrics.ts`: range slicing, cumulative return, drawdown, and summary calculations.
- Create `frontend/src/fundMetrics.test.ts`.
- Create `frontend/src/components/FundTrendChart.tsx`.
- Modify `frontend/src/components/FundSearch.tsx`: replace inline Recharts chart with `FundTrendChart`.
- Modify component tests and E2E assertions.

**AI Agent**
- Create `backend/fundAnalysis.ts`: pure indicator, prompt, and normalization helpers.
- Create `backend/fundAnalysis.test.ts`.
- Modify `backend/api.ts`: route AI endpoint through the new pipeline.
- Modify `frontend/src/api.ts` and `frontend/src/types.ts`: structured analysis response types.
- Modify `frontend/src/components/AnalysisPanel.tsx`: render report cards, indicators, scenarios, watch points, and annotations.
- Modify tests.

**Docs**
- Modify `README.md`, `README.en.md`, `docs/deployment.md`.

---

## Phase 1: OTP Login and User-Scoped Portfolios

### Task 1: Add D1 schema support for user-owned portfolios

**Files:**
- Modify: `migrations/0001_initial.sql`
- Create: `migrations/0004_user_portfolios.sql`

- [ ] **Step 1: Inspect current portfolio schema**

Run:
```bash
sed -n '1,120p' migrations/0001_initial.sql
```

Expected: see `create table if not exists portfolios` without `user_id`.

- [ ] **Step 2: Modify initial schema**

In `migrations/0001_initial.sql`, change the portfolios table from:

```sql
create table if not exists portfolios (
  id text primary key,
  name text not null,
  created_at text not null,
  updated_at text not null
);
```

to:

```sql
create table if not exists portfolios (
  id text primary key,
  user_id text references auth_users(id) on delete cascade,
  name text not null,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_portfolios_user_id on portfolios(user_id);
```

- [ ] **Step 3: Create migration for existing deployments**

Create `migrations/0004_user_portfolios.sql`:

```sql
alter table portfolios add column user_id text references auth_users(id) on delete cascade;

create index if not exists idx_portfolios_user_id on portfolios(user_id);
```

- [ ] **Step 4: Run tests that exercise fake D1 before backend updates**

Run:
```bash
bun test backend/api.test.ts backend/local.test.ts
```

Expected: existing tests may pass because migrations are not executed in unit tests. This step confirms the schema-only change did not break TypeScript/test loading.

- [ ] **Step 5: Commit schema change**

```bash
git add migrations/0001_initial.sql migrations/0004_user_portfolios.sql
git commit -m "feat(auth): add user-owned portfolio schema" -m "🤖 Generated with [Aiden x Claude Code]" -m "Co-Authored-By: Aiden"
```

### Task 2: Write failing backend auth/session tests

**Files:**
- Modify: `backend/api.test.ts`

- [ ] **Step 1: Add tests for invalid OTP, session restore, logout, and portfolio isolation**

Append these tests inside the existing `describe('Cloudflare API', () => { ... })` block in `backend/api.test.ts`:

```ts
  it('rejects invalid OTP identifiers before creating a challenge', async () => {
    const api = createCloudflareApi({ marketData });
    const response = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'not-an-email' }),
    }), env());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'AUTH_IDENTIFIER_INVALID', message: '登录标识格式不正确' } });
  });

  it('restores the current user with a valid session token and logs out', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();
    const challengeResponse = await api.fetch(new Request('https://example.com/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ provider: 'email', identifier: 'persist@example.com' }),
    }), bindings);
    const challenge = await challengeResponse.json();
    const verifyResponse = await api.fetch(new Request('https://example.com/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
    }), bindings);
    const verified = await verifyResponse.json();

    const meResponse = await api.fetch(new Request('https://example.com/api/auth/me', {
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), bindings);

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toEqual(expect.objectContaining({
      user: expect.objectContaining({ identifier: 'persist@example.com' }),
      session: expect.objectContaining({ token: verified.session.token }),
    }));

    const logoutResponse = await api.fetch(new Request('https://example.com/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), bindings);
    expect(logoutResponse.status).toBe(200);
    await expect(logoutResponse.json()).resolves.toEqual({ ok: true });

    const afterLogout = await api.fetch(new Request('https://example.com/api/auth/me', {
      headers: { Authorization: `Bearer ${verified.session.token}` },
    }), bindings);
    expect(afterLogout.status).toBe(401);
  });

  it('keeps authenticated default portfolios isolated by user', async () => {
    const api = createCloudflareApi({ marketData });
    const bindings = env();

    async function login(identifier: string) {
      const challengeResponse = await api.fetch(new Request('https://example.com/api/auth/challenge', {
        method: 'POST',
        body: JSON.stringify({ provider: 'email', identifier }),
      }), bindings);
      const challenge = await challengeResponse.json();
      const verifyResponse = await api.fetch(new Request('https://example.com/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId: challenge.challengeId, code: challenge.devCode }),
      }), bindings);
      const verified = await verifyResponse.json();
      return verified.session.token as string;
    }

    const alphaToken = await login('alpha@example.com');
    const betaToken = await login('beta@example.com');

    await api.fetch(new Request('https://example.com/api/portfolio/default/holdings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${alphaToken}` },
      body: JSON.stringify({ fundCode: '000001', fundName: '华夏成长混合', shares: 100, costAmount: 120, purchaseDate: '2026-05-29' }),
    }), bindings);

    const alphaPortfolio = await api.fetch(new Request('https://example.com/api/portfolio/default', {
      headers: { Authorization: `Bearer ${alphaToken}` },
    }), bindings);
    const betaPortfolio = await api.fetch(new Request('https://example.com/api/portfolio/default', {
      headers: { Authorization: `Bearer ${betaToken}` },
    }), bindings);

    await expect(alphaPortfolio.json()).resolves.toEqual(expect.objectContaining({
      holdings: [expect.objectContaining({ fundCode: '000001' })],
    }));
    await expect(betaPortfolio.json()).resolves.toEqual(expect.objectContaining({
      holdings: [],
    }));
  });
```

- [ ] **Step 2: Run tests and verify they fail for missing behavior**

Run:
```bash
bun test backend/api.test.ts
```

Expected: FAIL. Failures should mention current challenge accepting invalid identifiers, `/api/auth/me` returning 404, `/api/auth/logout` returning 404, or portfolio isolation not implemented.

### Task 3: Implement backend auth/session behavior

**Files:**
- Modify: `backend/api.ts`
- Modify: `backend/api.test.ts` only if TypeScript test typing needs `unknown` narrowing, without changing assertions.

- [ ] **Step 1: Add helper types near auth constants**

In `backend/api.ts`, after `type OAuthProvider = ...`, add:

```ts
type AuthUser = {
  id: string;
  provider: string;
  identifier: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

type AuthSession = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

type AuthContext = {
  user: AuthUser;
  session: AuthSession;
};
```

- [ ] **Step 2: Add identifier and token helpers after `readJson()`**

```ts
function isValidIdentifier(provider: OtpProvider, identifier: string) {
  if (provider === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  return /^\+?\d{8,15}$/.test(identifier);
}

function readBearerToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)gg_fund_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function sessionCookie(token: string, expiresAt: string) {
  return `gg_fund_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${new Date(expiresAt).toUTCString()}`;
}

function clearSessionCookie() {
  return 'gg_fund_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
}
```

- [ ] **Step 3: Add JSON helper that can set cookies**

Replace `const json = ...` with a function that supports extra headers:

```ts
const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      ...extraHeaders,
    },
  });
```

- [ ] **Step 4: Add session lookup and logout helpers after `persistSession()`**

```ts
async function getAuthContext(db: D1Database, request: Request): Promise<AuthContext | undefined> {
  const token = readBearerToken(request);
  if (!token) return undefined;
  const row = await db
    .prepare(`
      select
        s.token as token,
        s.user_id as userId,
        s.created_at as sessionCreatedAt,
        s.expires_at as sessionExpiresAt,
        u.id as id,
        u.provider as provider,
        u.identifier as identifier,
        u.display_name as displayName,
        u.created_at as createdAt,
        u.updated_at as updatedAt
      from auth_sessions s
      join auth_users u on u.id = s.user_id
      where s.token = ?
    `)
    .bind(token)
    .first<Record<string, string>>();
  if (!row || Date.parse(row.sessionExpiresAt) <= Date.now()) return undefined;
  return {
    user: {
      id: row.id,
      provider: row.provider,
      identifier: row.identifier,
      displayName: row.displayName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    session: {
      token: row.token,
      userId: row.userId,
      createdAt: row.sessionCreatedAt,
      expiresAt: row.sessionExpiresAt,
    },
  };
}

async function logout(db: D1Database, request: Request) {
  const token = readBearerToken(request);
  if (token) await db.prepare('delete from auth_sessions where token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}
```

- [ ] **Step 5: Update `ensureDefaultPortfolio()` to accept an optional user**

Replace its signature and first query with:

```ts
async function ensureDefaultPortfolio(db: D1Database, userId?: string) {
  const existing = userId
    ? await db
      .prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios where user_id = ? order by created_at limit 1')
      .bind(userId)
      .first<{ id: string; name: string; createdAt: string; updatedAt: string }>()
    : await db
      .prepare('select id, name, created_at as createdAt, updated_at as updatedAt from portfolios where user_id is null order by created_at limit 1')
      .first<{ id: string; name: string; createdAt: string; updatedAt: string }>();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  await db.prepare('insert into portfolios (id, user_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)').bind(id, userId ?? null, '默认组合', timestamp, timestamp).run();
  return { id, name: '默认组合', createdAt: timestamp, updatedAt: timestamp };
}
```

- [ ] **Step 6: Update OTP validation and expiry**

In `createOtpChallenge()`, after `const identifier = ...`, add:

```ts
  if (!isValidIdentifier(body.provider, identifier)) return { error: 'invalid_identifier' as const };
```

Change the function return type handling so the route can distinguish unsupported provider vs invalid identifier. In the route, map `invalid_identifier` to:

```ts
return error(400, 'AUTH_IDENTIFIER_INVALID', '登录标识格式不正确');
```

In `verifyOtpChallenge()`, select `expires_at as expiresAt` and reject expired challenges:

```ts
  if (!challenge || challenge.consumedAt || challenge.code !== code || Date.parse(challenge.expiresAt) <= Date.now()) return undefined;
```

- [ ] **Step 7: Set session cookie after OTP verify**

In the `/api/auth/verify` route, return:

```ts
return result ? json(result, 201, { 'set-cookie': sessionCookie(result.session.token, result.session.expiresAt) }) : error(400, 'AUTH_CHALLENGE_INVALID', '验证码无效或已过期');
```

- [ ] **Step 8: Add `/api/auth/me` and `/api/auth/logout` routes**

In GET routes:

```ts
if (path === '/api/auth/me') {
  const auth = await getAuthContext(env.GG_FUND_DB, request);
  return auth ? json(auth) : error(401, 'AUTH_REQUIRED', '请先登录');
}
```

In POST routes:

```ts
if (path === '/api/auth/logout') return logout(env.GG_FUND_DB, request);
```

- [ ] **Step 9: Use auth context for portfolio routes**

Before portfolio route handling in GET/POST branches, call:

```ts
const auth = await getAuthContext(env.GG_FUND_DB, request);
```

For `GET /api/portfolio/default` and portfolio POST routes, pass `auth?.user.id` to `ensureDefaultPortfolio()`.

- [ ] **Step 10: Run backend tests**

Run:
```bash
bun test backend/api.test.ts
```

Expected: PASS for backend API tests.

### Task 4: Update local fake D1 for auth/session SQL

**Files:**
- Modify: `backend/local.ts`
- Modify: `backend/api.test.ts` fake D1 classes if they duplicate local logic.

- [ ] **Step 1: Update portfolio storage shape**

In both fake D1 implementations, ensure `portfolios` entries can include `userId`.

- [ ] **Step 2: Add SQL pattern support**

Update `first()` to handle:

```ts
if (sql.includes('from portfolios where user_id = ?')) return (this.portfolios.find((item) => item.userId === params[0]) as T) ?? null;
if (sql.includes('from portfolios where user_id is null')) return (this.portfolios.find((item) => !item.userId) as T) ?? null;
if (sql.includes('from auth_sessions s')) {
  const session = this.authSessions.find((item) => item.token === params[0]);
  const user = session ? this.authUsers.find((item) => item.id === session.userId) : undefined;
  return session && user ? ({
    token: session.token,
    userId: session.userId,
    sessionCreatedAt: session.createdAt,
    sessionExpiresAt: session.expiresAt,
    id: user.id,
    provider: user.provider,
    identifier: user.identifier,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  } as T) : null;
}
```

Update `run()` to handle:

```ts
if (sql.includes('insert into portfolios')) this.portfolios.push({ id: params[0], userId: params[1], name: params[2], createdAt: params[3], updatedAt: params[4] });
if (sql.includes('delete from auth_sessions')) this.authSessions = this.authSessions.filter((item) => item.token !== params[0]);
```

- [ ] **Step 3: Run local/backend tests**

Run:
```bash
bun test backend/api.test.ts backend/local.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit backend auth**

```bash
git add backend/api.ts backend/local.ts backend/api.test.ts backend/local.test.ts
git commit -m "feat(auth): add durable otp sessions" -m "🤖 Generated with [Aiden x Claude Code]" -m "Co-Authored-By: Aiden"
```

### Task 5: Write failing frontend API/AuthPanel tests

**Files:**
- Modify: `frontend/src/api.test.ts`
- Modify: `frontend/src/components/components.test.tsx` or `frontend/src/App.test.tsx`

- [ ] **Step 1: Add API client tests**

In `frontend/src/api.test.ts`, add tests for token storage and auth endpoints:

```ts
  it('attaches the saved bearer token to authenticated requests', async () => {
    localStorage.setItem('gg_fund_session_token', 'session_test');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: { id: 'u1' }, session: { token: 'session_test' } }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await api.getCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer session_test' }),
    }));
  });

  it('saves and clears session tokens', () => {
    api.saveSessionToken('session_abc');
    expect(localStorage.getItem('gg_fund_session_token')).toBe('session_abc');

    api.clearSessionToken();
    expect(localStorage.getItem('gg_fund_session_token')).toBeNull();
  });
```

- [ ] **Step 2: Add AuthPanel restore/logout UI test**

In the component test file, mock `api.getCurrentUser`, render `AuthPanel`, and assert the restored user appears and logout clears it.

Use this behavior target:

```ts
expect(await screen.findByText(/已登录：persist@example.com/)).toBeInTheDocument();
await userEvent.click(screen.getByRole('button', { name: /退出登录/ }));
expect(api.logout).toHaveBeenCalled();
```

- [ ] **Step 3: Run frontend tests and verify failure**

Run:
```bash
bun test frontend/src/api.test.ts frontend/src/components/components.test.tsx
```

Expected: FAIL because `getCurrentUser`, token helpers, and logout UI do not exist yet.

### Task 6: Implement frontend auth persistence and logout

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/components/AuthPanel.tsx`
- Modify: `frontend/src/App.tsx` only if portfolio load must happen after auth restoration.

- [ ] **Step 1: Add token helpers and auth endpoints to `frontend/src/api.ts`**

Add:

```ts
const SESSION_TOKEN_KEY = 'gg_fund_session_token';

const getSessionToken = () => localStorage.getItem(SESSION_TOKEN_KEY);
const authHeaders = () => {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
```

Update `getJson` and `postJson` to merge `authHeaders()` into `headers`.

Export these API methods:

```ts
saveSessionToken: (token: string) => localStorage.setItem(SESSION_TOKEN_KEY, token),
clearSessionToken: () => localStorage.removeItem(SESSION_TOKEN_KEY),
getCurrentUser: () => getJson<AuthSessionResponse>('/api/auth/me'),
logout: () => postJson<{ ok: true }>('/api/auth/logout', {}),
```

- [ ] **Step 2: Update AuthPanel state lifecycle**

In `AuthPanel.tsx`:

- Import `useEffect`.
- On mount, call `api.getCurrentUser()` when a saved token exists. If it fails, clear token.
- After `verifyAuthChallenge`, call `api.saveSessionToken(result.session.token)` and set session.
- Add logout button that calls `api.logout()`, clears token, clears session, challenge, and code.
- Change success text to include `已登录：${session.user.identifier}`.

- [ ] **Step 3: Run frontend tests**

Run:
```bash
bun test frontend/src/api.test.ts frontend/src/components/components.test.tsx frontend/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run all auth-related tests**

Run:
```bash
bun test backend/api.test.ts backend/local.test.ts frontend/src/api.test.ts frontend/src/components/components.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit frontend auth**

```bash
git add frontend/src/api.ts frontend/src/components/AuthPanel.tsx frontend/src/App.tsx frontend/src/api.test.ts frontend/src/components/components.test.tsx frontend/src/App.test.tsx
git commit -m "feat(auth): persist login state in frontend" -m "🤖 Generated with [Aiden x Claude Code]" -m "Co-Authored-By: Aiden"
```

---

## Phase 2: ECharts Fund Research Chart

### Task 7: Install ECharts dependencies

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Install dependencies**

Run:
```bash
bun add echarts echarts-for-react
```

Expected: `package.json` includes both packages and `bun.lock` updates.

- [ ] **Step 2: Verify frozen install still works**

Run:
```bash
bun install --frozen-lockfile --ignore-scripts
```

Expected: command exits 0.

- [ ] **Step 3: Commit dependencies**

```bash
git add package.json bun.lock
git commit -m "feat(chart): add echarts dependencies" -m "🤖 Generated with [Aiden x Claude Code]" -m "Co-Authored-By: Aiden"
```

### Task 8: Write fund metric tests

**Files:**
- Create: `frontend/src/fundMetrics.test.ts`

- [ ] **Step 1: Create failing metric tests**

Create `frontend/src/fundMetrics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateFundMetrics, selectHistoryRange } from './fundMetrics';

const history = [
  { date: '2026-01-01', netValue: 1.0 },
  { date: '2026-01-02', netValue: 1.1 },
  { date: '2026-01-03', netValue: 1.05 },
  { date: '2026-01-04', netValue: 1.2 },
];

describe('fund metrics', () => {
  it('calculates cumulative return and max drawdown for visible history', () => {
    const metrics = calculateFundMetrics(history);

    expect(metrics.points).toEqual([
      { date: '2026-01-01', netValue: 1.0, cumulativeReturn: 0, drawdown: 0 },
      { date: '2026-01-02', netValue: 1.1, cumulativeReturn: 10, drawdown: 0 },
      { date: '2026-01-03', netValue: 1.05, cumulativeReturn: 5, drawdown: -4.55 },
      { date: '2026-01-04', netValue: 1.2, cumulativeReturn: 20, drawdown: 0 },
    ]);
    expect(metrics.summary).toEqual({ totalReturn: 20, maxDrawdown: -4.55, latestNetValue: 1.2, highNetValue: 1.2, lowNetValue: 1.0 });
  });

  it('selects a trailing range by calendar days', () => {
    const visible = selectHistoryRange([
      { date: '2026-01-01', netValue: 1 },
      { date: '2026-02-01', netValue: 1.1 },
      { date: '2026-03-01', netValue: 1.2 },
    ], '1M');

    expect(visible).toEqual([
      { date: '2026-02-01', netValue: 1.1 },
      { date: '2026-03-01', netValue: 1.2 },
    ]);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run:
```bash
bun test frontend/src/fundMetrics.test.ts
```

Expected: FAIL because `frontend/src/fundMetrics.ts` does not exist.

### Task 9: Implement fund metric helpers

**Files:**
- Create: `frontend/src/fundMetrics.ts`

- [ ] **Step 1: Create implementation**

Create `frontend/src/fundMetrics.ts`:

```ts
import type { FundHistoryPoint } from './types';

export type FundRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export type FundMetricPoint = FundHistoryPoint & {
  cumulativeReturn: number;
  drawdown: number;
};

export type FundMetricSummary = {
  totalReturn: number;
  maxDrawdown: number;
  latestNetValue: number;
  highNetValue: number;
  lowNetValue: number;
};

const rangeDays: Record<Exclude<FundRange, 'ALL'>, number> = {
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 366,
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function selectHistoryRange(history: FundHistoryPoint[], range: FundRange) {
  if (range === 'ALL' || history.length === 0) return history;
  const latest = new Date(history.at(-1)?.date ?? '').getTime();
  if (Number.isNaN(latest)) return history;
  const cutoff = latest - rangeDays[range] * 24 * 60 * 60 * 1000;
  const selected = history.filter((point) => new Date(point.date).getTime() >= cutoff);
  return selected.length >= 2 ? selected : history;
}

export function calculateFundMetrics(history: FundHistoryPoint[]) {
  const first = history[0]?.netValue ?? 0;
  let high = first;
  let maxDrawdown = 0;
  const points: FundMetricPoint[] = history.map((point) => {
    high = Math.max(high, point.netValue);
    const cumulativeReturn = first ? round2(((point.netValue - first) / first) * 100) : 0;
    const drawdown = high ? round2(((point.netValue - high) / high) * 100) : 0;
    maxDrawdown = Math.min(maxDrawdown, drawdown);
    return { ...point, cumulativeReturn, drawdown };
  });
  const values = history.map((point) => point.netValue);
  return {
    points,
    summary: {
      totalReturn: points.at(-1)?.cumulativeReturn ?? 0,
      maxDrawdown,
      latestNetValue: values.at(-1) ?? 0,
      highNetValue: values.length ? Math.max(...values) : 0,
      lowNetValue: values.length ? Math.min(...values) : 0,
    } satisfies FundMetricSummary,
  };
}
```

- [ ] **Step 2: Run metric tests**

Run:
```bash
bun test frontend/src/fundMetrics.test.ts
```

Expected: PASS.

### Task 10: Create ECharts fund trend component

**Files:**
- Create: `frontend/src/components/FundTrendChart.tsx`
- Modify: `frontend/src/components/components.test.tsx`

- [ ] **Step 1: Add component test**

Add a test that renders `FundTrendChart` with four history points and asserts:

```ts
expect(screen.getByTestId('fund-chart')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '1M' })).toBeInTheDocument();
expect(screen.getByText(/区间收益/)).toBeInTheDocument();
expect(screen.getByText(/最大回撤/)).toBeInTheDocument();
```

- [ ] **Step 2: Run and verify failure**

Run:
```bash
bun test frontend/src/components/components.test.tsx
```

Expected: FAIL because `FundTrendChart` does not exist.

- [ ] **Step 3: Create component**

Create `frontend/src/components/FundTrendChart.tsx` using `echarts-for-react`:

```tsx
import ReactECharts from 'echarts-for-react';
import { useMemo, useState } from 'react';
import { calculateFundMetrics, selectHistoryRange, type FundRange } from '../fundMetrics';
import type { FundHistoryPoint } from '../types';
import { Button } from './ui/button';

const ranges: FundRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

export function FundTrendChart({ history }: { history: FundHistoryPoint[] }) {
  const [range, setRange] = useState<FundRange>('1M');
  const visible = useMemo(() => selectHistoryRange(history, range), [history, range]);
  const metrics = useMemo(() => calculateFundMetrics(visible), [visible]);

  if (history.length === 0) {
    return <div className="mt-5 rounded-[1.4rem] bg-[#fffaf0]/70 p-6 text-sm font-semibold text-ink/55">暂无历史净值数据，选择其他基金或稍后重试。</div>;
  }

  const option = {
    backgroundColor: 'transparent',
    color: ['#047857', '#2563eb', '#dc2626'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { top: 0, data: ['单位净值', '区间收益%', '回撤%'] },
    grid: { left: 44, right: 20, top: 48, bottom: 54 },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 18 }],
    xAxis: { type: 'category', data: metrics.points.map((point) => point.date), axisLabel: { color: '#68746b' } },
    yAxis: [
      { type: 'value', name: '净值', scale: true, axisLabel: { color: '#68746b' } },
      { type: 'value', name: '%', axisLabel: { color: '#68746b', formatter: '{value}%' } },
    ],
    series: [
      { name: '单位净值', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3 }, data: metrics.points.map((point) => point.netValue) },
      { name: '区间收益%', type: 'line', smooth: true, symbol: 'none', yAxisIndex: 1, lineStyle: { width: 2, type: 'dashed' }, data: metrics.points.map((point) => point.cumulativeReturn) },
      { name: '回撤%', type: 'line', smooth: true, symbol: 'none', yAxisIndex: 1, areaStyle: { opacity: 0.08 }, data: metrics.points.map((point) => point.drawdown) },
    ],
  };

  return (
    <div className="mt-5 rounded-[1.4rem] bg-[#fffaf0]/70 p-3" data-testid="fund-chart" aria-label="历史净值研究图">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-ink/70">
          <span>区间收益 <strong className={metrics.summary.totalReturn >= 0 ? 'text-[var(--bull)]' : 'text-[var(--bear)]'}>{metrics.summary.totalReturn.toFixed(2)}%</strong></span>
          <span>最大回撤 <strong className="text-[var(--bear)]">{metrics.summary.maxDrawdown.toFixed(2)}%</strong></span>
          <span>最新净值 <strong>{metrics.summary.latestNetValue.toFixed(4)}</strong></span>
        </div>
        <div className="flex flex-wrap gap-1">
          {ranges.map((item) => <Button key={item} size="sm" variant={item === range ? 'default' : 'secondary'} onClick={() => setRange(item)}>{item}</Button>)}
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 320, width: '100%' }} notMerge lazyUpdate />
    </div>
  );
}
```

- [ ] **Step 4: Replace chart in FundSearch**

Remove Recharts imports from `frontend/src/components/FundSearch.tsx`, import `FundTrendChart`, and replace lines rendering `LineChart` with:

```tsx
<FundTrendChart history={history} />
```

- [ ] **Step 5: Run chart tests**

Run:
```bash
bun test frontend/src/fundMetrics.test.ts frontend/src/components/components.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit chart implementation**

```bash
git add frontend/src/fundMetrics.ts frontend/src/fundMetrics.test.ts frontend/src/components/FundTrendChart.tsx frontend/src/components/FundSearch.tsx frontend/src/components/components.test.tsx
git commit -m "feat(chart): add echarts fund research chart" -m "🤖 Generated with [Aiden x Claude Code]" -m "Co-Authored-By: Aiden"
```

---

## Phase 3: Structured AI Research Agent

### Task 11: Write pure AI indicator tests

**Files:**
- Create: `backend/fundAnalysis.test.ts`

- [ ] **Step 1: Create failing tests**

Create `backend/fundAnalysis.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildResearchPrompt, computeFundIndicators, normalizeAnalysisReport } from './fundAnalysis';

const history = [
  { date: '2026-01-01', netValue: 1.0 },
  { date: '2026-01-02', netValue: 1.1 },
  { date: '2026-01-03', netValue: 1.05 },
  { date: '2026-01-04', netValue: 1.2 },
];

describe('fund analysis agent helpers', () => {
  it('computes deterministic indicators from fund history', () => {
    expect(computeFundIndicators(history)).toEqual({
      totalReturn: 20,
      maxDrawdown: -4.55,
      shortMomentum: 20,
      volatility: expect.any(Number),
      trendSlope: expect.any(Number),
      sampleSize: 4,
    });
  });

  it('builds a prompt with fund, indicators, history, indices, and an output contract', () => {
    const prompt = buildResearchPrompt({
      fund: { code: '000001', name: '华夏成长混合', netValue: 1.2, quoteDate: '2026-01-04', source: 'test' },
      history,
      indices: [{ code: '000001.SH', name: '上证指数', value: 4098, change: 1, changePercent: 0.1, quoteTime: '2026-01-04 15:00:00' }],
      indicators: computeFundIndicators(history),
    });

    expect(prompt).toContain('华夏成长混合');
    expect(prompt).toContain('maxDrawdown');
    expect(prompt).toContain('scenarios');
    expect(prompt).toContain('不构成投资建议');
  });

  it('normalizes imperfect upstream text into report sections', () => {
    const report = normalizeAnalysisReport('趋势偏强，但需要注意回撤。');

    expect(report.summary).toContain('趋势偏强');
    expect(report.scenarios.length).toBeGreaterThan(0);
    expect(report.disclaimer).toContain('不构成投资建议');
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run:
```bash
bun test backend/fundAnalysis.test.ts
```

Expected: FAIL because `backend/fundAnalysis.ts` does not exist.

### Task 12: Implement AI helper module

**Files:**
- Create: `backend/fundAnalysis.ts`

- [ ] **Step 1: Create helper implementation**

Create `backend/fundAnalysis.ts` with exported types and functions:

```ts
import type { FundHistoryPoint, FundQuote, IndexQuote } from '../shared/types';

export type FundAnalysisIndicators = {
  totalReturn: number;
  maxDrawdown: number;
  shortMomentum: number;
  volatility: number;
  trendSlope: number;
  sampleSize: number;
};

export type FundAnalysisReport = {
  summary: string;
  trend: string;
  risk: string;
  scenarios: Array<{ name: string; probability: 'low' | 'medium' | 'high'; description: string }>;
  watchPoints: string[];
  disclaimer: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function computeFundIndicators(history: FundHistoryPoint[]): FundAnalysisIndicators {
  const first = history[0]?.netValue ?? 0;
  const last = history.at(-1)?.netValue ?? first;
  let high = first;
  let maxDrawdown = 0;
  const returns: number[] = [];
  for (let index = 0; index < history.length; index += 1) {
    const point = history[index];
    high = Math.max(high, point.netValue);
    maxDrawdown = Math.min(maxDrawdown, high ? ((point.netValue - high) / high) * 100 : 0);
    if (index > 0) {
      const previous = history[index - 1].netValue;
      if (previous) returns.push(((point.netValue - previous) / previous) * 100);
    }
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / (returns.length || 1);
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length || 1);
  const recent = history.slice(-5);
  const recentFirst = recent[0]?.netValue ?? first;
  const recentLast = recent.at(-1)?.netValue ?? last;
  return {
    totalReturn: first ? round2(((last - first) / first) * 100) : 0,
    maxDrawdown: round2(maxDrawdown),
    shortMomentum: recentFirst ? round2(((recentLast - recentFirst) / recentFirst) * 100) : 0,
    volatility: round2(Math.sqrt(variance)),
    trendSlope: history.length > 1 ? round2(((last - first) / (history.length - 1)) * 100) : 0,
    sampleSize: history.length,
  };
}

export function buildResearchPrompt(input: { fund: FundQuote; history: FundHistoryPoint[]; indices: IndexQuote[]; indicators: FundAnalysisIndicators }) {
  return `你是谨慎的中国公募基金研究 Agent。请基于数据做情景分析，不构成投资建议。

基金：${input.fund.name} (${input.fund.code})
当前净值/估算：${input.fund.netValue}
报价日期：${input.fund.quoteDate}
数据来源：${input.fund.source}

指标 JSON：${JSON.stringify(input.indicators)}
最近历史净值：${JSON.stringify(input.history.slice(-30))}
市场指数：${JSON.stringify(input.indices)}

请严格按下面 JSON 输出，不要输出 markdown：
{
  "summary": "一句话总结",
  "trend": "结合 totalReturn、shortMomentum、trendSlope 说明趋势",
  "risk": "结合 maxDrawdown、volatility 说明风险",
  "scenarios": [
    {"name":"乐观情景","probability":"low|medium|high","description":"触发条件和表现"},
    {"name":"中性情景","probability":"low|medium|high","description":"触发条件和表现"},
    {"name":"压力情景","probability":"low|medium|high","description":"触发条件和表现"}
  ],
  "watchPoints": ["需要观察的指标或事件"],
  "chartAnnotations": [
    {"label":"图表标注", "description":"为什么标注", "tone":"positive|negative|neutral"}
  ],
  "disclaimer": "不构成投资建议"
}`;
}

export function normalizeAnalysisReport(content: string): FundAnalysisReport {
  try {
    const parsed = JSON.parse(content) as Partial<FundAnalysisReport>;
    return {
      summary: parsed.summary || content,
      trend: parsed.trend || '趋势信息不足，需要结合更长历史净值继续观察。',
      risk: parsed.risk || '风险信息不足，请关注回撤和波动。',
      scenarios: parsed.scenarios?.length ? parsed.scenarios : [{ name: '中性情景', probability: 'medium', description: '维持当前走势，等待更多数据确认。' }],
      watchPoints: parsed.watchPoints?.length ? parsed.watchPoints : ['后续净值变化', '主要指数走势', '最大回撤变化'],
      disclaimer: parsed.disclaimer || '本分析仅供学习参考，不构成投资建议。',
    };
  } catch {
    return {
      summary: content,
      trend: content,
      risk: '请结合最大回撤、波动率和个人风险承受能力审慎判断。',
      scenarios: [{ name: '中性情景', probability: 'medium', description: '当前信息不足以支持单边判断，建议继续观察。' }],
      watchPoints: ['后续净值变化', '主要指数走势', '基金公告和持仓变化'],
      disclaimer: '本分析仅供学习参考，不构成投资建议。',
    };
  }
}
```

- [ ] **Step 2: Run helper tests**

Run:
```bash
bun test backend/fundAnalysis.test.ts
```

Expected: PASS.

### Task 13: Wire AI pipeline into API

**Files:**
- Modify: `backend/api.ts`
- Modify: `backend/api.test.ts`

- [ ] **Step 1: Update backend API test expectations**

In the existing AI test in `backend/api.test.ts`, update expectations to assert:

```ts
expect(body.agent.steps.map((step: { name: string }) => step.name)).toEqual([
  'collect_fund_quote',
  'collect_history',
  'collect_market_context',
  'compute_indicators',
  'build_research_prompt',
  'call_deepseek',
  'normalize_report',
]);
expect(body.agent.indicators).toEqual(expect.objectContaining({ totalReturn: expect.any(Number), maxDrawdown: expect.any(Number) }));
expect(body.report).toEqual(expect.objectContaining({ summary: expect.any(String), risk: expect.any(String), scenarios: expect.any(Array) }));
expect(body.chartAnnotations).toEqual(expect.any(Array));
```

- [ ] **Step 2: Run and verify failure**

Run:
```bash
bun test backend/api.test.ts
```

Expected: FAIL because the API still returns old step names and no structured report.

- [ ] **Step 3: Import helper functions in `backend/api.ts`**

Add:

```ts
import { buildResearchPrompt, computeFundIndicators, normalizeAnalysisReport } from './fundAnalysis';
```

- [ ] **Step 4: Replace `analyzeFund()` internals**

Keep validation and DeepSeek call shape, but change steps to the new names. Use `marketData.getFundHistory(code, '1y')`, compute indicators, build prompt, parse response text, normalize report, and return:

```ts
return json({
  fund,
  agent: { model: 'deepseek-v4-flash', steps, indicators },
  report,
  chartAnnotations,
  analysis: report.summary,
});
```

If parsed JSON has `chartAnnotations`, include it; otherwise default to:

```ts
[{ label: 'AI 观察', description: report.summary, tone: 'neutral' }]
```

- [ ] **Step 5: Run backend AI tests**

Run:
```bash
bun test backend/fundAnalysis.test.ts backend/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit AI backend**

```bash
git add backend/fundAnalysis.ts backend/fundAnalysis.test.ts backend/api.ts backend/api.test.ts
git commit -m "feat(ai): add structured fund research agent" -m "🤖 Generated with [Aiden x Claude Code]" -m "Co-Authored-By: Aiden"
```

### Task 14: Render structured AI report in frontend

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/AnalysisPanel.tsx`
- Modify: frontend tests.

- [ ] **Step 1: Update frontend analysis types**

Add to `frontend/src/types.ts`:

```ts
export type FundAnalysisIndicators = {
  totalReturn: number;
  maxDrawdown: number;
  shortMomentum: number;
  volatility: number;
  trendSlope: number;
  sampleSize: number;
};

export type FundAnalysisReport = {
  summary: string;
  trend: string;
  risk: string;
  scenarios: Array<{ name: string; probability: 'low' | 'medium' | 'high'; description: string }>;
  watchPoints: string[];
  disclaimer: string;
};

export type FundAnalysisResponse = {
  fund: FundQuote;
  agent: {
    model: string;
    steps: Array<{ name: string; status: 'done'; summary: string }>;
    indicators: FundAnalysisIndicators;
  };
  report: FundAnalysisReport;
  chartAnnotations: Array<{ date?: string; label: string; description: string; tone: 'positive' | 'negative' | 'neutral' }>;
  analysis: string;
};
```

Update `frontend/src/api.ts` to import/use this shared type rather than local loose response shape.

- [ ] **Step 2: Add frontend test for structured report rendering**

Mock `api.analyzeFund` to return `report`, `agent.indicators`, and `chartAnnotations`. Assert the UI shows:

```ts
expect(await screen.findByText(/趋势判断/)).toBeInTheDocument();
expect(screen.getByText(/风险提示/)).toBeInTheDocument();
expect(screen.getByText(/观察点/)).toBeInTheDocument();
expect(screen.getByText(/最大回撤/)).toBeInTheDocument();
```

- [ ] **Step 3: Run and verify failure**

Run:
```bash
bun test frontend/src/App.test.tsx frontend/src/components/components.test.tsx
```

Expected: FAIL because AnalysisPanel still renders raw pre only.

- [ ] **Step 4: Update `AnalysisPanel.tsx`**

Render:

- Indicator cards: total return, max drawdown, short momentum, volatility.
- Report cards: summary, trend, risk.
- Scenario list.
- Watch points list.
- Disclaimer.
- Agent steps remain visible.

Use the existing visual style: rounded cards, `market-card`, `paper-button`, `text-paper`.

- [ ] **Step 5: Run frontend AI tests**

Run:
```bash
bun test frontend/src/App.test.tsx frontend/src/components/components.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit frontend AI UI**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/components/AnalysisPanel.tsx frontend/src/App.test.tsx frontend/src/components/components.test.tsx
git commit -m "feat(ai): render structured research report" -m "🤖 Generated with [Aiden x Claude Code]" -m "Co-Authored-By: Aiden"
```

---

## Phase 4: E2E, Docs, and Final Verification

### Task 15: Update E2E test for login, chart, and AI report

**Files:**
- Modify: `tests/fund-flow.spec.ts`

- [ ] **Step 1: Update assertions**

Ensure the E2E flow asserts:

```ts
await expect(page.getByText(/已登录/)).toBeVisible();
await expect(page.getByTestId('fund-chart')).toBeVisible();
await expect(page.getByText(/区间收益/)).toBeVisible();
await expect(page.getByText(/最大回撤/)).toBeVisible();
await expect(page.getByText(/趋势判断/)).toBeVisible();
await expect(page.getByText(/风险提示/)).toBeVisible();
```

- [ ] **Step 2: Run E2E and fix selectors only if needed**

Run:
```bash
bun run test:e2e
```

Expected: PASS.

### Task 16: Update docs

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Update README feature bullets**

Document:

- OTP login now persists sessions and supports logout.
- ECharts research chart includes range controls, return, and drawdown.
- AI agent computes deterministic indicators and returns structured reports.

- [ ] **Step 2: Update deployment notes**

In `docs/deployment.md`, document:

- New D1 migration `0004_user_portfolios.sql`.
- Auth session behavior.
- DeepSeek remains server-side only.

- [ ] **Step 3: Commit docs**

```bash
git add README.md README.en.md docs/deployment.md
git commit -m "docs: update auth chart ai documentation" -m "🤖 Generated with [Aiden x Claude Code]" -m "Co-Authored-By: Aiden"
```

### Task 17: Final verification and push

**Files:**
- All changed files.

- [ ] **Step 1: Run full local parity gate**

Run:
```bash
bun run ci:test
```

Expected: lint, unit/API tests, coverage, build, and E2E all pass.

- [ ] **Step 2: Check clean working tree except intentional commits**

Run:
```bash
git status --short
```

Expected: no unstaged or untracked source changes except `.superpowers/` if visual companion artifacts are intentionally untracked.

- [ ] **Step 3: Push to master only after tests pass**

Run:
```bash
git push origin master
```

- [ ] **Step 4: Verify GitHub Actions success**

Use GitHub API or `gh` if authenticated to confirm latest `Cloudflare Deploy` run for pushed HEAD has:

```text
status=completed
conclusion=success
```

If GitHub access fails, ask the user for the latest Actions log URL and continue debugging until the remote workflow succeeds.

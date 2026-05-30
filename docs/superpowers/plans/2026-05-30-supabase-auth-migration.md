# Supabase Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled Resend OTP login with Supabase Auth email OTP/Magic Link while preserving the top-right profile bar and current fund workspace.

**Architecture:** The frontend owns authentication through Supabase JS (`signInWithOtp`, `getSession`, `onAuthStateChange`, `signOut`). Existing Cloudflare API calls remain for fund/portfolio/AI data; later backend-auth integration can verify Supabase JWT and map `user.id` to D1 portfolios, but this first migration removes the broken custom email delivery requirement from the UI path.

**Tech Stack:** React, TypeScript, Vite, Supabase JS, Vitest, Playwright runtime verification.

---

## File Structure

- Create `frontend/src/supabaseAuth.ts`: wraps Supabase client creation, session conversion, login, logout, and auth state subscription.
- Modify `frontend/src/components/AuthPanel.tsx`: replace custom `/api/auth/challenge` OTP form with Supabase email OTP/Magic Link form.
- Modify `frontend/src/components/Header.tsx`: switch `AuthSessionResponse` import to the new UI auth session type.
- Modify `frontend/src/App.tsx`: initialize session from Supabase, subscribe to auth changes, pass session to Header/AuthPanel, remove custom token logout.
- Modify `frontend/src/App.test.tsx`: mock `supabaseAuth` and assert Supabase wording appears.
- Modify `package.json`: add `@supabase/supabase-js`.
- Create `.env.example`: document `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Tasks

### Task 1: Red test for Supabase Auth UI

**Files:**
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Update mocks and expectations**

Add a mock above `describe('App', ...)`:

```ts
vi.mock('./supabaseAuth', () => ({
  getInitialAuthSession: vi.fn(async () => undefined),
  onAuthSessionChange: vi.fn(() => () => undefined),
  signInWithEmailOtp: vi.fn(async () => undefined),
  signOutSupabase: vi.fn(async () => undefined),
}));
```

Change the auth expectation from:

```ts
expect(container.textContent).toContain('邮箱验证码登录');
```

to:

```ts
expect(container.textContent).toContain('Supabase 邮箱登录');
expect(container.textContent).toContain('发送 Magic Link / OTP');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test -- frontend/src/App.test.tsx
```

Expected: FAIL because `./supabaseAuth` does not exist and/or the UI still renders old custom OTP text.

### Task 2: Add Supabase dependency and auth wrapper

**Files:**
- Modify: `package.json`
- Create: `frontend/src/supabaseAuth.ts`
- Create: `.env.example`

- [ ] **Step 1: Install dependency**

Run:

```bash
bun add @supabase/supabase-js
```

Expected: `package.json` and lockfile include `@supabase/supabase-js`.

- [ ] **Step 2: Create auth wrapper**

Create `frontend/src/supabaseAuth.ts`:

```ts
import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type UiAuthSession = {
  user: {
    id: string;
    provider: string;
    identifier: string;
    displayName: string;
  };
  session: {
    token: string;
    expiresAt: string;
  };
};

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : undefined;

function toUiAuthSession(session: Session | null): UiAuthSession | undefined {
  if (!session?.user) return undefined;
  const email = session.user.email ?? session.user.user_metadata?.email ?? session.user.id;
  const displayName = session.user.user_metadata?.name ?? email;
  return {
    user: {
      id: session.user.id,
      provider: 'supabase',
      identifier: email,
      displayName,
    },
    session: {
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : '',
    },
  };
}

export async function getInitialAuthSession() {
  if (!supabase) return undefined;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return toUiAuthSession(data.session);
}

export function onAuthSessionChange(callback: (session?: UiAuthSession) => void) {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(toUiAuthSession(session)));
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmailOtp(email: string) {
  if (!supabase) throw new Error('Supabase 尚未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function signOutSupabase() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

- [ ] **Step 3: Create env example**

Create `.env.example`:

```env
# Supabase Auth (frontend-safe public values)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Task 3: Wire App and Header to Supabase session

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: Update App imports**

Replace:

```ts
import { api, type AuthSessionResponse } from './api';
```

with:

```ts
import { api } from './api';
import { getInitialAuthSession, onAuthSessionChange, signOutSupabase, type UiAuthSession } from './supabaseAuth';
```

- [ ] **Step 2: Update session state type**

Replace:

```ts
const [session, setSession] = useState<AuthSessionResponse>();
```

with:

```ts
const [session, setSession] = useState<UiAuthSession>();
```

- [ ] **Step 3: Replace custom session initialization**

Inside the first `useEffect`, replace the custom-token block:

```ts
if (api.hasSessionToken()) {
  api.getCurrentUser()
    .then(setSession)
    .catch(() => api.clearSessionToken());
}
```

with:

```ts
getInitialAuthSession().then(setSession).catch(() => setSession(undefined));
const unsubscribe = onAuthSessionChange(setSession);
return unsubscribe;
```

Keep the existing market/trending API calls above it.

- [ ] **Step 4: Update helper signatures**

Replace:

```ts
function handleAuthChange(nextSession?: AuthSessionResponse) {
  setSession(nextSession);
}

async function logout() {
  setAuthPending('logout');
  try {
    await api.logout();
  } catch {
    // Local token still needs to be cleared when the remote session already expired.
  }
  api.clearSessionToken();
  setSession(undefined);
  setAuthPending('idle');
}
```

with:

```ts
function handleAuthChange(nextSession?: UiAuthSession) {
  setSession(nextSession);
}

async function logout() {
  setAuthPending('logout');
  try {
    await signOutSupabase();
  } finally {
    setSession(undefined);
    setAuthPending('idle');
  }
}
```

- [ ] **Step 5: Update Header type import**

In `frontend/src/components/Header.tsx`, replace:

```ts
import type { AuthSessionResponse } from '../api';
```

with:

```ts
import type { UiAuthSession } from '../supabaseAuth';
```

Replace `session?: AuthSessionResponse;` with `session?: UiAuthSession;`.

### Task 4: Replace AuthPanel with Supabase email login

**Files:**
- Modify: `frontend/src/components/AuthPanel.tsx`

- [ ] **Step 1: Update imports and props**

Replace imports:

```ts
import { Code2, LogOut, MailCheck, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { api, type AuthSessionResponse } from '../api';
```

with:

```ts
import { LogOut, MailCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { isSupabaseConfigured, signInWithEmailOtp, signOutSupabase, type UiAuthSession } from '../supabaseAuth';
```

Replace props type with:

```ts
type AuthPanelProps = {
  session?: UiAuthSession;
  onSessionChange: (session?: UiAuthSession) => void;
};
```

Remove `oauthProviders`, `challengeId`, `code`, and `oauthUrl` state.

- [ ] **Step 2: Replace challenge functions**

Replace `startChallenge`, `verifyChallenge`, `logout`, and `loadOAuth` with:

```ts
async function sendMagicLink() {
  const email = identifier.trim();
  if (!email) {
    setError('请先输入邮箱地址');
    return;
  }
  setError(undefined);
  setMessage(undefined);
  setPending('sending');
  try {
    await signInWithEmailOtp(email);
    setMessage(`Supabase 已向 ${email} 发送 Magic Link / OTP，请查收邮箱完成登录。`);
  } catch (event) {
    setError(event instanceof Error ? event.message : '发送登录邮件失败');
  } finally {
    setPending('idle');
  }
}

async function logout() {
  setError(undefined);
  setPending('logout');
  try {
    await signOutSupabase();
    onSessionChange(undefined);
    setMessage('已退出登录。');
  } catch (event) {
    setError(event instanceof Error ? event.message : '退出登录失败');
  } finally {
    setPending('idle');
  }
}
```

- [ ] **Step 3: Replace JSX form**

Use this JSX inside the `<section>`:

```tsx
<div className="section-kicker">账户与身份</div>
<h2 className="font-display mt-2 text-3xl font-black tracking-[-0.04em] text-ink">Supabase 邮箱登录</h2>
<p className="mt-2 text-sm leading-6 text-ink/62">Supabase 托管真实邮件发送、验证码和会话刷新。前端只需要配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。</p>

{!isSupabaseConfigured() && (
  <p className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-3 text-sm font-bold text-[var(--gold-soft)]">
    Supabase 尚未配置：请在 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。
  </p>
)}

<div className="mt-5 grid gap-2 md:grid-cols-[1fr_auto]">
  <input className="newspaper-input" type="email" inputMode="email" autoComplete="email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="name@example.com" aria-label="邮箱地址" />
  <button className="ink-button" onClick={sendMagicLink} disabled={pending === 'sending' || !identifier.trim()}>{pending === 'sending' ? '发送中…' : '发送 Magic Link / OTP'}</button>
</div>

<div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm leading-6 text-[var(--text-muted)]">
  <p className="flex items-center gap-2 font-bold text-[var(--text-strong)]"><ShieldCheck className="h-4 w-4" />登录情况</p>
  <p className="mt-2">{session ? `已登录：${session.user.identifier}` : '未登录：请发送邮箱链接并在邮箱中完成登录。'}</p>
</div>

{session && (
  <button className="paper-button mt-4" onClick={logout} disabled={pending === 'logout'}><LogOut className="h-4 w-4" />{pending === 'logout' ? '退出中…' : '退出登录'}</button>
)}
{message && <p className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--mint)]/20 bg-[var(--mint)]/10 p-3 text-sm font-bold text-[var(--mint)]"><MailCheck className="h-4 w-4" />{message}</p>}
{error && <p className="mt-3 text-sm font-bold text-red-300">{error}</p>}
```

### Task 5: Verify unit test and frontend build

**Files:**
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Run test**

Run:

```bash
bun run test -- frontend/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Build frontend**

Run:

```bash
bunx vite build
```

Expected: PASS.

### Task 6: Runtime verification

**Files:**
- No source changes.

- [ ] **Step 1: Configure Supabase env**

Create `.env` locally with frontend-safe Supabase values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

- [ ] **Step 2: Restart local app**

Run:

```bash
bun run dev
```

Expected: Vite serves `http://localhost:5173/` and API serves `http://localhost:8787/`.

- [ ] **Step 3: Verify visible UI**

Use Playwright to open `http://localhost:5173/`, confirm the page shows:

- `个人信息`
- `未登录`
- `Supabase 邮箱登录`
- `发送 Magic Link / OTP`

- [ ] **Step 4: Send real email**

In the running app, enter a real recipient email and click `发送 Magic Link / OTP`.

Expected: UI shows `Supabase 已向 <email> 发送 Magic Link / OTP，请查收邮箱完成登录。` and Supabase delivers the email.

- [ ] **Step 5: Complete login**

Open the email link in the same browser session.

Expected: Header profile bar updates from `未登录` to the recipient email, and the auth panel shows `已登录：<email>`.

---

## Self-Review

- Spec coverage: The plan replaces self-built email delivery with Supabase Auth, preserves profile bar, and includes runtime real-email verification.
- Placeholder scan: The only user-provided values are Supabase project URL/anon key and recipient email; these are intentionally environment/runtime inputs, not implementation placeholders.
- Type consistency: `UiAuthSession` is defined once in `supabaseAuth.ts` and reused by `App`, `Header`, and `AuthPanel`.

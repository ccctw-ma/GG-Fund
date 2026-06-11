import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';

const TEST_EMAIL = 'login-e2e@example.com';
const TEST_CODE = '184702';
const CHALLENGE_ID = 'challenge-email-login-e2e';
const SESSION_TOKEN = 'session-email-login-e2e';

test('completes the email OTP login flow and captures one success screenshot', async ({ page }, testInfo) => {
  const challengeRequests: Array<{ provider?: string; identifier?: string }> = [];
  const verifyRequests: Array<{ challengeId?: string; code?: string }> = [];

  await page.route('**/api/auth/challenge', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { provider?: string; identifier?: string };
    challengeRequests.push(body);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: CHALLENGE_ID,
        provider: 'email',
        identifier: body.identifier,
        delivery: 'email',
        expiresAt: '2026-06-11T15:42:27.826Z',
      }),
    });
  });

  await page.route('**/api/auth/verify', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { challengeId?: string; code?: string };
    verifyRequests.push(body);
    if (body.challengeId !== CHALLENGE_ID || body.code !== TEST_CODE) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'AUTH_CHALLENGE_INVALID', message: '验证码无效或已过期' } }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'user-email-login-e2e', provider: 'email', identifier: TEST_EMAIL, displayName: TEST_EMAIL },
        session: { token: SESSION_TOKEN, expiresAt: '2026-06-18T15:42:27.826Z' },
      }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    const isSignedIn = route.request().headers().authorization === `Bearer ${SESSION_TOKEN}`;
    await route.fulfill({
      status: isSignedIn ? 200 : 401,
      contentType: 'application/json',
      body: JSON.stringify(isSignedIn
        ? {
          user: { id: 'user-email-login-e2e', provider: 'email', identifier: TEST_EMAIL, displayName: TEST_EMAIL },
          session: { token: SESSION_TOKEN, expiresAt: '2026-06-18T15:42:27.826Z' },
        }
        : { error: { code: 'AUTH_REQUIRED', message: '请先登录' } }),
    });
  });

  await page.route('**/api/market/indices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/market/indices/*/history?*', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/funds/trending', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/portfolio/default', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ portfolio: { id: 'portfolio-email-login-e2e', name: '默认组合' }, holdings: [], watchlist: [] }),
    });
  });

  await page.goto('/login?next=/app#portfolio');
  const loginCard = page.locator('.login-card');

  await expect(loginCard.getByRole('heading', { name: '登录 GG Fund' })).toBeVisible();
  await page.getByLabel('邮箱地址').fill(TEST_EMAIL);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(loginCard).toContainText(`验证码已发送到 ${TEST_EMAIL}，10 分钟内有效。`);
  await expect.poll(() => challengeRequests).toEqual([{ provider: 'email', identifier: TEST_EMAIL }]);

  await page.getByLabel('邮箱验证码').fill(TEST_CODE);
  await page.getByRole('button', { name: '登录' }).click();

  await page.waitForURL('**/app#portfolio');
  await expect.poll(() => verifyRequests).toEqual([{ challengeId: CHALLENGE_ID, code: TEST_CODE }]);
  await expect(page.locator('.profile-card')).toContainText('login-e2@example.com');
  await expect(page.getByRole('button', { name: '账户', exact: true })).toBeVisible();

  const screenshotPath = join(testInfo.outputDir, 'email-login-success.png');
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('email-login-success', { path: screenshotPath, contentType: 'image/png' });
});

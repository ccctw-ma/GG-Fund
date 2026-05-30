import { expect, test } from '@playwright/test';

test('landing routes into the Next workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'GG Fund 中国基金行情' })).toBeVisible();
  await page.getByRole('link', { name: '进入工作台' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: '中国基金行情' })).toBeVisible();
  await expect(page.getByText('智能基金账户').first()).toBeVisible();
});

test('health api responds from the Next app', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ service: 'gg-fund-next-api' });
});

import { expect, test } from '@playwright/test';

test('root redirects directly into the Next workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('基金研究操作系统').first()).toBeVisible();
  await page.getByRole('button', { name: /行情工作台/ }).click();
  await expect(page.getByRole('heading', { name: '中国基金行情' })).toBeVisible();
  await page.getByRole('button', { name: /工具宇宙/ }).click();
  await expect(page.getByRole('heading', { name: '全景工具宇宙' })).toBeVisible();
  await expect(page.getByText('ETF / LOF').first()).toBeVisible();
});

test('health api responds from the Next app', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ service: 'gg-fund-next-api' });
});

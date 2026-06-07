import { expect, test } from '@playwright/test';

test('root redirects directly into the Next workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('基金研究操作系统').first()).toHaveCount(0);
  await expect(page.getByRole('button', { name: /工具宇宙/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '行情', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: '行情', exact: true })).toBeAttached();
  await expect(page.getByRole('heading', { name: '全球指数行情' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '全景工具宇宙' })).toHaveCount(0);
  await expect(page.getByText('ETF / LOF').first()).toHaveCount(0);
});

test('health api responds from the Next app', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ service: 'gg-fund-next-api' });
});

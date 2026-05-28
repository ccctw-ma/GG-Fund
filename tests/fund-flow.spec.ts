import { expect, test } from '@playwright/test';

test('searches a fund, adds a holding, shows portfolio analysis, and exposes export data', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '中国基金行情与持仓分析' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日大盘' })).toBeVisible();

  await page.getByLabel('基金代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('button', { name: /华夏成长混合/ }).click();
  await expect(page.getByRole('heading', { name: '华夏成长混合' })).toBeVisible();

  await page.getByRole('button', { name: '加入持仓' }).click();

  await expect(page.getByRole('heading', { name: '我的持仓分析' })).toBeVisible();
  await expect(page.getByText('华夏成长混合').last()).toBeVisible();
  await expect(page.getByText('当前市值')).toBeVisible();
  await expect(page.getByLabel('导出的本地数据')).toContainText('000001');
});

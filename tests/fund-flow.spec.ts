import { expect, test } from '@playwright/test';

test('searches realtime data, logs in, runs analysis, adds a holding, and exports local data', async ({ page }) => {
  await page.route('**/api/ai/analyze-fund', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-28', source: '天天基金实时估算' },
        analysis: '上涨原因：估算净值走强。风险：注意波动。',
      }),
    });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: '中国基金行情' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日大盘' })).toBeVisible();
  await expect(page.getByText('上证指数')).toBeVisible();
  await expect(page.getByText('3128.42')).toHaveCount(0);

  await page.getByLabel('基金代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('button', { name: /华夏成长混合/ }).click();
  await expect(page.getByRole('heading', { name: '华夏成长混合' })).toBeVisible();
  await expect(page.getByText('实时估算').or(page.getByText('官方净值')).first()).toBeVisible();

  await page.getByLabel('登录标识').fill('octocat');
  await page.getByRole('button', { name: /GitHub/ }).click();
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByText(/已创建 github 会话/)).toBeVisible();

  await page.getByRole('button', { name: /分析 华夏成长混合/ }).click();
  await expect(page.getByText('上涨原因：估算净值走强。')).toBeVisible();

  await page.getByRole('button', { name: '加入持仓' }).click();
  await expect(page.getByRole('heading', { name: '我的持仓分析' })).toBeVisible();
  await expect(page.getByText('当前市值')).toBeVisible();
  await expect(page.getByLabel('导出的本地数据')).toContainText('000001');
});

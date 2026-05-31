import { expect, test } from '@playwright/test';

const validImportData = {
  holdings: [
    {
      id: 'imported-holding-1',
      fundCode: '110022',
      fundName: '易方达消费行业股票',
      shares: 200,
      costAmount: 300,
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-29T00:00:00.000Z',
    },
  ],
  watchlist: [
    {
      fundCode: '000001',
      fundName: '华夏成长混合',
      createdAt: '2026-05-29T00:00:00.000Z',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/ai/analyze-fund', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-28', source: '天天基金实时估算' },
        agent: {
          model: 'deepseek-v4-flash',
          indicators: { totalReturn: 3.2, maxDrawdown: -1.1, shortMomentum: 1.2, volatility: 0.5, trendSlope: 0.1, sampleSize: 8 },
          steps: [
            { name: 'collect_fund_quote', status: 'done', summary: '读取基金行情' },
            { name: 'collect_history', status: 'done', summary: '读取历史净值' },
            { name: 'collect_market_context', status: 'done', summary: '读取行情' },
            { name: 'compute_indicators', status: 'done', summary: '计算收益和回撤' },
            { name: 'build_research_prompt', status: 'done', summary: '构建提示' },
            { name: 'call_deepseek', status: 'done', summary: '生成摘要' },
            { name: 'normalize_report', status: 'done', summary: '规范化报告' },
          ],
        },
        report: {
          summary: '上涨原因：估算净值走强。',
          trend: '趋势判断：震荡向上',
          risk: '风险提示：注意波动。',
          beginnerGuide: {
            riskLevel: 'R3',
            riskExplanation: '风险等级不是收益承诺，要结合波动和最大回撤判断。',
            netValueExplanation: '净值上涨不代表更贵，要结合持仓成本和买入节奏理解。',
            trendExplanation: '市场震荡向上，适合先按计划观察，不必一次性追涨。',
            suggestedAction: '观察等待',
            actionPath: ['先确认资金期限', '再看单只基金权重', '最后决定是否分批操作'],
            suitableFor: ['能承受波动并持续复盘的长期资金'],
            avoid: ['把风险等级当成收益承诺', '单只基金仓位过重时继续追涨'],
          },
          scenarios: [{ name: '中性情景', probability: 'medium', description: '维持震荡' }],
          watchPoints: ['最大回撤'],
          disclaimer: '不构成投资建议',
        },
        chartAnnotations: [{ label: '动量改善', description: '短期净值走强', tone: 'positive' }],
        analysis: '上涨原因：估算净值走强。',
      }),
    });
  });
});

test('searches realtime data, covers reconstructed content, shows current email auth copy, runs agent analysis, renders charts, adds a holding, and exports local data', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('基金研究操作系统').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '全景工具宇宙' })).toBeVisible();
  await expect(page.getByText('基金筛选、对比与诊断').first()).toBeVisible();
  await expect(page.getByText('官方公告与高信任披露').first()).toBeVisible();
  await expect(page.getByText('AKShare / AKTools').first()).toBeVisible();
  await expect(page.getByTestId('banking-hero-card')).toBeVisible();
  await expect(page.getByRole('heading', { name: '中国基金行情' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日大盘' })).toBeVisible();
  await expect(page.locator('#markets')).toContainText('上证指数');
  await expect(page.getByTestId('market-chart').locator('svg')).toBeVisible();
  await expect(page.getByText('3128.42')).toHaveCount(0);

  await page.getByLabel('基金代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('button', { name: /华夏成长混合/ }).click();
  await expect(page.getByRole('heading', { name: '华夏成长混合' })).toBeVisible();
  await expect(page.getByText('实时估算').or(page.getByText('官方净值')).first()).toBeVisible();
  await expect(page.getByTestId('fund-chart')).toBeVisible();
  await expect(page.getByText(/区间收益/)).toBeVisible();
  await expect(page.getByText(/最大回撤/).first()).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Supabase 邮箱登录' })).toBeVisible();
  await expect(page.getByText('未登录：请发送邮箱链接并在邮箱中完成登录。')).toBeVisible();
  await page.getByLabel('邮箱地址').fill('demo@example.com');
  await page.getByRole('button', { name: '发送 Magic Link / OTP' }).click();
  await expect(page.getByText(/Supabase 已向 .* 发送 Magic Link \/ OTP|Supabase 尚未配置，请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY/)).toBeVisible();

  await page.getByRole('button', { name: /分析 华夏成长混合/ }).click();
  await expect(page.getByTestId('agent-steps')).toContainText('compute_indicators');
  await expect(page.getByRole('heading', { name: '趋势判断' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '风险提示' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '观察点' })).toBeVisible();
  await expect(page.getByText('上涨原因：估算净值走强。')).toBeVisible();
  await expect(page.getByText('风险等级不是收益承诺').first()).toBeVisible();
  await expect(page.getByText('单只基金权重').first()).toBeVisible();

  await page.getByRole('button', { name: '加入持仓' }).click();
  await expect(page.getByRole('heading', { name: '我的持仓分析' })).toBeVisible();
  await expect(page.getByText('当前市值')).toBeVisible();
  await expect(page.getByLabel('导出的本地数据')).toContainText('000001');
});

test('imports, exports, and deletes local portfolio data', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('导入 JSON 备份').setInputFiles({
    name: 'portfolio.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(validImportData)),
  });

  await expect(page.locator('#portfolio').getByText('易方达消费行业股票')).toBeVisible();
  await expect(page.getByLabel('导出的本地数据')).toContainText('110022');
  await expect(page.getByText('华夏成长混合 000001')).toBeVisible();

  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('还没有持仓。搜索基金后点击“加入持仓”即可开始分析。')).toBeVisible();
});

test('shows import and fund search errors without breaking the dashboard', async ({ page }) => {
  await page.route('**/api/funds/search?q=bad-query', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: '基金查询服务暂不可用' } }) });
  });

  await page.goto('/');

  await page.getByLabel('导入 JSON 备份').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad json'),
  });
  await expect(page.getByText('导入文件不是有效 JSON')).toBeVisible();

  await page.getByLabel('基金代码或名称').fill('bad-query');
  await page.getByRole('button', { name: '搜索' }).click();
  await expect(page.getByText('基金查询服务暂不可用')).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日大盘' })).toBeVisible();
});

test('toggles watchlist and uses the current email auth button copy', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('基金代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('button', { name: /华夏成长混合/ }).click();

  await page.getByRole('button', { name: '加入自选' }).click();
  await expect(page.locator('#portfolio').getByText('华夏成长混合 000001')).toBeVisible();
  await page.getByRole('button', { name: '移出自选' }).click();
  await expect(page.locator('#portfolio').getByText('华夏成长混合 000001')).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Supabase 邮箱登录' })).toBeVisible();
  await expect(page.getByText('未登录：请发送邮箱链接并在邮箱中完成登录。')).toBeVisible();
  await page.getByLabel('邮箱地址').fill('demo@example.com');
  await page.getByRole('button', { name: '发送 Magic Link / OTP' }).click();
  await expect(page.getByText(/Supabase 已向 .* 发送 Magic Link \/ OTP|Supabase 尚未配置，请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY/)).toBeVisible();
});

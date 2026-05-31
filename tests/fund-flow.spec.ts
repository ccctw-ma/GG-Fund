import { expect, test, type Locator } from '@playwright/test';

type OtpRequestBody = {
  provider?: string;
  identifier?: string;
};

type OtpRequest = {
  body: OtpRequestBody;
};

const marketIndicesFixture = [
  {
    code: '000001.SH',
    name: '上证指数',
    value: 3128.42,
    change: 18.24,
    changePercent: 0.59,
    quoteTime: '2026-05-29 15:00',
  },
  {
    code: '399001.SZ',
    name: '深证成指',
    value: 9876.54,
    change: -24.68,
    changePercent: -0.25,
    quoteTime: '2026-05-29 15:00',
  },
];

const fundQuoteFixture = {
  code: '000001',
  name: '华夏成长混合',
  netValue: 1.235,
  officialNetValue: 1.2286,
  dailyChangePercent: 0.86,
  quoteDate: '2026-05-29',
  estimateTime: '14:35',
  quoteType: 'estimate',
  source: '天天基金实时估算',
};

const fundHistoryFixture = [
  { date: '2025-06-03', netValue: 1.018 },
  { date: '2025-09-02', netValue: 1.067 },
  { date: '2025-12-02', netValue: 1.103 },
  { date: '2026-02-03', netValue: 1.154 },
  { date: '2026-03-31', netValue: 1.189 },
  { date: '2026-04-30', netValue: 1.208 },
  { date: '2026-05-15', netValue: 1.221 },
  { date: '2026-05-29', netValue: 1.235 },
];

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

let otpRequests: OtpRequest[] = [];

async function expectDemoOtpRequest(loginCard: Locator) {
  await expect(loginCard).toContainText('开发环境验证码：123456');
  await expect.poll(() => otpRequests.length).toBe(1);
  await expect.poll(() => otpRequests[0]?.body.identifier).toBe('demo@example.com');
  await loginCard.getByLabel('邮箱验证码').fill('123456');
  await loginCard.getByRole('button', { name: '登录' }).click();
  await expect(loginCard).toContainText('已登录 demo@example.com');
}

test.beforeEach(async ({ page }) => {
  otpRequests = [];

  await page.route('**/api/auth/challenge', async (route) => {
    otpRequests.push({
      body: JSON.parse(route.request().postData() ?? '{}') as OtpRequestBody,
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ challengeId: 'challenge-e2e', provider: 'email', identifier: 'demo@example.com', delivery: 'email', devCode: '123456', expiresAt: '2026-05-31T00:10:00.000Z' }),
    });
  });

  await page.route('**/api/auth/verify', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: 'user-demo', provider: 'email', identifier: 'demo@example.com', displayName: 'demo@example.com' }, session: { token: 'session-e2e', expiresAt: '2026-06-07T00:00:00.000Z' } }),
    });
  });

  await page.route('**/api/market/indices', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(marketIndicesFixture),
    });
  });

  await page.route('**/api/funds/trending', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([fundQuoteFixture]),
    });
  });

  await page.route('**/api/funds/search?q=000001', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([fundQuoteFixture]),
    });
  });

  await page.route('**/api/funds/000001/history?*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(fundHistoryFixture),
    });
  });

  await page.route('**/api/funds/000001', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(fundQuoteFixture),
    });
  });

  await page.route('**/api/ai/analyze-fund', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        fund: { ...fundQuoteFixture },
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

test('searches realtime data, covers reconstructed content, uses deterministic Resend OTP, renders charts, adds a holding, and exports local data', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('基金研究操作系统').first()).toBeVisible();
  await expect(page.getByTestId('banking-hero-card')).toBeVisible();

  await page.getByRole('button', { name: /工具宇宙/ }).click();
  await expect(page.getByRole('heading', { name: '全景工具宇宙' })).toBeVisible();
  await expect(page.getByText('基金筛选、对比与诊断').first()).toBeVisible();
  await expect(page.getByText('官方公告与高信任披露').first()).toBeVisible();
  await expect(page.getByText('AKShare / AKTools').first()).toBeVisible();

  await page.getByRole('button', { name: /行情工作台/ }).click();
  await expect(page.getByRole('heading', { name: '中国基金行情' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日大盘' })).toBeVisible();
  await expect(page.locator('#markets')).toContainText('上证指数');
  await expect(page.locator('#markets')).toContainText('3128.42');
  await expect(page.getByTestId('market-chart').locator('svg')).toBeVisible();

  await page.getByLabel('基金代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('#funds').getByRole('button').filter({ hasText: '华夏成长混合' }).first().click();
  await expect(page.getByRole('heading', { name: '华夏成长混合' })).toBeVisible();
  await expect(page.getByText('实时估算').or(page.getByText('官方净值')).first()).toBeVisible();
  await expect(page.locator('#funds')).toContainText('日涨跌：0.86%');
  await expect(page.locator('#funds')).toContainText('1.2350');
  await expect(page.getByTestId('fund-chart')).toBeVisible();
  await expect(page.getByText(/区间收益/)).toBeVisible();

  const beginnerGuide = page.locator('[aria-labelledby="beginner-guide-title"]');
  await expect(beginnerGuide).toContainText('华夏成长混合 当前净值');
  await expect(beginnerGuide).toContainText('单只基金权重过高时');
  await expect(beginnerGuide).toContainText('风险等级不是收益承诺');

  await page.getByRole('button', { name: '加入持仓' }).click();

  await page.getByRole('button', { name: /组合账户/ }).click();
  await expect(page.getByLabel('导出的本地数据')).toContainText('000001');
  await expect(page.getByRole('heading', { name: '我的持仓分析' })).toBeVisible();
  await expect(page.getByText('当前市值')).toBeVisible();
  await expect(page.locator('.profile-card')).toContainText('未登录');
});

test('imports, exports, and deletes local portfolio data', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /组合账户/ }).click();
  await page.getByLabel('导入 JSON 备份').setInputFiles({
    name: 'portfolio.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(validImportData)),
  });

  await expect(page.getByLabel('导出的本地数据')).toContainText('110022');
  await expect(page.locator('#portfolio').getByText('易方达消费行业股票')).toBeVisible();
  await expect(page.getByText('华夏成长混合 000001')).toBeVisible();

  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('还没有持仓。搜索基金后点击“加入持仓”即可开始分析。')).toBeVisible();
});

test('shows import and fund search errors without breaking the dashboard', async ({ page }) => {
  await page.route('**/api/funds/search?q=bad-query', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: '基金查询服务暂不可用' } }) });
  });

  await page.goto('/');

  await page.getByRole('button', { name: /组合账户/ }).click();
  await page.getByLabel('导入 JSON 备份').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad json'),
  });
  await expect(page.getByText('导入文件不是有效 JSON')).toBeVisible();

  await page.getByRole('button', { name: /行情工作台/ }).click();
  await page.getByLabel('基金代码或名称').fill('bad-query');
  await page.getByRole('button', { name: '搜索' }).click();
  await expect(page.getByText('基金查询服务暂不可用')).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日大盘' })).toBeVisible();
});

test('toggles watchlist and keeps portfolio focused on holdings', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /行情工作台/ }).click();
  await page.getByLabel('基金代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('#funds').getByRole('button').filter({ hasText: '华夏成长混合' }).first().click();

  await page.getByRole('button', { name: '加入自选' }).click();
  await page.getByRole('button', { name: /组合账户/ }).click();
  await expect(page.locator('#portfolio').getByText('华夏成长混合 000001')).toBeVisible();
  await page.getByRole('button', { name: /行情工作台/ }).click();
  await page.getByRole('button', { name: '移出自选' }).click();
  await page.getByRole('button', { name: /组合账户/ }).click();
  await expect(page.locator('#portfolio').getByText('华夏成长混合 000001')).toHaveCount(0);

  await expect(page.getByRole('heading', { name: '我的持仓分析' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resend 邮箱验证码登录' })).toHaveCount(0);
});

test('signs in from the standalone login page with Resend email OTP', async ({ page }) => {
  await page.goto('/login');

  const loginCard = page.locator('.login-card');
  await expect(loginCard.getByRole('heading', { name: '登录 GG Fund' })).toBeVisible();
  await expect(loginCard).toContainText('GG Fund');
  await page.getByLabel('邮箱地址').fill('demo@example.com');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expectDemoOtpRequest(loginCard);
  await expect(loginCard.getByRole('link', { name: '进入组合账户' })).toHaveAttribute('href', '/app#portfolio');
});

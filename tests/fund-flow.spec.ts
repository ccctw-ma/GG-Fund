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
  {
    code: 'NDX.US',
    name: '纳斯达克100',
    value: 25709.43,
    change: -1121.53,
    changePercent: -4.18,
    quoteTime: '2026-06-05 16:00',
  },
  {
    code: 'N225.JP',
    name: '日经225',
    value: 66588.12,
    change: -882.57,
    changePercent: -1.31,
    quoteTime: '2026-06-05 15:00',
  },
  {
    code: 'KS11.KR',
    name: '韩国KOSPI',
    value: 8160.59,
    change: -478.82,
    changePercent: -5.54,
    quoteTime: '2026-06-05 15:00',
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

const indexHistoryFixture = [
  { date: '2026-02-03', netValue: 3010.12 },
  { date: '2026-03-31', netValue: 3055.48 },
  { date: '2026-04-30', netValue: 3098.21 },
  { date: '2026-05-15', netValue: 3112.66 },
  { date: '2026-05-29', netValue: 3128.42 },
];

let otpRequests: OtpRequest[] = [];

async function expectDemoOtpRequest(loginCard: Locator) {
  await expect(loginCard).toContainText('开发环境验证码：123456');
  await expect.poll(() => otpRequests.length).toBe(1);
  await expect.poll(() => otpRequests[0]?.body.identifier).toBe('demo@example.com');
  await loginCard.getByLabel('邮箱验证码').fill('123456');
  await loginCard.getByRole('button', { name: '登录' }).click();
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

  await page.route('**/api/auth/me', async (route) => {
    const isSignedIn = route.request().headers().authorization === 'Bearer session-e2e';
    await route.fulfill({
      status: isSignedIn ? 200 : 401,
      contentType: 'application/json',
      body: JSON.stringify(isSignedIn
        ? { user: { id: 'user-demo', provider: 'email', identifier: 'demo@example.com', displayName: 'demo@example.com' }, session: { token: 'session-e2e', expiresAt: '2026-06-07T00:00:00.000Z' } }
        : { error: { code: 'AUTH_REQUIRED', message: '请先登录' } }),
    });
  });

  await page.route('**/api/market/indices', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(marketIndicesFixture),
    });
  });

  await page.route('**/api/market/indices/*/history?*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(indexHistoryFixture),
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

test('searches realtime data, covers reconstructed content, uses deterministic Resend OTP, renders charts, and adds a holding', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '行情', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('基金研究操作系统').first()).toHaveCount(0);
  await expect(page.getByTestId('banking-hero-card')).toHaveCount(0);

  await expect(page.getByRole('button', { name: /工具宇宙/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '全景工具宇宙' })).toHaveCount(0);
  await expect(page.getByText('基金筛选、对比与诊断').first()).toHaveCount(0);
  await expect(page.getByText('官方公告与高信任披露').first()).toHaveCount(0);
  await expect(page.getByText('AKShare / AKTools').first()).toHaveCount(0);

  await expect(page.getByRole('heading', { name: '行情', exact: true })).toBeAttached();
  await expect(page.getByRole('heading', { name: '全球指数行情' })).toBeVisible();
  await expect(page.locator('#markets')).toContainText('上证指数');
  await expect(page.locator('#markets')).toContainText('纳斯达克100');
  await expect(page.locator('#markets')).toContainText('日经225');
  await expect(page.locator('#markets')).toContainText('韩国KOSPI');
  await expect(page.locator('#markets')).toContainText('3128.42');
  await expect(page.getByTestId('market-chart').getByRole('button', { name: /上证指数/ })).toBeVisible();
  await expect(page.getByTestId('index-chart')).toBeVisible();

  await page.getByLabel('基金、股票代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('#funds').getByRole('button').filter({ hasText: '华夏成长混合' }).first().click();
  await expect(page.getByRole('heading', { name: '华夏成长混合' })).toBeVisible();
  await expect(page.getByText('实时估算').or(page.getByText('官方净值')).first()).toBeVisible();
  await expect(page.locator('#funds')).toContainText('日涨跌：0.86%');
  await expect(page.locator('#funds')).toContainText('1.2350');
  await expect(page.getByTestId('fund-chart')).toBeVisible();
  await expect(page.getByTestId('fund-chart').getByRole('button', { name: '区间收益' })).toBeVisible();

  await expect(page.locator('[aria-labelledby="beginner-guide-title"]')).toHaveCount(0);
  await expect(page.locator('#markets')).toBeVisible();
  await expect(page.locator('#funds')).toBeVisible();

  await page.getByRole('button', { name: '加入持仓' }).click();

  await page.getByRole('button', { name: '账户', exact: true }).click();
  await expect(page.getByRole('button', { name: '返回行情' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '我的持仓分析' })).toBeVisible();
  await expect(page.locator('#portfolio')).toContainText('持仓明细');
  await expect(page.locator('#portfolio')).toContainText(/今日估算收益|最近估算收益/);
  await expect(page.locator('#portfolio')).toContainText('收益日期');
  await expect(page.locator('#portfolio')).toContainText('累计盈亏');
  await expect(page.locator('#portfolio')).toContainText('风险诊断');
  await expect(page.locator('.profile-card')).toContainText('未登录');
});

test('imports and deletes local portfolio data', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '账户', exact: true }).click();
  await expect(page.locator('#settings')).not.toContainText('数据与部署说明');
  await expect(page.locator('#settings')).not.toContainText('本地数据导出');
  await expect(page.locator('#settings')).not.toContainText('导入 JSON 备份');
  await page.getByLabel('上传支付宝持仓文件或图片').setInputFiles({
    name: 'alipay-holdings.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('支付宝 000001 华夏成长混合 1000 1235 默认账本\n支付宝 110022 易方达消费行业股票 200 300 家庭账本'),
  });

  await expect(page.locator('#settings')).toContainText('已读取 alipay-holdings.csv');
  await expect(page.locator('#portfolio')).toContainText('支付宝');
  await expect(page.locator('#portfolio')).toContainText('家庭账本');
  await expect(page.locator('#portfolio')).toContainText('默认账本');
  await expect(page.locator('.yb-holding-row').filter({ hasText: '易方达消费行业股票' })).toBeVisible();

  await page.getByRole('button', { name: '删除' }).first().click();
  await page.getByRole('button', { name: '删除' }).first().click();
  await expect(page.getByText('还没有持仓。搜索基金后点击“加入持仓”即可开始分析。')).toBeVisible();
});

test('shows fund search errors without breaking the dashboard', async ({ page }) => {
  await page.route('**/api/funds/search?q=bad-query', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: '基金查询服务暂不可用' } }) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '行情', exact: true }).click();
  await page.getByLabel('基金、股票代码或名称').fill('bad-query');
  await page.getByRole('button', { name: '搜索' }).click();
  await expect(page.getByText('基金查询服务暂不可用')).toBeVisible();
  await expect(page.getByRole('heading', { name: '全球指数行情' })).toBeVisible();
});

test('toggles watchlist and keeps portfolio focused on holdings', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '行情', exact: true }).click();
  await page.getByLabel('基金、股票代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('#funds').getByRole('button').filter({ hasText: '华夏成长混合' }).first().click();

  await page.getByRole('button', { name: '加入自选' }).click();
  await page.getByRole('button', { name: '账户', exact: true }).click();
  await expect(page.locator('#portfolio').getByText('华夏成长混合 000001')).toBeVisible();
  await page.getByRole('button', { name: '行情', exact: true }).click();
  await page.getByRole('button', { name: '移出自选' }).click();
  await page.getByRole('button', { name: '账户', exact: true }).click();
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
  await page.waitForURL('**/app#portfolio');
  await expect(page.locator('.profile-card')).toContainText('demo@');
});

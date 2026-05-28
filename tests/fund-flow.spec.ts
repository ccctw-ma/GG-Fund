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
  let lastAuthProvider = 'email';
  let lastIdentifier = 'demo@example.com';
  await page.route('**/api/auth/challenge', async (route) => {
    const payload = JSON.parse(route.request().postData() ?? '{}') as { provider?: string; identifier?: string };
    lastAuthProvider = payload.provider ?? 'email';
    lastIdentifier = payload.identifier ?? 'demo@example.com';
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ challengeId: 'challenge_e2e', provider: payload.provider ?? 'email', identifier: payload.identifier ?? 'demo@example.com', delivery: payload.provider ?? 'email', devCode: '123456', expiresAt: '2026-05-28T12:00:00.000Z' }) });
  });
  await page.route('**/api/auth/verify', async (route) => {
    await route.fulfill({ contentType: 'application/json', status: 201, body: JSON.stringify({ user: { id: 'user_e2e', provider: lastAuthProvider, identifier: lastIdentifier, displayName: lastIdentifier }, session: { token: 'session_e2e', expiresAt: '2026-06-28T12:00:00.000Z' } }) });
  });
  await page.route('**/api/auth/oauth-url?provider=github&redirect=/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ provider: 'github', authUrl: 'https://github.com/login/oauth/authorize?client_id=test', configured: true, callback: 'https://example.com/api/auth/oauth-callback' }) });
  });
  await page.route('**/api/auth/oauth-url?provider=wechat&redirect=/', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ provider: 'wechat', authUrl: 'https://open.weixin.qq.com/connect/qrconnect?client_id=test', configured: true, callback: 'https://example.com/api/auth/oauth-callback' }) });
  });
  await page.route('**/api/ai/analyze-fund', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-28', source: '天天基金实时估算' },
        agent: { model: 'deepseek-v4-flash', steps: [
          { name: 'collect_market_context', status: 'done', summary: '读取行情' },
          { name: 'evaluate_price_action', status: 'done', summary: '评估动量' },
          { name: 'generate_research_prompt', status: 'done', summary: '构建提示' },
          { name: 'call_deepseek', status: 'done', summary: '生成摘要' },
        ] },
        analysis: '上涨原因：估算净值走强。风险：注意波动。',
      }),
    });
  });
});

test('searches realtime data, uses OTP auth, runs agent analysis, renders charts, adds a holding, and exports local data', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '中国基金行情' })).toBeVisible();
  await expect(page.getByText('数字私人银行驾驶舱')).toBeVisible();
  await expect(page.getByTestId('banking-hero-card')).toBeVisible();
  await expect(page.getByTestId('trust-rail')).toContainText('D1/KV');
  await expect(page.getByRole('heading', { name: '今日大盘' })).toBeVisible();
  await expect(page.locator('#markets')).toContainText('上证指数');
  await expect(page.getByTestId('market-chart').locator('svg')).toBeVisible();
  await expect(page.getByText('3128.42')).toHaveCount(0);

  await page.getByLabel('基金代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('button', { name: /华夏成长混合/ }).click();
  await expect(page.getByRole('heading', { name: '华夏成长混合' })).toBeVisible();
  await expect(page.getByText('实时估算').or(page.getByText('官方净值')).first()).toBeVisible();
  await expect(page.getByTestId('fund-chart').locator('svg')).toBeVisible();

  await page.getByLabel('登录标识').fill('demo@example.com');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByText(/开发环境验证码/)).toBeVisible();
  await page.getByRole('button', { name: '验证登录' }).click();
  await expect(page.getByText(/已通过 email 登录/)).toBeVisible();
  await page.getByRole('button', { name: /GitHub OAuth/ }).click();
  await expect(page.getByText(/github.com\/login\/oauth\/authorize/)).toBeVisible();

  await page.getByRole('button', { name: /分析 华夏成长混合/ }).click();
  await expect(page.getByTestId('agent-steps')).toContainText('collect_market_context');
  await expect(page.getByText('上涨原因：估算净值走强。')).toBeVisible();

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

test('toggles watchlist and supports phone OTP plus WeChat OAuth metadata', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('基金代码或名称').fill('000001');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.getByRole('button', { name: /华夏成长混合/ }).click();

  await page.getByRole('button', { name: '加入自选' }).click();
  await expect(page.locator('#portfolio').getByText('华夏成长混合 000001')).toBeVisible();
  await page.getByRole('button', { name: '移出自选' }).click();
  await expect(page.locator('#portfolio').getByText('华夏成长混合 000001')).toHaveCount(0);

  await page.getByRole('button', { name: '短信验证码' }).click();
  await page.getByLabel('登录标识').fill('13800000000');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByText(/开发环境验证码：123456/)).toBeVisible();
  await page.getByRole('button', { name: '验证登录' }).click();
  await expect(page.getByText(/已通过 phone 登录/)).toBeVisible();

  await page.getByRole('button', { name: '微信扫码' }).click();
  await expect(page.getByText(/open\.weixin\.qq\.com\/connect\/qrconnect/)).toBeVisible();
});

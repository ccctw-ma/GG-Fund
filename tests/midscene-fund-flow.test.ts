import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { PlaywrightAgent } from '@midscene/web/playwright';

const hasModelConfig = Boolean(
  (process.env.MIDSCENE_MODEL_NAME && process.env.MIDSCENE_MODEL_API_KEY)
  || process.env.OPENAI_API_KEY,
);
const shouldRunAiAction = hasModelConfig && process.env.MIDSCENE_RUN_AI === '1';
const hasLocalServer = process.env.MIDSCENE_LOCAL_SERVER === '1';

describe('Midscene setup', () => {
  it.skipIf(!hasModelConfig)('has model credentials configured so Midscene UI flows can actually run', () => {
    expect(hasModelConfig, 'Set MIDSCENE_MODEL_NAME and MIDSCENE_MODEL_API_KEY, or OPENAI_API_KEY, before running Midscene UI tests').toBe(true);
  });

  it('loads PlaywrightAgent for natural-language web automation', () => {
    expect(PlaywrightAgent).toBeTypeOf('function');
  });
});

describe('Midscene fund dashboard flow', () => {
  let browser: Browser;
  let page: Page;
  let agent: PlaywrightAgent;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ baseURL: 'http://localhost:5173' });
    agent = new PlaywrightAgent(page, {
      aiActionContext: 'You are a Web UI testing expert who understands Chinese fintech dashboards.',
    });

    await page.route('**/api/auth/challenge', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ challengeId: 'challenge_midscene', provider: 'email', identifier: 'demo@example.com', delivery: 'email', devCode: '123456', expiresAt: '2026-05-29T12:00:00.000Z' }) });
    });
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ contentType: 'application/json', status: 201, body: JSON.stringify({ user: { id: 'user_midscene', provider: 'email', identifier: 'demo@example.com', displayName: 'demo@example.com' }, session: { token: 'session_midscene', expiresAt: '2026-06-29T12:00:00.000Z' } }) });
    });
    await page.route('**/api/ai/analyze-fund', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', source: '天天基金实时估算' },
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
  }, 30_000);

  afterAll(async () => {
    await agent?.destroy();
    await browser?.close();
  });

  it.skipIf(!hasLocalServer)('opens the local app with Playwright while Midscene agent is initialized', async () => {
    await page.goto('/');

    await expect(page.locator('body').textContent()).resolves.toContain('数字私人银行驾驶舱');
    expect(agent).toBeInstanceOf(PlaywrightAgent);
  });

  it.skipIf(!shouldRunAiAction)('uses natural language to verify the live fund dashboard shell', async () => {
    await page.goto('/');

    await agent.aiAct('verify the page shows the Chinese GG Fund dashboard, including the digital private banking hero, fund search, login, AI analysis, and portfolio sections');
  }, 180_000);
});

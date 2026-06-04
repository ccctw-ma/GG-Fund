import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const fund = { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', quoteType: 'estimate' as const, source: 'test' };

vi.mock('./api', () => ({
  api: {
    getIndices: vi.fn(async () => [{ code: '000001.SH', name: '上证指数', value: 4098.64, change: 4.91, changePercent: 0.12, quoteTime: '2026-05-29 15:00:00' }]),
    getCachedIndices: vi.fn(() => undefined),
    getIndexHistory: vi.fn(async () => [{ date: '2026-05-29', netValue: 4098.64 }]),
    getCachedIndexHistory: vi.fn(() => undefined),
    getTrendingFunds: vi.fn(async () => [fund]),
    getCachedTrendingFunds: vi.fn(() => undefined),
    searchFunds: vi.fn(async () => [fund]),
    getCachedSearchFunds: vi.fn(() => undefined),
    getFund: vi.fn(async () => fund),
    getCachedFund: vi.fn(() => undefined),
    getFundHistory: vi.fn(async () => [{ date: '2026-05-29', netValue: 1.35 }]),
    getCachedFundHistory: vi.fn(() => undefined),
    getFundIntraday: vi.fn(async () => []),
    getCachedFundIntraday: vi.fn(() => undefined),
    getFundHoldings: vi.fn(async () => ({ reportDate: '2026-03-31', stocks: [] })),
    getCachedFundHoldings: vi.fn(() => undefined),
    syncPortfolio: vi.fn(async () => ({})),
    hasSessionToken: vi.fn(() => false),
    getCurrentUser: vi.fn(async () => undefined),
    logout: vi.fn(),
    saveSessionToken: vi.fn(),
    clearSessionToken: vi.fn(),
    startAuthChallenge: vi.fn(),
    verifyAuthChallenge: vi.fn(),
    getOAuthUrl: vi.fn(),
  },
}));

describe('App', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  function clickButton(label: string) {
    const button = Array.from(container?.querySelectorAll('button') ?? []).find((item) => item.textContent?.includes(label));
    expect(button).toBeDefined();
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    localStorage.clear();
  });

  it('renders the redesigned fund landing page and live workspace', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<App />);
    });

    expect(container.textContent).toContain('基金研究操作系统');
    expect(container.textContent).toContain('智能基金账户');
    expect(container.textContent).toContain('账户总览');
    expect(container.textContent).toContain('交易与基金工具');
    expect(container.textContent).not.toContain('工具宇宙');
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('总览');

    clickButton('行情工作台');
    expect(container.textContent).toContain('中国基金行情');
    expect(container.textContent).toContain('四大指数行情');
    expect(container.textContent).toContain('金融资产搜索');
    expect(container.textContent).not.toContain('基金小白决策地图');
    expect(container.textContent).not.toContain('查看组合');

    expect(container.textContent).not.toContain('登录设置');
    expect(container.textContent).not.toContain('个人信息');
    expect(container.textContent).not.toContain('右侧登录状态');
    expect(container.textContent).not.toContain('智能投研');
    clickButton('组合账户');
    expect(container.textContent).not.toContain('安全与隐私');
    expect(container.textContent).not.toContain('下载移动端');
    expect(container.textContent).not.toContain('移动端');
    expect(container.textContent).toContain('未登录');
    expect(container.textContent).not.toContain('Resend 邮箱验证码登录');
    expect(container.textContent).not.toContain('发送验证码');
    expect(container.textContent).not.toContain('OTP / OAuth 登录');
    expect(container.textContent).toContain('组合账户');
    expect(container.textContent).toContain('自选基金');

    clickButton('总览');
    const heroSection = container.querySelector('.landing-hero');
    const heroTitle = container.querySelector('#hero-title');
    expect(heroSection?.getAttribute('aria-labelledby')).toBe('hero-title');
    expect(heroSection?.getAttribute('aria-label')).toBeNull();
    expect(heroTitle?.textContent).toContain('基金研究操作系统');
  });

  it('hydrates without mismatching locally cached holdings', async () => {
    localStorage.setItem('gg-fund:holdings', JSON.stringify([{
      id: 'holding-1',
      fundCode: fund.code,
      fundName: fund.name,
      shares: 1000,
      costAmount: 2000,
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-29T00:00:00.000Z',
    }]));
    const hydrationContainer = document.createElement('div');
    hydrationContainer.innerHTML = renderToString(<App />);
    container = hydrationContainer;
    document.body.appendChild(hydrationContainer);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      root = hydrateRoot(hydrationContainer, <App />);
      await Promise.resolve();
    });

    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('Hydration failed'))).toBe(false);
    errorSpy.mockRestore();
  });
});

import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { api } from './api';

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
    getDefaultPortfolio: vi.fn(async () => ({ portfolio: null, holdings: [], watchlist: [] })),
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

vi.mock('echarts-for-react', () => ({
  default: () => null,
}));

describe('App', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  async function renderApp(props?: { initialData?: Parameters<typeof App>[0]['initialData'] }) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<App initialData={props?.initialData} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    return container;
  }

  function clickButton(label: string) {
    const button = Array.from(container?.querySelectorAll('button') ?? []).find((item) => item.textContent?.includes(label));
    expect(button).toBeDefined();
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  afterEach(() => {
    vi.useRealTimers();
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.clearAllMocks();
  });

  it('renders the market page first and keeps account navigation focused', async () => {
    const view = await renderApp();

    expect(view.textContent).toContain('行情');
    expect(view.textContent).toContain('全球指数行情');
    expect(view.textContent).toContain('金融资产搜索');
    expect(view.textContent).not.toContain('基金研究操作系统');
    expect(view.textContent).not.toContain('账户总览');
    expect(view.textContent).not.toContain('交易与基金工具');
    expect(view.textContent).not.toContain('工具宇宙');
    expect(view.querySelector('[aria-current="page"]')?.textContent).toContain('行情');
    expect(view.textContent).not.toContain('基金小白决策地图');
    expect(view.textContent).not.toContain('查看组合');

    expect(view.textContent).not.toContain('登录设置');
    expect(view.textContent).not.toContain('个人信息');
    expect(view.textContent).not.toContain('右侧登录状态');
    expect(view.textContent).not.toContain('智能投研');
    clickButton('账户');
    expect(view.textContent).not.toContain('安全与隐私');
    expect(view.textContent).not.toContain('下载移动端');
    expect(view.textContent).not.toContain('移动端');
    expect(view.textContent).toContain('未登录');
    expect(view.textContent).not.toContain('Resend 邮箱验证码登录');
    expect(view.textContent).not.toContain('发送验证码');
    expect(view.textContent).not.toContain('OTP / OAuth 登录');
    expect(view.textContent).toContain('账户');
    expect(view.textContent).toContain('自选基金');
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

  it('loads the authenticated portfolio before syncing local state', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValueOnce({
      user: { id: 'user-1', provider: 'email', identifier: 'test@example.com', displayName: 'test@example.com' },
      session: { token: 'session_test', expiresAt: '2026-06-30T00:00:00.000Z' },
    });
    vi.mocked(api.getDefaultPortfolio).mockResolvedValueOnce({
      portfolio: { id: 'portfolio-1', name: '默认组合', createdAt: '2026-05-29T00:00:00.000Z', updatedAt: '2026-05-29T00:00:00.000Z' },
      holdings: [{
        id: 'remote-holding-1',
        fundCode: fund.code,
        fundName: fund.name,
        shares: 1000,
        costAmount: 2000,
        createdAt: '2026-05-29T00:00:00.000Z',
        updatedAt: '2026-05-29T00:00:00.000Z',
      }],
      watchlist: [{ fundCode: '110022', fundName: '易方达消费行业股票', createdAt: '2026-05-29T00:00:00.000Z' }],
    });
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<App />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.getDefaultPortfolio).toHaveBeenCalledTimes(1);
    expect(api.syncPortfolio).not.toHaveBeenCalled();
    expect(localStorage.getItem('gg-fund:holdings')).toContain('remote-holding-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(api.syncPortfolio).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'remote-holding-1', fundCode: fund.code })],
      [expect.objectContaining({ fundCode: '110022' })],
    );
    vi.useRealTimers();
  });

  it('logs out authenticated users from the header', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValueOnce({
      user: { id: 'user-2', provider: 'email', identifier: 'logout@example.com', displayName: 'logout@example.com' },
      session: { token: 'session_logout', expiresAt: '2026-06-30T00:00:00.000Z' },
    });
    vi.mocked(api.getDefaultPortfolio).mockResolvedValueOnce({ portfolio: null, holdings: [], watchlist: [] });

    const view = await renderApp();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.textContent).toContain('logout');
    const logoutButton = view.querySelector<HTMLButtonElement>('button[aria-label="退出登录"]');
    await act(async () => {
      logoutButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(api.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(view.textContent).toContain('未登录');
  });
});

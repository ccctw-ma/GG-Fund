import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const fund = { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', quoteType: 'estimate' as const, source: 'test' };

vi.mock('./api', () => ({
  api: {
    getIndices: vi.fn(async () => [{ code: '000001.SH', name: '上证指数', value: 4098.64, change: 4.91, changePercent: 0.12, quoteTime: '2026-05-29 15:00:00' }]),
    getTrendingFunds: vi.fn(async () => [fund]),
    searchFunds: vi.fn(async () => [fund]),
    getFund: vi.fn(async () => fund),
    getFundHistory: vi.fn(async () => [{ date: '2026-05-29', netValue: 1.35 }]),
    hasSessionToken: vi.fn(() => false),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    saveSessionToken: vi.fn(),
    clearSessionToken: vi.fn(),
    analyzeFund: vi.fn(async () => ({
      fund,
      agent: { model: 'deepseek-v4-flash', indicators: { totalReturn: 3.2, maxDrawdown: -1.1, shortMomentum: 1.2, volatility: 0.5, trendSlope: 0.1, sampleSize: 8 }, steps: [{ name: 'compute_indicators', status: 'done', summary: '计算指标' }] },
      report: { summary: '趋势偏强', trend: '趋势判断：震荡向上', risk: '风险提示：注意回撤', scenarios: [{ name: '中性情景', probability: 'medium', description: '维持震荡' }], watchPoints: ['最大回撤'], disclaimer: '不构成投资建议' },
      chartAnnotations: [],
      analysis: '趋势偏强',
    })),
    startAuthChallenge: vi.fn(),
    verifyAuthChallenge: vi.fn(),
    getOAuthUrl: vi.fn(),
  },
}));

vi.mock('./supabaseAuth', () => ({
  getInitialAuthSession: vi.fn(async () => undefined),
  onAuthSessionChange: vi.fn(() => () => undefined),
  signInWithEmailOtp: vi.fn(async () => undefined),
  signOutSupabase: vi.fn(async () => undefined),
  isSupabaseConfigured: vi.fn(() => false),
}));

describe('App', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

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

    expect(container.textContent).toContain('智能基金账户');
    expect(container.textContent).toContain('账户总览');
    expect(container.textContent).toContain('交易与基金工具');
    expect(container.textContent).not.toContain('安全与隐私');
    expect(container.textContent).not.toContain('下载移动端');
    expect(container.textContent).not.toContain('移动端');
    expect(container.textContent).toContain('个人信息');
    expect(container.textContent).toContain('未登录');
    expect(container.textContent).toContain('Supabase 邮箱登录');
    expect(container.textContent).toContain('发送 Magic Link / OTP');
    expect(container.textContent).toContain('中国基金行情');
    expect(container.textContent).not.toContain('OTP / OAuth 登录');
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

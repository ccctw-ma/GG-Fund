import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
    analyzeFund: vi.fn(async () => ({ fund, analysis: '风险：注意波动。' })),
    startAuthChallenge: vi.fn(),
    verifyAuthChallenge: vi.fn(),
    getOAuthUrl: vi.fn(),
  },
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

  it('renders the Cloudflare-first fund dashboard shell', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<App />);
    });

    expect(container.textContent).toContain('数字私人银行驾驶舱');
    expect(container.textContent).toContain('中国基金行情');
    expect(container.textContent).toContain('Cloudflare D1/KV 数据层');
  });
});

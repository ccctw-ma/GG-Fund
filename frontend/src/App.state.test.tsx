import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FundQuote } from './types';

const mockApi = vi.hoisted(() => ({
  getCachedIndices: vi.fn(),
  getIndices: vi.fn(),
  getCachedTrendingFunds: vi.fn(),
  getTrendingFunds: vi.fn(),
  getCachedIndexHistory: vi.fn(),
  getIndexHistory: vi.fn(),
  getCurrentUser: vi.fn(),
  getDefaultPortfolio: vi.fn(),
  syncPortfolio: vi.fn(),
  getCachedSearchFunds: vi.fn(),
  searchFunds: vi.fn(),
  getCachedFund: vi.fn(),
  getCachedFundHistory: vi.fn(),
  getCachedFundHoldings: vi.fn(),
  getFund: vi.fn(),
  getFundHistory: vi.fn(),
  getFundHoldings: vi.fn(),
  logout: vi.fn(),
  clearSessionToken: vi.fn(),
  getFundIntraday: vi.fn(),
  getCachedFundIntraday: vi.fn(),
  saveSessionToken: vi.fn(),
  startAuthChallenge: vi.fn(),
  verifyAuthChallenge: vi.fn(),
  getOAuthUrl: vi.fn(),
}));

vi.mock('./api', () => ({ api: mockApi }));

vi.mock('./components/Header', () => ({
  Header: (props: {
    session?: { user: { identifier: string } };
    onLogout: () => void;
    onPageChange: (page: 'workspace' | 'portfolio') => void;
    activePage: 'workspace' | 'portfolio';
  }) => (
    <header>
      <span data-testid="active-page">{props.activePage}</span>
      <span data-testid="session">{props.session?.user.identifier ?? 'anonymous'}</span>
      <button type="button" onClick={() => props.onPageChange('workspace')}>mock-market</button>
      <button type="button" onClick={() => props.onPageChange('portfolio')}>mock-account</button>
      <button type="button" onClick={props.onLogout}>mock-logout</button>
    </header>
  ),
}));

vi.mock('./components/MarketOverview', () => ({
  MarketOverview: (props: { error?: string; indices: Array<{ name: string }> }) => (
    <section data-testid="market-overview">
      {props.error}
      {props.indices.map((index) => <span key={index.name}>{index.name}</span>)}
    </section>
  ),
}));

vi.mock('./components/FundSearch', () => ({
  FundSearch: (props: {
    results: FundQuote[];
    selectedFund?: FundQuote;
    error?: string;
    onSearch: () => void;
    onSelect: (code: string, options?: { preferCached?: boolean }) => void;
    onAddHolding: (fund: FundQuote) => void;
    onToggleWatch: (fund: FundQuote) => void;
  }) => (
    <section data-testid="fund-search">
      <span data-testid="fund-error">{props.error}</span>
      <span data-testid="selected-fund">{props.selectedFund?.name ?? 'none'}</span>
      <button type="button" onClick={props.onSearch}>mock-search</button>
      {props.results.map((fund) => (
        <button type="button" key={fund.code} onClick={() => props.onSelect(fund.code)}>
          select-{fund.code}
        </button>
      ))}
      {props.selectedFund && <button type="button" onClick={() => props.onAddHolding(props.selectedFund!)}>mock-add</button>}
      {props.selectedFund && <button type="button" onClick={() => props.onToggleWatch(props.selectedFund!)}>mock-watch</button>}
    </section>
  ),
}));

const portfolioPropsLog = vi.hoisted(() => ({
  latest: undefined as undefined | {
    summary: { items: Array<{ id: string; fundCode: string; fundName: string }> };
    watchlist: unknown[];
    onRefreshQuotes: () => void | Promise<void>;
    onRemoveHolding: (id: string) => void;
    onUpdateHolding: (id: string, patch: { recordedMarketValue: number; costAmount: number }) => void;
    onEditIdentity?: (id: string, patch: { fundCode: string; fundName: string }) => void;
  },
}));

vi.mock('./components/PortfolioPanel', () => ({
  PortfolioPanel: (props: NonNullable<typeof portfolioPropsLog.latest>) => {
    portfolioPropsLog.latest = props;
    return (
      <section data-testid="portfolio-panel">
        <span data-testid="holding-count">{props.summary.items.length}</span>
        <span data-testid="watch-count">{props.watchlist.length}</span>
        {props.summary.items.map((item) => <span key={item.id}>{item.fundName}</span>)}
        <button type="button" onClick={() => void props.onRefreshQuotes()}>mock-refresh</button>
        <button type="button" onClick={() => props.onRemoveHolding(props.summary.items[0]?.id ?? 'missing')}>mock-remove</button>
        <button type="button" onClick={() => props.onUpdateHolding(props.summary.items[0]?.id ?? 'missing', { recordedMarketValue: 1234, costAmount: 1000 })}>mock-update</button>
        <button type="button" onClick={() => props.onEditIdentity?.(props.summary.items[0]?.id ?? 'missing', { fundCode: '110022', fundName: '易方达消费行业股票' })}>mock-edit-identity</button>
        <button type="button" onClick={() => props.onEditIdentity?.(props.summary.items[0]?.id ?? 'missing', { fundCode: '', fundName: '自动补全基金' })}>mock-auto-identity</button>
      </section>
    );
  },
}));

vi.mock('./components/SettingsPanel', () => ({
  SettingsPanel: (props: { importError?: string; onImport: (raw: string) => void }) => (
    <section data-testid="settings-panel">
      <span data-testid="import-error">{props.importError}</span>
      <button type="button" onClick={() => props.onImport('bad-json')}>mock-import-bad</button>
      <button type="button" onClick={() => props.onImport(JSON.stringify({
        holdings: [{ id: 'import-1', fundCode: 'ALIPAY001', fundName: '导入基金', recordedMarketValue: 2000, costAmount: 1500, createdAt: '2026-06-09T00:00:00.000Z', updatedAt: '2026-06-09T00:00:00.000Z' }],
        watchlist: [{ fundCode: '110022', fundName: '易方达消费行业股票', createdAt: '2026-06-09T00:00:00.000Z' }],
      }))}>mock-import-good</button>
    </section>
  ),
}));

import App from './App';

const fund: FundQuote = { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-06-09', quoteType: 'estimate', source: 'test' };
const stock: FundQuote = { code: '600519', name: '贵州茅台', assetType: 'stock', netValue: 1668, quoteDate: '2026-06-09', source: 'test-stock' };

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('App state callbacks', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  async function renderApp() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<App />);
    });
    await flush();
    return container;
  }

  beforeEach(() => {
    Object.values(mockApi).forEach((mock) => mock.mockReset());
    mockApi.getCachedIndices.mockReturnValue(undefined);
    mockApi.getCachedTrendingFunds.mockReturnValue(undefined);
    mockApi.getCachedIndexHistory.mockReturnValue(undefined);
    mockApi.getCachedSearchFunds.mockReturnValue(undefined);
    mockApi.getCachedFund.mockReturnValue(undefined);
    mockApi.getCachedFundHistory.mockReturnValue(undefined);
    mockApi.getCachedFundHoldings.mockReturnValue(undefined);
    mockApi.getIndices.mockResolvedValue([]);
    mockApi.getTrendingFunds.mockResolvedValue([]);
    mockApi.getIndexHistory.mockResolvedValue([]);
    mockApi.getCurrentUser.mockRejectedValue(new Error('anonymous'));
    mockApi.getDefaultPortfolio.mockResolvedValue({ portfolio: null, holdings: [], watchlist: [] });
    mockApi.syncPortfolio.mockResolvedValue({});
    mockApi.searchFunds.mockResolvedValue([fund]);
    mockApi.getFund.mockResolvedValue(fund);
    mockApi.getFundHistory.mockResolvedValue([{ date: '2026-06-09', netValue: 1.35 }]);
    mockApi.getFundHoldings.mockResolvedValue({ stocks: [] });
    mockApi.logout.mockResolvedValue({});
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    portfolioPropsLog.latest = undefined;
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('uses cached market/search data and reports fetch failures', async () => {
    mockApi.getCachedIndices.mockReturnValueOnce([{ code: '399001.SZ', name: '深证成指', value: 1, change: 0, changePercent: 0, quoteTime: '2026' }]);
    mockApi.getCachedTrendingFunds.mockReturnValueOnce([{ ...fund, code: '110022', name: '缓存基金' }]);
    mockApi.getCachedIndexHistory.mockReturnValueOnce([{ date: '2026-06-09', netValue: 1 }]);
    mockApi.getIndices.mockRejectedValueOnce(new Error('指数失败'));
    mockApi.searchFunds.mockRejectedValueOnce('bad search');
    mockApi.getCurrentUser.mockRejectedValueOnce(new Error('anonymous'));

    const view = await renderApp();
    expect(view.textContent).toContain('深证成指');
    expect(view.textContent).toContain('指数失败');

    await act(async () => {
      view.querySelector('[data-testid="fund-search"] button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(view.textContent).toContain('基金查询失败');
  });

  it('searches, selects funds and stocks, adds holdings, and toggles watchlist', async () => {
    mockApi.getIndices.mockResolvedValue([]);
    mockApi.getTrendingFunds.mockResolvedValue([]);
    mockApi.getIndexHistory.mockResolvedValue([]);
    mockApi.getCurrentUser.mockRejectedValue(new Error('anonymous'));
    mockApi.searchFunds.mockResolvedValueOnce([stock]).mockResolvedValueOnce([fund]);
    mockApi.getFund.mockResolvedValueOnce(stock).mockResolvedValue(fund);
    mockApi.getFundHistory.mockResolvedValue([{ date: '2026-06-09', netValue: 1.35 }]);
    mockApi.getFundHoldings.mockResolvedValue({ stocks: [] });

    const view = await renderApp();
    await act(async () => {
      view.querySelector('[data-testid="fund-search"] button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(view.textContent).toContain('贵州茅台');
    expect(mockApi.getFundHoldings).not.toHaveBeenCalledWith('600519');

    await act(async () => {
      view.querySelector('[data-testid="fund-search"] button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockApi.searchFunds).toHaveBeenCalledTimes(2);

    await act(async () => {
      view.querySelector('[data-testid="fund-search"] button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    const addButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-add');
    const watchButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-watch');
    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      watchButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      watchButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-account')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(portfolioPropsLog.latest?.summary.items.length).toBeGreaterThanOrEqual(1);
    expect(portfolioPropsLog.latest?.watchlist).toHaveLength(0);
  });

  it('imports data, edits holdings, refreshes quotes, and logs out', async () => {
    vi.useFakeTimers();
    mockApi.getCurrentUser.mockResolvedValue({
      user: { id: 'user-1', provider: 'email', identifier: 'me@example.com', displayName: 'me@example.com' },
      session: { token: 'session-1', expiresAt: '2026-06-30T00:00:00.000Z' },
    });
    mockApi.getDefaultPortfolio.mockResolvedValue({ portfolio: null, holdings: [], watchlist: [] });
    mockApi.getIndices.mockResolvedValue([]);
    mockApi.getTrendingFunds.mockResolvedValue([]);
    mockApi.getIndexHistory.mockResolvedValue([]);
    mockApi.getFund.mockResolvedValue({ ...fund, name: '官方基金名' });
    mockApi.getFundHistory.mockResolvedValue([{ date: '2026-06-09', netValue: 1.35 }]);
    mockApi.searchFunds.mockResolvedValue([{ ...fund, code: '110022', name: '自动补全基金官方名' }]);
    mockApi.syncPortfolio.mockResolvedValue({});
    mockApi.logout.mockResolvedValue({});

    const view = await renderApp();
    await act(async () => {
      view.querySelector('button:nth-of-type(2)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      view.querySelector('button:nth-of-type(2)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    const badImport = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-import-bad');
    const goodImport = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-import-good');
    await act(async () => {
      badImport?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(view.textContent).toContain('JSON');

    await act(async () => {
      goodImport?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(view.textContent).toContain('导入基金');

    await act(async () => {
      portfolioPropsLog.latest?.onUpdateHolding('import-1', { recordedMarketValue: 2600, costAmount: 1700 });
      portfolioPropsLog.latest?.onEditIdentity?.('import-1', { fundCode: '110022', fundName: '手动基金' });
      await portfolioPropsLog.latest?.onRefreshQuotes();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(mockApi.getFund).toHaveBeenCalledWith('110022');
    expect(mockApi.syncPortfolio).toHaveBeenCalled();

    await act(async () => {
      portfolioPropsLog.latest?.onEditIdentity?.('import-1', { fundCode: '', fundName: '自动补全基金' });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockApi.searchFunds).toHaveBeenCalledWith('自动补全基金');

    await act(async () => {
      portfolioPropsLog.latest?.onRemoveHolding('import-1');
      await Promise.resolve();
    });
    expect(portfolioPropsLog.latest?.summary.items).toHaveLength(0);

    const logoutButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-logout');
    await act(async () => {
      logoutButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(mockApi.logout).toHaveBeenCalledTimes(1);
    expect(mockApi.clearSessionToken).toHaveBeenCalledTimes(1);
  });

  it('uses cached fund details, handles detail/refresh failures, and tolerates failed backfill', async () => {
    mockApi.getIndices.mockResolvedValue([]);
    mockApi.getTrendingFunds.mockResolvedValue([]);
    mockApi.getIndexHistory.mockResolvedValue([]);
    mockApi.getCurrentUser.mockRejectedValue(new Error('anonymous'));
    mockApi.getCachedSearchFunds.mockReturnValue([{ ...fund, code: '110022', name: '缓存搜索基金' }]);
    mockApi.getCachedFund.mockReturnValue({ ...fund, code: '110022', name: '缓存详情基金' });
    mockApi.getCachedFundHistory.mockReturnValue([{ date: '2026-06-08', netValue: 1.2 }]);
    mockApi.getCachedFundHoldings.mockReturnValue({ reportDate: '2026-03-31', stocks: [] });
    mockApi.searchFunds.mockRejectedValue(new Error('search failed'));
    mockApi.getFund.mockRejectedValue(new Error('detail failed'));
    mockApi.getFundHistory.mockRejectedValue(new Error('history failed'));

    const view = await renderApp();
    await act(async () => {
      view.querySelector('[data-testid="fund-search"] button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.textContent).toContain('缓存详情基金');
    expect(view.textContent).toContain('detail failed');

    await act(async () => {
      Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-account')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    const goodImport = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-import-good');
    await act(async () => {
      goodImport?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(view.textContent).toContain('导入基金');

    await act(async () => {
      await portfolioPropsLog.latest?.onRefreshQuotes();
      portfolioPropsLog.latest?.onEditIdentity?.('missing-id', { fundCode: '', fundName: '不存在基金' });
      await Promise.resolve();
    });

    expect(mockApi.getFund).toHaveBeenCalled();
    expect(view.textContent).toContain('导入基金');
  });

  it('keeps local portfolio data when a signed-in account has no remote snapshot data', async () => {
    localStorage.setItem('gg-fund:holdings', JSON.stringify([{
      id: 'local-holding',
      fundCode: '000001',
      fundName: '本地基金',
      shares: 100,
      costAmount: 120,
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
    }]));
    localStorage.setItem('gg-fund:watchlist', JSON.stringify([{ fundCode: '110022', fundName: '本地自选', createdAt: '2026-06-09T00:00:00.000Z' }]));
    mockApi.getCurrentUser.mockResolvedValue({
      user: { id: 'user-empty', provider: 'email', identifier: 'empty@example.com', displayName: 'empty@example.com' },
      session: { token: 'session-empty', expiresAt: '2026-06-30T00:00:00.000Z' },
    });
    mockApi.getDefaultPortfolio.mockResolvedValue({ portfolio: { id: 'remote-empty' }, holdings: [], watchlist: [] });
    mockApi.getFund.mockResolvedValue(fund);

    const view = await renderApp();
    await flush();
    await act(async () => {
      Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-account')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(portfolioPropsLog.latest?.summary.items[0]?.id).toBe('local-holding');
    expect(portfolioPropsLog.latest?.watchlist).toHaveLength(1);
    expect(mockApi.getDefaultPortfolio).toHaveBeenCalledTimes(1);
  });

  it('keeps local portfolio data and disables sync when remote portfolio loading fails', async () => {
    vi.useFakeTimers();
    localStorage.setItem('gg-fund:holdings', JSON.stringify([{
      id: 'local-holding-fail',
      fundCode: '000001',
      fundName: '加载失败本地基金',
      shares: 100,
      costAmount: 120,
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
    }]));
    mockApi.getCurrentUser.mockResolvedValue({
      user: { id: 'user-fail', provider: 'email', identifier: 'fail@example.com', displayName: 'fail@example.com' },
      session: { token: 'session-fail', expiresAt: '2026-06-30T00:00:00.000Z' },
    });
    mockApi.getDefaultPortfolio.mockRejectedValue(new Error('remote unavailable'));

    const view = await renderApp();
    await flush();
    await act(async () => {
      Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'mock-account')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(portfolioPropsLog.latest?.summary.items[0]?.id).toBe('local-holding-fail');
    expect(mockApi.syncPortfolio).not.toHaveBeenCalled();
  });
});

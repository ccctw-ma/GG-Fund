import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculatePortfolioSummary } from '../portfolio';
import { decisionSteps } from '../decisionSteps';
import type { FundAnalysisResponse, FundQuote } from '../types';
import { BeginnerGuide } from './BeginnerGuide';
import { FundAnalysisPanel } from './FundAnalysisPanel';
import { FundSearch } from './FundSearch';
import { Header } from './Header';
import { ImportConfirmModal } from './ImportConfirmModal';
import { IntradayTrendChart } from './IntradayTrendChart';
import { MarketOverview } from './MarketOverview';
import { PortfolioPanel } from './PortfolioPanel';
import { SettingsPanel, buildFundCodeSearchQueries, buildRecognizedImport, findFundCodeAlias, pickBestFundCodeMatch } from './SettingsPanel';

const mockApi = vi.hoisted(() => ({
  getCachedIndexHistory: vi.fn(),
  getIndexHistory: vi.fn(async () => []),
  getCachedFundHistory: vi.fn(),
  getFundHistory: vi.fn(async () => []),
  getCachedFundHoldings: vi.fn(),
  getFundHoldings: vi.fn(async () => ({ stocks: [] })),
  getCachedFundIntraday: vi.fn(),
  getFundIntraday: vi.fn(async () => [
    { time: '09:30', price: 1.23, average: 1.22, source: '主要持仓加权近似（东方财富持仓 + 腾讯分钟线）', sourceType: 'estimated' },
    { time: '10:00', price: 1.25, average: 1.23, source: '主要持仓加权近似（东方财富持仓 + 腾讯分钟线）', sourceType: 'estimated' },
    { time: '15:00', price: 1.2, average: 1.21, source: '主要持仓加权近似（东方财富持仓 + 腾讯分钟线）', sourceType: 'estimated' },
  ]),
  getFund: vi.fn(async () => null),
  searchFunds: vi.fn(async (query: string) => [
    {
      code: query.includes('电网') ? '012000' : '161725',
      name: query.includes('电网') ? '华夏中证电网设备主题ETF联接C' : '招商中证白酒指数C',
      netValue: 1.23,
      quoteDate: '2026-06-09',
      source: 'test',
    },
  ]),
  analyzeFund: vi.fn(async () => ({
    fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', quoteType: 'estimate' as const, source: 'test' },
    agent: {
      model: 'deepseek-v4-flash',
      steps: [{ name: 'collect_web_research', status: 'done' as const, summary: '联网读取公开材料' }],
      indicators: { totalReturn: 3, maxDrawdown: -2, shortMomentum: 1, volatility: 0.8, trendSlope: 0.1, sampleSize: 20 },
    },
    report: {
      summary: 'AI 判断：成长风格改善。',
      trend: '短期趋势偏强。',
      marketDrivers: '上涨原因来自持仓方向和市场风险偏好修复。',
      outlook: '未来看权益市场风格、基金持仓和回撤变化。',
      risk: '注意波动。',
      beginnerGuide: {
        riskLevel: 'R3' as const,
        riskExplanation: '中等风险',
        netValueExplanation: '结合成本看净值',
        trendExplanation: '不要追涨',
        suggestedAction: '观察等待' as const,
        actionPath: ['观察'],
        suitableFor: ['长期资金'],
        avoid: ['追涨杀跌'],
      },
      scenarios: [{ name: '中性情景', probability: 'medium' as const, description: '震荡观察' }],
      watchPoints: ['最大回撤'],
      sourceNotes: ['公开网页材料'],
      disclaimer: '不构成投资建议',
    },
    chartAnnotations: [],
    researchSources: [{ title: '东方财富基金概况', url: 'https://example.com', summary: '基金经理与持仓摘要' }],
    analysis: 'AI 判断：成长风格改善。',
  })),
  analyzeFundStream: vi.fn(async (_code: string, handlers?: { onStatus?: (message: string) => void; onDelta?: (delta: string) => void }) => {
    handlers?.onStatus?.('DeepSeek 正在逐段生成分析...');
    handlers?.onDelta?.('【核心判断】\nAI 判断：成长风格改善。');
    return ({
    fund: { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', quoteType: 'estimate' as const, source: 'test' },
    agent: {
      model: 'deepseek-v4-flash',
      steps: [{ name: 'collect_web_research', status: 'done' as const, summary: '联网读取公开材料' }],
      indicators: { totalReturn: 3, maxDrawdown: -2, shortMomentum: 1, volatility: 0.8, trendSlope: 0.1, sampleSize: 20 },
    },
    report: {
      summary: 'AI 判断：成长风格改善。',
      trend: '短期趋势偏强。',
      marketDrivers: '上涨原因来自持仓方向和市场风险偏好修复。',
      outlook: '未来看权益市场风格、基金持仓和回撤变化。',
      risk: '注意波动。',
      beginnerGuide: {
        riskLevel: 'R3' as const,
        riskExplanation: '中等风险',
        netValueExplanation: '结合成本看净值',
        trendExplanation: '不要追涨',
        suggestedAction: '观察等待' as const,
        actionPath: ['观察'],
        suitableFor: ['长期资金'],
        avoid: ['追涨杀跌'],
      },
      scenarios: [{ name: '中性情景', probability: 'medium' as const, description: '震荡观察' }],
      watchPoints: ['最大回撤'],
      sourceNotes: ['公开网页材料'],
      disclaimer: '不构成投资建议',
    },
    chartAnnotations: [],
    researchSources: [{ title: '东方财富基金概况', url: 'https://example.com', summary: '基金经理与持仓摘要' }],
    analysis: 'AI 判断：成长风格改善。',
    });
  }),
}));

vi.mock('../api', () => ({ api: mockApi }));

const fund = { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', quoteType: 'estimate' as const, source: 'test' };
const emptySummary = calculatePortfolioSummary([], {});

function render(element: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, root };
}

describe('dashboard components', () => {
  const roots: Root[] = [];

  afterEach(() => {
    act(() => roots.splice(0).forEach((root) => root.unmount()));
    document.body.replaceChildren();
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
  });

  it('renders market and fund sections with selected quote state', async () => {
    const market = render(
      <MarketOverview
        indices={[{ code: '000001.SH', name: '上证指数', value: 4098.64, change: 4.91, changePercent: 0.12, quoteTime: '2026-05-29 15:00:00' }]}
        loading={false}
      />,
    );
    roots.push(market.root);

    const onSelectCodes: string[] = [];
    const search = render(
      <FundSearch
        query="000001"
        setQuery={() => undefined}
        results={[fund]}
        selectedFund={fund}
        history={[{ date: '2026-05-29', netValue: 1.35 }]}
        benchmarkHistory={[{ date: '2026-05-29', netValue: 4000 }]}
        holdings={{
          reportDate: '2026-03-31',
          stocks: [
            { code: '600519', name: '贵州茅台', weight: 18.33, industry: '食品饮料', changeType: '增持' },
            { code: '000858', name: '五粮液', weight: 6.12, rank: 11, isTopTen: false, shares: 120.5, industry: '食品饮料' },
          ],
        }}
        loading={false}
        onSearch={() => undefined}
        onSelect={(code) => onSelectCodes.push(code)}
        onAddHolding={() => undefined}
        onToggleWatch={() => undefined}
        watchlist={[]}
      />,
    );
    roots.push(search.root);

    expect(market.container.textContent).toContain('全球指数行情');
    expect(market.container.textContent).toContain('覆盖 A 股、港股、美股、日经、韩国和欧洲主要指数');
    expect(search.container.textContent).toContain('华夏成长混合');
    expect(search.container.textContent).toContain('实时估算');
    expect(search.container.textContent).toContain('基金分析走势图');
    expect(search.container.textContent).toContain('Fund Signal Matrix');
    expect(search.container.textContent).toContain('默认指标');
    expect(search.container.textContent).toContain('点位');
    expect(search.container.textContent).toContain('最大回撤');
    expect(search.container.textContent).toContain('可选指标');
    expect(search.container.textContent).toContain('年化收益');
    expect(search.container.textContent).toContain('夏普');
    expect(search.container.textContent).toContain('波动率');
    expect(search.container.textContent).toContain('相对基准');
    expect(search.container.textContent).toContain('超额收益');
    expect(search.container.textContent).toContain('已披露股票持仓');
    expect(search.container.textContent).toContain('已披露股票合计 24.45%');
    expect(search.container.textContent).toContain('前十大以外已披露 6.12%');
    expect(search.container.textContent).toContain('未逐项披露或非股票资产约 75.55%');
    expect(search.container.textContent).toContain('贵州茅台');
    expect(search.container.textContent).toContain('#11 · 000858');
    expect(search.container.textContent).toContain('持股 120.5万股');
    const aiButton = Array.from(search.container.querySelectorAll('button')).find((button) => button.textContent?.includes('智能分析'));
    act(() => aiButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); });
    expect(mockApi.analyzeFundStream).toHaveBeenCalledWith('000001', expect.any(Object));
    expect(document.body.textContent).toContain('Deepseek Agent');
    expect(document.body.textContent).toContain('核心判断');
    expect(document.body.textContent).toContain('驱动');
    expect(document.body.textContent).toContain('上涨原因来自持仓方向');
    expect(document.body.textContent).toContain('东方财富基金概况');
    expect(document.body.querySelector('.fund-ai-panel')?.className).toContain('is-drawer');
    expect(document.body.querySelector('.fund-ai-resize-handle')).toBeNull();
    const holdingButton = search.container.querySelector<HTMLButtonElement>('[data-testid="fund-holdings"] button');
    expect(holdingButton).not.toBeNull();
    const returnButton = Array.from(search.container.querySelectorAll('button')).find((button) => button.textContent?.includes('区间收益'));
    act(() => returnButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(search.container.textContent).toContain('区间收益');
    act(() => holdingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onSelectCodes).toContain('600519');
  });

  it('covers header account labels and navigation actions', () => {
    const pageChanges: string[] = [];
    const logoutEvents: string[] = [];
    const anonymous = render(
      <Header
        activePage="workspace"
        onPageChange={(page) => pageChanges.push(page)}
        onLogout={() => logoutEvents.push('logout')}
      />,
    );
    roots.push(anonymous.root);

    expect(anonymous.container.textContent).toContain('未登录');
    expect(anonymous.container.textContent).not.toContain('架构');
    const brandButton = anonymous.container.querySelector<HTMLButtonElement>('button[aria-label="GG Fund 行情"]');
    act(() => brandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const portfolioButton = Array.from(anonymous.container.querySelectorAll('button')).find((button) => button.textContent?.includes('账户'));
    act(() => portfolioButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(pageChanges).toEqual(['workspace', 'portfolio']);

    const loggedIn = render(
      <Header
        activePage="portfolio"
        session={{ user: { id: 'user-1', provider: 'email', identifier: 'verylongname@example.com', displayName: '' }, session: { token: 'session-1', expiresAt: '2026-06-10T00:00:00.000Z' } }}
        logoutPending
        onPageChange={(page) => pageChanges.push(page)}
        onLogout={() => logoutEvents.push('logout')}
      />,
    );
    roots.push(loggedIn.root);

    expect(loggedIn.container.textContent).toContain('verylong@example.com');
    expect(loggedIn.container.textContent).toContain('Resend OTP');
    const logoutButton = loggedIn.container.querySelector<HTMLButtonElement>('button[aria-label="退出登录"]');
    expect(logoutButton?.disabled).toBe(true);
    expect(logoutButton?.textContent).toContain('退出中');
  });

  it('covers beginner guide market and portfolio decision branches', () => {
    const profitableSummary = calculatePortfolioSummary(
      [{
        id: 'profit',
        fundCode: '000001',
        fundName: '华夏成长混合',
        shares: 100,
        costAmount: 100,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      }],
      { '000001': { ...fund, netValue: 1.2 } },
    );
    const lossSummary = calculatePortfolioSummary(
      [{
        id: 'loss',
        fundCode: '000001',
        fundName: '华夏成长混合',
        shares: 100,
        costAmount: 200,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      }],
      { '000001': { ...fund, netValue: 1.2 } },
    );

    const hot = render(
      <BeginnerGuide
        leadingIndex={{ code: '000001.SH', name: '上证指数', value: 4098.64, change: 70, changePercent: 1.72, quoteTime: '2026-06-09 15:00:00' }}
        summary={profitableSummary}
      />,
    );
    roots.push(hot.root);
    expect(hot.container.textContent).toContain('市场情绪偏暖');
    expect(hot.container.textContent).toContain('波动较大');
    expect(hot.container.textContent).toContain('优先考虑分批止盈');

    const cold = render(
      <BeginnerGuide
        selectedFund={fund}
        leadingIndex={{ code: '000001.SH', name: '上证指数', value: 3900, change: -80, changePercent: -2.01, quoteTime: '2026-06-09 15:00:00' }}
        summary={lossSummary}
      />,
    );
    roots.push(cold.root);
    expect(cold.container.textContent).toContain('市场情绪偏冷');
    expect(cold.container.textContent).toContain('组合当前回撤');
    expect(cold.container.textContent).toContain('分批减仓');
  });

  it('renders stock quote details without the fund trend matrix', () => {
    const stock = {
      code: '600519',
      name: '贵州茅台',
      assetType: 'stock' as const,
      market: 'SH' as const,
      netValue: 1668.88,
      dailyChangePercent: 0.72,
      open: 1650,
      previousClose: 1656.94,
      high: 1688,
      low: 1648,
      volume: 123456,
      turnover: 987654321,
      quoteDate: '2026-05-29',
      source: '东方财富 A股行情',
    };
    const search = render(
      <FundSearch
        query="茅台"
        setQuery={() => undefined}
        results={[stock]}
        selectedFund={stock}
        history={[]}
        loading={false}
        onSearch={() => undefined}
        onSelect={() => undefined}
        onAddHolding={() => undefined}
        onToggleWatch={() => undefined}
        watchlist={[]}
      />,
    );
    roots.push(search.root);

    expect(search.container.textContent).toContain('金融资产搜索');
    expect(search.container.textContent).toContain('实时股价');
    expect(search.container.textContent).toContain('今开');
    expect(search.container.textContent).toContain('成交量 / 成交额');
    expect(search.container.textContent).not.toContain('Fund Signal Matrix');
  });

  it('covers FundSearch loading, official fund, watchlist, keyboard search, and sparse stock branches', async () => {
    const searches: string[] = [];
    const queryUpdates: string[] = [];
    const selectedCodes: string[] = [];
    const addEvents: string[] = [];
    const watchEvents: string[] = [];
    const officialFund = {
      code: '110022',
      name: '易方达消费行业股票',
      netValue: 0,
      quoteDate: '',
      source: 'test',
      quoteType: 'official' as const,
      dailyChangePercent: 0,
    };
    const official = render(
      <FundSearch
        query="消费"
        setQuery={(value) => queryUpdates.push(value)}
        results={[officialFund]}
        selectedFund={officialFund}
        history={[]}
        loading
        error="搜索失败"
        onSearch={() => searches.push('search')}
        onSelect={(code) => selectedCodes.push(code)}
        onAddHolding={(item) => addEvents.push(item.code)}
        onToggleWatch={(item) => watchEvents.push(item.code)}
        watchlist={[{ fundCode: '110022', fundName: '易方达消费行业股票', createdAt: '2026-06-09T00:00:00.000Z' }]}
      />,
    );
    roots.push(official.root);

    expect(official.container.textContent).toContain('正在查询金融数据');
    expect(official.container.textContent).toContain('搜索失败');
    expect(official.container.textContent).toContain('官方净值');
    expect(official.container.textContent).toContain('最新官方净值 --');
    expect(official.container.textContent).toContain('日期 待更新');
    expect(official.container.textContent).toContain('移出自选');
    const input = official.container.querySelector<HTMLInputElement>('input[aria-label="基金、股票代码或名称"]');
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      nativeSetter?.call(input, '白酒');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
      input?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });
    expect(queryUpdates).toContain('白酒');
    expect(searches).toEqual(['search']);
    const resultButton = official.container.querySelector<HTMLButtonElement>('.fund-result-tab');
    act(() => resultButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(selectedCodes).toEqual(['110022']);
    const addButton = Array.from(official.container.querySelectorAll('button')).find((button) => button.textContent?.includes('加入持仓'));
    const watchButton = Array.from(official.container.querySelectorAll('button')).find((button) => button.textContent?.includes('移出自选'));
    act(() => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      watchButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(addEvents).toEqual(['110022']);
    expect(watchEvents).toEqual(['110022']);

    const sparseStock = render(
      <FundSearch
        query="300750"
        setQuery={() => undefined}
        results={[]}
        selectedFund={{ code: '300750', name: '宁德时代', assetType: 'stock', netValue: 218.36, quoteDate: '', source: 'test-stock' }}
        history={[]}
        loading={false}
        onSearch={() => undefined}
        onSelect={() => undefined}
        onAddHolding={() => undefined}
        onToggleWatch={() => undefined}
        watchlist={[]}
      />,
    );
    roots.push(sparseStock.root);
    expect(sparseStock.container.textContent).toContain('最新价 218.36 · 日期 待更新');
    expect(sparseStock.container.textContent).toContain('日涨跌：--%');
    expect(sparseStock.container.textContent).toContain('成交量 / 成交额');
  });

  it('renders FundAnalysisPanel branches for loading, errors, scenarios, and drawer layout', async () => {
    const hidden = render(<FundAnalysisPanel onClose={() => undefined} />);
    roots.push(hidden.root);
    expect(hidden.container.textContent).toBe('');

    const closeEvents: string[] = [];
    const analysis: FundAnalysisResponse = {
      fund,
      analysis: 'AI 判断',
      chartAnnotations: [],
      researchSources: [],
      agent: {
        model: 'deepseek-v4-flash',
        steps: [],
        indicators: { totalReturn: 1, maxDrawdown: -1, shortMomentum: 1, volatility: 1, trendSlope: 1, sampleSize: 10 },
      },
      report: {
        summary: '核心判断摘要',
        trend: '趋势震荡',
        marketDrivers: '驱动不足',
        outlook: '继续观察',
        risk: '注意风险',
        beginnerGuide: {
          riskLevel: 'R3',
          riskExplanation: '中等风险',
          netValueExplanation: '看净值',
          trendExplanation: '看趋势',
          suggestedAction: '观察等待',
          actionPath: [],
          suitableFor: [],
          avoid: [],
        },
        scenarios: [
          { name: '乐观', probability: 'high', description: '修复继续' },
          { name: '压力', probability: 'low', description: '回撤扩大' },
          { name: '中性', probability: 'medium', description: '震荡' },
        ],
        watchPoints: ['最大回撤', '估值'],
        sourceNotes: [],
        disclaimer: '不构成投资建议',
      },
    };
    const panel = render(
      <FundAnalysisPanel
        target={{ code: '000001', name: '华夏成长混合' }}
        analysis={analysis}
        loadingCode="000001"
        streamingStatus="正在生成"
        streamingDraft="【核心判断】草稿"
        error="分析失败"
        onClose={() => closeEvents.push('closed')}
      />,
    );
    roots.push(panel.root);
    await act(async () => { await Promise.resolve(); });

    expect(document.body.textContent).toContain('正在生成');
    expect(document.body.textContent).toContain('分析失败');
    expect(document.body.textContent).toContain('流式草稿');
    expect(document.body.textContent).toContain('高概率');
    expect(document.body.textContent).toContain('低概率');
    expect(document.body.textContent).toContain('中性情景');
    expect(document.body.textContent).toContain('震荡');
    expect(document.body.textContent).toContain('本次未读取到可用公开网页材料');
    act(() => document.body.querySelector<HTMLButtonElement>('button[aria-label="关闭智能分析"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(closeEvents).toEqual(['closed']);
    act(() => document.body.querySelector<HTMLButtonElement>('button[aria-label="关闭智能分析抽屉"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(closeEvents).toEqual(['closed', 'closed']);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 });
    const mobile = render(
      <FundAnalysisPanel
        target={{ code: '000001', name: '华夏成长混合' }}
        analysis={analysis}
        onClose={() => undefined}
      />,
    );
    roots.push(mobile.root);
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
    });
    expect(document.body.querySelector('.fund-ai-panel')?.className).toContain('is-drawer');
    expect(document.body.querySelector('.fund-ai-resize-handle')).toBeNull();
  });

  it('renders the fund analysis drawer without persisted floating geometry', async () => {
    localStorage.setItem('gg-fund:analysis-panel-rect', JSON.stringify({ x: -100, y: -80, width: 9999, height: 9999 }));
    const analysis: FundAnalysisResponse = {
      fund,
      analysis: 'AI 判断',
      chartAnnotations: [],
      researchSources: [{ title: '来源 A', url: 'https://example.com/a', summary: '摘要' }],
      agent: {
        model: 'deepseek-v4-flash',
        steps: [],
        indicators: { totalReturn: 1, maxDrawdown: -1, shortMomentum: 1, volatility: 1, trendSlope: 1, sampleSize: 10 },
      },
      report: {
        summary: '核心判断摘要',
        trend: '趋势震荡',
        marketDrivers: '驱动充足',
        outlook: '继续观察',
        risk: '注意风险',
        beginnerGuide: {
          riskLevel: 'R3',
          riskExplanation: '中等风险',
          netValueExplanation: '看净值',
          trendExplanation: '看趋势',
          suggestedAction: '观察等待',
          actionPath: [],
          suitableFor: [],
          avoid: [],
        },
        scenarios: [],
        watchPoints: [],
        sourceNotes: [],
        disclaimer: '不构成投资建议',
      },
    };
    const panel = render(
      <FundAnalysisPanel
        target={{ code: '000001', name: '华夏成长混合' }}
        analysis={analysis}
        onClose={() => undefined}
      />,
    );
    roots.push(panel.root);
    await act(async () => { await Promise.resolve(); });

    const aside = document.body.querySelector<HTMLElement>('.fund-ai-panel');
    expect(aside?.className).toContain('is-drawer');
    expect(aside?.getAttribute('style')).toBeNull();
    expect(document.body.textContent).toContain('来源 A');
    expect(document.body.querySelector('.fund-ai-resize-handle')).toBeNull();
  });

  it('renders portfolio and settings empty states', () => {
    const portfolio = render(
      <PortfolioPanel
        summary={emptySummary}
        watchlist={[]}
        quotesRefreshing
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    const settings = render(<SettingsPanel onImport={() => undefined} />);
    roots.push(settings.root);

    expect(portfolio.container.textContent).toContain('还没有持仓');
    expect(portfolio.container.textContent).toContain('刷新中');
    expect(portfolio.container.textContent).toContain('多平台账本');
    expect(portfolio.container.textContent).toContain('智能定投 / 目标止盈');
    const emptyDailyButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-controls="portfolio-insight-detail"]')).find((button) => button.textContent?.includes('今日估算收益'));
    act(() => emptyDailyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.textContent).toContain('暂无可用日涨跌行情');
    const emptyProfitButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-controls="portfolio-insight-detail"]')).find((button) => button.textContent?.includes('累计盈亏'));
    act(() => emptyProfitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.textContent).toContain('暂无可拆解的累计盈亏');
    expect(settings.container.textContent).toContain('导入持仓');
    expect(settings.container.textContent).toContain('上传截图或文件');
    expect(settings.container.textContent).toContain('云端 OCR + DeepSeek');
    expect(settings.container.textContent).not.toContain('数据与部署说明');
    expect(settings.container.textContent).not.toContain('本地数据导出');
    expect(settings.container.textContent).not.toContain('导入 JSON 备份');
  });

  it('renders error and populated portfolio branches', async () => {
    const market = render(<MarketOverview indices={[]} loading={false} error="行情暂不可用" />);
    roots.push(market.root);
    const populatedSummary = calculatePortfolioSummary(
      [{
        id: 'holding-1',
        fundCode: '000001',
        fundName: '华夏成长混合',
        shares: 100,
        costAmount: 100,
        accountName: '支付宝账本',
        platform: 'alipay',
        purchaseDate: '2026-05-29',
        createdAt: '2026-05-29T00:00:00.000Z',
        updatedAt: '2026-05-29T00:00:00.000Z',
      }],
      {
        '000001': {
          ...fund,
          dailyChangePercent: -1,
          estimateTime: '2026-05-29 10:00:00',
        },
      },
      {},
      new Date('2026-05-29T10:30:00+08:00'),
    );
    let refreshCount = 0;

    const portfolio = render(
      <PortfolioPanel
        summary={populatedSummary}
        watchlist={[{ fundCode: '110022', fundName: '易方达消费行业股票', createdAt: '2026-05-29T00:00:00.000Z' }]}
        quotesUpdatedAt="2026-05-29T10:30:00.000Z"
        onRefreshQuotes={() => { refreshCount += 1; }}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    expect(market.container.textContent).toContain('行情暂不可用');
    expect(portfolio.container.textContent).toContain('持仓明细');
    expect(portfolio.container.textContent).toContain('华夏成长混合');
    expect(portfolio.container.textContent).toContain('支付宝账本');
    expect(portfolio.container.textContent).toContain('易方达消费行业股票');
    expect(portfolio.container.textContent).not.toContain('Yangjibao Layer');
    expect(portfolio.container.textContent).not.toContain('对标养基宝的账本');
    expect(portfolio.container.querySelector('h2')?.parentElement?.parentElement?.querySelector('.inline-flex')).toBeNull();

    const holdingsButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('.yb-metric-card')).find((button) => button.textContent?.includes('持仓'));
    expect(holdingsButton).not.toBeNull();
    expect(holdingsButton?.getAttribute('aria-pressed')).toBe('true');
    expect(holdingsButton?.getAttribute('aria-controls')).toBeNull();
    const holdingsPanel = portfolio.container.querySelector('[data-testid="portfolio-holdings-detail"]');
    expect(holdingsPanel?.textContent).toContain('持仓明细');
    expect(holdingsPanel?.className).toContain('yb-holdings-panel');
    expect(portfolio.container.querySelector('[data-testid="portfolio-insight-detail"]')).toBeNull();
    const dailyButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-controls="portfolio-insight-detail"]')).find((button) => button.textContent?.includes('今日估算收益'));
    expect(dailyButton).not.toBeNull();
    act(() => dailyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.querySelector('[data-testid="portfolio-insight-detail"]')?.textContent).toContain('今日收益拆解');
    expect(portfolio.container.querySelector('[aria-label="今日收益排序"]')?.textContent).toContain('按涨跌率');
    const dailySortButton = portfolio.container.querySelector<HTMLButtonElement>('[aria-label="今日收益排序"] .yb-sort-chip.is-active');
    expect(dailySortButton?.getAttribute('aria-label')).toContain('当前正序');
    expect(dailySortButton?.querySelector('.yb-sort-arrow.is-selected')?.textContent).toBe('↑');
    act(() => dailySortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const toggledDailySortButton = portfolio.container.querySelector<HTMLButtonElement>('[aria-label="今日收益排序"] .yb-sort-chip.is-active');
    expect(toggledDailySortButton?.getAttribute('aria-label')).toContain('当前倒序');
    expect(toggledDailySortButton?.querySelector('.yb-sort-arrow.is-selected')?.textContent).toBe('↓');
    const dailyNameSortButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-label="今日收益排序"] .yb-sort-chip')).find((button) => button.textContent?.includes('按名称'));
    act(() => dailyNameSortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(dailyNameSortButton?.getAttribute('aria-label')).toContain('当前正序');
    expect(portfolio.container.querySelector('[data-testid="portfolio-insight-detail"]')?.textContent).toContain('华夏成长混合');
    expect(portfolio.container.querySelector('[data-testid="portfolio-holdings-detail"]')).toBeNull();
    expect(portfolio.container.querySelector('.yb-tone-down, .yb-tone-up')).not.toBeNull();
    expect(portfolio.container.textContent).not.toContain('当日走势');
    const dailyRow = portfolio.container.querySelector<HTMLElement>('.yb-daily-profit-row');
    expect(dailyRow?.getAttribute('role')).toBe('button');
    act(() => dailyRow?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); });
    expect(mockApi.getFundIntraday).toHaveBeenCalledWith('000001');
    const intradayChart = portfolio.container.querySelector('[data-testid="intraday-trend-chart"]');
    expect(intradayChart?.textContent).toContain('当日行情走势');
    expect(intradayChart?.textContent).toContain('近似走势');
    expect(intradayChart?.textContent).toContain('09:30 - 10:00 · 2 个分时点');
    expect(intradayChart?.textContent).not.toContain('15:00');
    expect(intradayChart?.textContent).toContain('收益口径：按日涨跌 -1.00%');
    expect(intradayChart?.textContent).toContain('数据来源：主要持仓加权近似');
    expect(intradayChart?.closest('.yb-daily-profit-item')?.textContent).toContain('华夏成长混合');
    expect(portfolio.container.textContent).not.toContain('点击看明细');
    expect(portfolio.container.textContent).not.toContain('持仓市值拆解');
    const profitButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-controls="portfolio-insight-detail"]')).find((button) => button.textContent?.includes('累计盈亏'));
    act(() => profitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.querySelector('[data-testid="portfolio-insight-detail"]')?.textContent).toContain('累计盈亏拆解');
    expect(portfolio.container.querySelector('[aria-label="累计盈亏排序"]')?.textContent).toContain('按盈亏');
    const profitSortButton = portfolio.container.querySelector<HTMLButtonElement>('[aria-label="累计盈亏排序"] .yb-sort-chip.is-active');
    expect(profitSortButton?.getAttribute('aria-label')).toContain('当前正序');
    expect(profitSortButton?.querySelector('.yb-sort-arrow.is-selected')?.textContent).toBe('↑');
    act(() => profitSortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const toggledProfitSortButton = portfolio.container.querySelector<HTMLButtonElement>('[aria-label="累计盈亏排序"] .yb-sort-chip.is-active');
    expect(toggledProfitSortButton?.getAttribute('aria-label')).toContain('当前倒序');
    expect(toggledProfitSortButton?.querySelector('.yb-sort-arrow.is-selected')?.textContent).toBe('↓');
    const profitMarketSortButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-label="累计盈亏排序"] .yb-sort-chip')).find((button) => button.textContent?.includes('按市值'));
    act(() => profitMarketSortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(profitMarketSortButton?.getAttribute('aria-label')).toContain('当前倒序');
    expect(portfolio.container.querySelector('[data-testid="portfolio-holdings-detail"]')).toBeNull();
    act(() => holdingsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(holdingsButton?.getAttribute('aria-pressed')).toBe('true');
    expect(portfolio.container.querySelector('[data-testid="portfolio-insight-detail"]')).toBeNull();
    expect(portfolio.container.querySelector('[data-testid="portfolio-holdings-detail"]')?.textContent).toContain('持仓明细');
    const holdingSortButton = portfolio.container.querySelector<HTMLButtonElement>('[aria-label="持仓排序"] .yb-sort-chip.is-active');
    expect(holdingSortButton?.getAttribute('aria-label')).toContain('当前倒序');
    expect(holdingSortButton?.querySelector('.yb-sort-arrow.is-selected')?.textContent).toBe('↓');
    act(() => holdingSortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const toggledHoldingSortButton = portfolio.container.querySelector<HTMLButtonElement>('[aria-label="持仓排序"] .yb-sort-chip.is-active');
    expect(toggledHoldingSortButton?.getAttribute('aria-label')).toContain('当前正序');
    expect(toggledHoldingSortButton?.querySelector('.yb-sort-arrow.is-selected')?.textContent).toBe('↑');
    const returnRateSortButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-label="持仓排序"] .yb-sort-chip')).find((button) => button.textContent?.includes('总收益'));
    act(() => returnRateSortButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(returnRateSortButton?.getAttribute('aria-label')).toContain('当前倒序');
    const refreshButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('手动刷新'));
    act(() => refreshButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(refreshCount).toBe(1);

    const detailButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.includes('持仓详情'));
    expect(detailButton).toBeDefined();
    act(() => detailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const detail = portfolio.container.querySelector('[data-testid="holding-detail"]');
    expect(detail).not.toBeNull();
    expect(detail?.textContent).toContain('最新净值');
    expect(detail?.textContent).toContain('累计盈亏');
    expect(portfolio.container.querySelector('[data-testid="holding-positions"]')).not.toBeNull();
    expect(portfolio.container.querySelector('[data-testid="holding-positions"]')?.textContent).toContain('已披露股票持仓');
    const aiButtons = Array.from(portfolio.container.querySelectorAll('button')).filter((button) => button.textContent?.includes('智能分析'));
    expect(aiButtons.length).toBeGreaterThan(0);
    act(() => aiButtons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); });
    expect(mockApi.analyzeFundStream).toHaveBeenCalledWith('000001', expect.any(Object));
    expect(document.body.textContent).toContain('Deepseek Agent');
    expect(document.body.textContent).toContain('核心判断');
    expect(document.body.textContent).toContain('驱动');
    expect(document.body.textContent).toContain('上涨原因来自持仓方向');
    expect(document.body.querySelector('.fund-ai-links a')?.textContent).toContain('东方财富基金概况');
    expect(document.body.querySelector('.fund-ai-panel')?.className).toContain('is-drawer');
    const bottomModules = portfolio.container.querySelector('[data-testid="portfolio-bottom-modules"]');
    expect(bottomModules).not.toBeNull();
    expect(portfolio.container.textContent).toContain('多平台账本');
    expect(portfolio.container.textContent).toContain('风险诊断');
  });

  it('covers portfolio stale daily rows, keyboard intraday toggle, and pending code details', async () => {
    const staleSummary = calculatePortfolioSummary(
      [
        {
          id: 'fresh',
          fundCode: '000001',
          fundName: '华夏成长混合',
          recordedMarketValue: 1200,
          costAmount: 1000,
          createdAt: '2026-06-09T00:00:00.000Z',
          updatedAt: '2026-06-09T00:00:00.000Z',
        },
        {
          id: 'pending',
          fundCode: 'ALIPAY001',
          fundName: '截图基金',
          recordedMarketValue: 800,
          costAmount: 850,
          createdAt: '2026-06-08T00:00:00.000Z',
          updatedAt: '2026-06-08T00:00:00.000Z',
        },
      ],
      {
        '000001': { ...fund, dailyChangePercent: 1.2, quoteDate: '2026-06-09', estimateTime: '2026-06-09 14:30:00' },
      },
      {},
      new Date('2026-06-09T15:00:00+08:00'),
    );
    const portfolio = render(
      <PortfolioPanel
        summary={staleSummary}
        watchlist={[]}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    const dailyButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-controls="portfolio-insight-detail"]')).find((button) => button.textContent?.includes('今日估算收益'));
    act(() => dailyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.textContent).toContain('待更新 1 只');
    expect(portfolio.container.textContent).toContain('今日行情待更新');
    const freshRow = Array.from(portfolio.container.querySelectorAll<HTMLElement>('.yb-daily-profit-row')).find((row) => row.textContent?.includes('华夏成长混合'));
    await act(async () => {
      freshRow?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      await Promise.resolve();
    });
    expect(mockApi.getFundIntraday).toHaveBeenCalledWith('000001');
    await act(async () => {
      freshRow?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      await Promise.resolve();
    });
    expect(portfolio.container.querySelector('[data-testid="intraday-trend-chart"]')).not.toBeNull();
    await act(async () => {
      freshRow?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
      await Promise.resolve();
    });
    expect(portfolio.container.querySelector('[data-testid="intraday-trend-chart"]')).toBeNull();

    const holdingsButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('.yb-metric-card')).find((button) => button.textContent?.includes('持仓'));
    act(() => holdingsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const pendingDetailButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.getAttribute('aria-label') === '截图基金 持仓详情');
    act(() => pendingDetailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.textContent).toContain('待补全');
    expect(portfolio.container.textContent).toContain('自填估值');
    expect(portfolio.container.querySelector('[data-testid="holding-positions"]')).toBeNull();
  });

  it('renders non-current daily profit, manual code detail, holding days, and holdings failure', async () => {
    const getFundHoldingsMock = mockApi.getFundHoldings as unknown as { mockRejectedValueOnce(value: unknown): void };
    getFundHoldingsMock.mockRejectedValueOnce(new Error('holdings unavailable'));
    const nonCurrentSummary = calculatePortfolioSummary(
      [{
        id: 'manual-holding',
        fundCode: '000001',
        fundName: '手动确认基金',
        shares: 1000,
        costAmount: 1000,
        codeSource: 'manual',
        purchaseDate: '2026-06-01',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      }],
      { '000001': { ...fund, dailyChangePercent: 0.5, quoteDate: '2026-06-08' } },
      {},
      new Date('2026-06-09T15:00:00+08:00'),
    );
    const portfolio = render(
      <PortfolioPanel
        summary={nonCurrentSummary}
        watchlist={[]}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    const dailyButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-controls="portfolio-insight-detail"]')).find((button) => button.textContent?.includes('最近估算收益'));
    act(() => dailyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.textContent).toContain('最近收益拆解');
    expect(portfolio.container.textContent).toContain('非交易日沿用');

    const holdingsButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('.yb-metric-card')).find((button) => button.textContent?.includes('持仓'));
    act(() => holdingsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const detailButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.getAttribute('aria-label')?.includes('持仓详情'));
    expect(detailButton).not.toBeUndefined();
    act(() => detailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(portfolio.container.textContent).toContain('000001（手动确认）');
    expect(portfolio.container.textContent).toMatch(/持有天数\d+ 天/);
    expect(portfolio.container.textContent).toContain('暂无该基金的持仓组成数据');
  });

  it('loads market history from cache, switches active index, and handles failed history fetches', async () => {
    const getCachedIndexHistoryMock = mockApi.getCachedIndexHistory as unknown as { mockReturnValueOnce(value: unknown): void };
    const getIndexHistoryMock = mockApi.getIndexHistory as unknown as {
      mockResolvedValueOnce(value: unknown): { mockRejectedValueOnce(value: unknown): void };
    };
    getCachedIndexHistoryMock.mockReturnValueOnce([{ date: '2026-06-01', netValue: 4000 }]);
    getIndexHistoryMock
      .mockResolvedValueOnce([{ date: '2026-06-02', netValue: 4100 }])
      .mockRejectedValueOnce(new Error('history unavailable'));
    const market = render(
      <MarketOverview
        loading
        indices={[
          { code: '000001.SH', name: '上证指数', value: 4098.64, change: 4.91, changePercent: 0.12, quoteTime: '2026-06-09 15:00:00' },
          { code: 'NDX.US', name: '纳斯达克100', value: 25709.43, change: -1121.53, changePercent: -4.18, quoteTime: '2026-06-06 05:30:00' },
          { code: 'HSI.HK', name: '恒生指数', value: 24961.95, change: -291.45, changePercent: -1.15, quoteTime: '2026-06-05 16:10:06' },
          { code: 'N225.JP', name: '日经225', value: 66587.9, change: -882.79, changePercent: -1.31, quoteTime: '2026-06-05 14:30:03' },
          { code: 'KS11.KR', name: '韩国KOSPI', value: 8160.59, change: -478.82, changePercent: -5.54, quoteTime: '2026-06-05 14:30:40' },
        ]}
      />,
    );
    roots.push(market.root);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(market.container.textContent).toContain('正在加载市场数据');
    expect(market.container.textContent).toContain('多市场数据');
    expect(market.container.textContent).toContain('▲');
    expect(market.container.textContent).toContain('▼');
    const nasdaqButton = Array.from(market.container.querySelectorAll('button')).find((button) => button.textContent?.includes('纳斯达克100'));
    act(() => nasdaqButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockApi.getIndexHistory).toHaveBeenCalledWith('NDX.US', 'all');
    expect(market.container.textContent).toContain('暂无该指数的历史数据');
  });

  it('renders intraday empty, direct, estimated, and fallback branches', () => {
    const loading = render(<IntradayTrendChart title="空走势" points={[]} loading />);
    roots.push(loading.root);
    expect(loading.container.textContent).toContain('正在加载当日分时走势');

    const empty = render(<IntradayTrendChart title="无分钟" points={[]} />);
    roots.push(empty.root);
    expect(empty.container.textContent).toContain('当前公开接口只返回单点实时估算');

    const direct = render(
      <IntradayTrendChart
        title="真实走势"
        points={[
          { time: '09:30', price: 1.2 },
          { time: '09:31', price: 1.18 },
        ]}
      />,
    );
    roots.push(direct.root);
    expect(direct.container.textContent).toContain('真实分时');
    expect(direct.container.textContent).toContain('已叠加分时K线');
    expect(direct.container.textContent).toContain('-0.0200');
    expect(direct.container.textContent).toContain('数据来源：公开行情接口');

    const estimated = render(
      <IntradayTrendChart
        title="近似走势"
        dailyChangePercent={1.23}
        estimateTime="2026-06-09 09:31:00"
        points={[
          { time: '09:30', price: 1.2, average: 1.19, source: '持仓加权', sourceType: 'estimated' },
          { time: '09:31', price: 1.22, average: 1.2, source: '持仓加权', sourceType: 'estimated' },
          { time: '09:32', price: 1.25, average: 1.21, source: '持仓加权', sourceType: 'estimated' },
        ]}
      />,
    );
    roots.push(estimated.root);
    expect(estimated.container.textContent).toContain('近似走势');
    expect(estimated.container.textContent).toContain('09:30 - 09:31 · 2 个分时点 · 已叠加分时K线');
    expect(estimated.container.textContent).toContain('收益口径：按日涨跌 +1.23%');
    expect(estimated.container.textContent).not.toContain('09:32');
  });

  it('edits a holding code and name through the inline editor', () => {
    const edits: Array<{ id: string; patch: { fundCode: string; fundName: string } }> = [];
    const updates: Array<{ id: string; patch: { recordedMarketValue: number; costAmount: number } }> = [];
    const removals: string[] = [];
    const populatedSummary = calculatePortfolioSummary(
      [{
        id: 'holding-2',
        fundCode: 'ALIPAY001',
        fundName: '某只截图基金',
        recordedMarketValue: 1200,
        costAmount: 1000,
        accountName: '支付宝账本',
        platform: 'alipay',
        createdAt: '2026-05-29T00:00:00.000Z',
        updatedAt: '2026-05-29T00:00:00.000Z',
      }],
      {},
    );

    const portfolio = render(
      <PortfolioPanel
        summary={populatedSummary}
        watchlist={[]}
        onRemoveHolding={(id) => removals.push(id)}
        onUpdateHolding={(id, patch) => updates.push({ id, patch })}
        onEditIdentity={(id, patch) => edits.push({ id, patch })}
      />,
    );
    roots.push(portfolio.root);

    const editButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.includes('编辑'));
    act(() => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const codeInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="某只截图基金 基金代码"]');
    const valueInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="某只截图基金 持有金额"]');
    const costInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="某只截图基金 成本金额"]');
    expect(codeInput).not.toBeNull();
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      if (!codeInput || !valueInput || !costInput || !nativeSetter) return;
      nativeSetter.call(codeInput, '110022');
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeSetter.call(valueInput, '1300.456');
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeSetter.call(costInput, '999.994');
      costInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.includes('保存'));
    act(() => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(edits).toHaveLength(1);
    expect(edits[0]?.patch.fundCode).toBe('110022');
    expect(updates).toEqual([{ id: 'holding-2', patch: { recordedMarketValue: 1300.46, costAmount: 999.99 } }]);

    act(() => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const invalidValueInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="某只截图基金 持有金额"]');
    act(() => {
      if (!invalidValueInput || !nativeSetter) return;
      nativeSetter.call(invalidValueInput, '-1');
      invalidValueInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(updates).toHaveLength(1);

    const cancelButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.includes('取消'));
    act(() => cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.querySelector('input[aria-label="某只截图基金 持有金额"]')).toBeNull();

    const deleteButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.includes('删除'));
    act(() => deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(removals).toEqual(['holding-2']);
  });

  it('manually looks up a holding and confirms it into portfolio', async () => {
    const getFundMock = mockApi.getFund as unknown as { mockResolvedValueOnce(value: FundQuote): void };
    getFundMock.mockResolvedValueOnce(fund);
    const manualAdds: Array<{ fund: FundQuote; patch: { recordedMarketValue: number; costAmount: number } }> = [];
    const portfolio = render(
      <PortfolioPanel
        summary={calculatePortfolioSummary([{
          id: 'manual-anchor',
          fundCode: '000001',
          fundName: '华夏成长混合',
          shares: 100,
          costAmount: 100,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        }], { '000001': fund })}
        watchlist={[]}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
        onAddManualHolding={(nextFund, patch) => manualAdds.push({ fund: nextFund, patch })}
      />,
    );
    roots.push(portfolio.root);

    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    expect(portfolio.container.querySelector('input[aria-label="手动新增持仓代码或名称"]')).toBeNull();
    const addButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('增加'));
    act(() => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const queryInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="手动新增持仓代码或名称"]');
    const valueInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="手动新增持仓持有金额"]');
    const costInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="手动新增持仓成本金额"]');
    expect(queryInput).not.toBeNull();
    const manualPanel = portfolio.container.querySelector('#manual-holding-panel');
    const firstHolding = portfolio.container.querySelector('.yb-holding-wrap');
    expect(Boolean(manualPanel && firstHolding && (manualPanel.compareDocumentPosition(firstHolding) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

    act(() => {
      if (!queryInput || !valueInput || !costInput || !nativeSetter) return;
      nativeSetter.call(queryInput, '000001');
      queryInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeSetter.call(valueInput, '1234.567');
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeSetter.call(costInput, '1000.111');
      costInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const lookupButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('拉取信息'));
    await act(async () => {
      lookupButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(mockApi.getFund).toHaveBeenCalledWith('000001');
    expect(portfolio.container.textContent).toContain('华夏成长混合');

    const confirmButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('更新持仓'));
    act(() => confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(manualAdds).toEqual([{ fund, patch: { recordedMarketValue: 1234.57, costAmount: 1000.11 } }]);
    expect(portfolio.container.querySelector('input[aria-label="手动新增持仓代码或名称"]')).toBeNull();
  });

  it('manually searches holding by name and reports invalid inputs', async () => {
    const manualAdds: Array<{ fund: FundQuote; patch: { recordedMarketValue: number; costAmount: number } }> = [];
    const portfolio = render(
      <PortfolioPanel
        summary={emptySummary}
        watchlist={[]}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
        onAddManualHolding={(nextFund, patch) => manualAdds.push({ fund: nextFund, patch })}
      />,
    );
    roots.push(portfolio.root);

    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const addButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('增加'));
    act(() => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const queryInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="手动新增持仓代码或名称"]');
    const valueInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="手动新增持仓持有金额"]');
    const lookupButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('拉取信息'));

    await act(async () => {
      lookupButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(portfolio.container.textContent).toContain('请先填写基金代码或名称');

    act(() => {
      if (!queryInput || !valueInput || !nativeSetter) return;
      nativeSetter.call(queryInput, '白酒');
      queryInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeSetter.call(valueInput, '-10');
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      lookupButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(mockApi.searchFunds).toHaveBeenCalledWith('白酒');

    const confirmButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('更新持仓'));
    act(() => confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.textContent).toContain('请填写有效的持有金额和成本金额');
    expect(manualAdds).toHaveLength(0);
  });

  it('expands disclosed fund holdings and loads stock quote details', async () => {
    const getFundHoldingsMock = mockApi.getFundHoldings as unknown as { mockResolvedValueOnce(value: unknown): void };
    const getFundMock = mockApi.getFund as unknown as { mockResolvedValueOnce(value: unknown): void };
    const getFundHistoryMock = mockApi.getFundHistory as unknown as { mockResolvedValueOnce(value: unknown): void };
    getFundHoldingsMock.mockResolvedValueOnce({
      reportDate: '2026-03-31',
      stocks: [
        { code: '600519', name: '贵州茅台', weight: 18.33, rank: 1, isTopTen: true, shares: 508.34, industry: '食品饮料', changeType: '增持' },
        { code: '000568', name: '泸州老窖', weight: 1.8, rank: 11, isTopTen: false },
      ],
    });
    getFundMock.mockResolvedValueOnce({
      code: '600519',
      name: '贵州茅台',
      assetType: 'stock',
      market: 'SH',
      netValue: 1668.88,
      dailyChangePercent: 0.72,
      open: 1650,
      previousClose: 1656.94,
      high: 1688,
      low: 1648,
      quoteDate: '2026-06-09',
      source: '东方财富 A股行情',
    });
    getFundHistoryMock.mockResolvedValueOnce([{ date: '2026-06-09', netValue: 1668.88 }]);
    const populatedSummary = calculatePortfolioSummary(
      [{
        id: 'holding-stock-detail',
        fundCode: '000001',
        fundName: '华夏成长混合',
        shares: 1000,
        costAmount: 1000,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      }],
      { '000001': fund },
    );

    const portfolio = render(
      <PortfolioPanel
        summary={populatedSummary}
        watchlist={[]}
        benchmarkHistory={[{ date: '2026-06-09', netValue: 4800 }]}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    const detailButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.includes('持仓详情'));
    act(() => detailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const positions = portfolio.container.querySelector('[data-testid="holding-positions"]');
    expect(positions?.textContent).toContain('报告期 2026-03-31');
    expect(positions?.textContent).toContain('已披露股票合计 20.13%');
    expect(positions?.textContent).toContain('前十大 18.33%');
    expect(positions?.textContent).toContain('前十大以外已披露 1.80%');
    expect(positions?.textContent).toContain('未逐项披露或非股票资产约 79.87%');
    expect(positions?.textContent).toContain('持股 508.34万股');

    const stockButton = portfolio.container.querySelector<HTMLButtonElement>('button[aria-label="查看 贵州茅台 详情"]');
    act(() => stockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const stockDetail = portfolio.container.querySelector('[data-testid="holding-stock-detail"]');
    expect(mockApi.getFund).toHaveBeenCalledWith('600519');
    expect(stockDetail?.textContent).toContain('股票 · SH');
    expect(stockDetail?.textContent).toContain('最新价');
    expect(stockDetail?.textContent).toContain('+0.72%');
    expect(stockDetail?.textContent).toContain('今开');
    expect(stockDetail?.textContent).toContain('昨收');
    expect(stockDetail?.textContent).toContain('最高 / 最低');
    expect(stockDetail?.textContent).toContain('东方财富 A股行情');
    expect(portfolio.container.querySelector('[data-testid="holding-stock-chart"]')).not.toBeNull();
  });

  it('shows portfolio analysis errors and closes the analysis panel', async () => {
    const analyzeMock = mockApi.analyzeFundStream as unknown as { mockRejectedValueOnce(value: unknown): void };
    analyzeMock.mockRejectedValueOnce('stream failed');
    const populatedSummary = calculatePortfolioSummary(
      [{
        id: 'holding-analysis-error',
        fundCode: '000001',
        fundName: '华夏成长混合',
        shares: 1000,
        costAmount: 1000,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      }],
      { '000001': fund },
    );
    const portfolio = render(
      <PortfolioPanel
        summary={populatedSummary}
        watchlist={[]}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    const analysisButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.includes('智能分析'));
    await act(async () => {
      analysisButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('智能分析暂不可用');
    const closeButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="关闭智能分析"]');
    act(() => closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).not.toContain('智能分析暂不可用');
  });

  it('shows retry UI when stock quote lookup fails repeatedly', async () => {
    vi.useFakeTimers();
    const getFundHoldingsMock = mockApi.getFundHoldings as unknown as { mockResolvedValueOnce(value: unknown): void };
    const getFundMock = mockApi.getFund as unknown as { mockRejectedValue(value: unknown): void };
    getFundHoldingsMock.mockResolvedValueOnce({
      reportDate: '2026-03-31',
      stocks: [{ code: '600519', name: '贵州茅台', weight: 18.33, rank: 1, isTopTen: true }],
    });
    getFundMock.mockRejectedValue(new Error('quote unavailable'));
    const populatedSummary = calculatePortfolioSummary(
      [{
        id: 'holding-stock-retry',
        fundCode: '000001',
        fundName: '华夏成长混合',
        shares: 1000,
        costAmount: 1000,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      }],
      { '000001': fund },
    );
    const portfolio = render(
      <PortfolioPanel
        summary={populatedSummary}
        watchlist={[]}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    const detailButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.includes('持仓详情'));
    act(() => detailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const stockButton = portfolio.container.querySelector<HTMLButtonElement>('button[aria-label="查看 贵州茅台 详情"]');
    act(() => stockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(portfolio.container.textContent).toContain('多次查找仍未获取到 贵州茅台 的行情');
    const retryButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('重新查找'));
    act(() => retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(mockApi.getFund).toHaveBeenCalledWith('600519');
    vi.useRealTimers();
  });

  it('renders beginner decision guidance for selected funds', () => {
    const guide = render(
      <BeginnerGuide
        selectedFund={fund}
        leadingIndex={{ code: '000001.SH', name: '上证指数', value: 4098.64, change: -12, changePercent: -0.29, quoteTime: '2026-05-29 15:00:00' }}
        summary={calculatePortfolioSummary([], {})}
      />,
    );
    roots.push(guide.root);

    expect(guide.container.textContent).toContain('基金小白决策地图');
    expect(guide.container.textContent).toContain('华夏成长混合');
    expect(guide.container.textContent).toContain('确认资金期限');
    expect(guide.container.textContent).toContain('一年内要用的钱优先稳健');
    expect(guide.container.textContent).toContain('风险等级不是收益承诺');
    expect(guide.container.textContent).toContain('每月复盘');
    expect(guide.container.textContent).toContain('单只基金权重');
  });

  it('exposes the beginner decision steps without the removed tool universe catalog', () => {
    expect(decisionSteps.map((step) => step.title)).toEqual([
      '确认资金期限',
      '匹配风险等级',
      '观察市场温度',
      '检查持仓权重',
      '分批执行与复盘',
    ]);
  });

  it('recognizes Alipay holding text into importable local portfolio JSON', () => {
    const importText = buildRecognizedImport([
      '支付宝 000001 华夏成长混合 1,000.00 1,235.50 默认账本',
      '支付宝 110022 易方达消费行业股票 200 300 家庭账本',
    ].join('\n'), 'alipay');
    const parsed = JSON.parse(importText) as { holdings: Array<{ fundCode: string; fundName: string; shares: number; costAmount: number; platform: string; accountName: string }> };

    expect(parsed.holdings).toHaveLength(2);
    expect(parsed.holdings[0]).toMatchObject({
      fundCode: '000001',
      fundName: '华夏成长混合',
      shares: 1000,
      costAmount: 1235.5,
      platform: 'alipay',
      accountName: '默认账本',
    });
    expect(parsed.holdings[1]).toMatchObject({ fundCode: '110022', accountName: '家庭账本' });
  });

  it('recognizes an uploaded screenshot through DeepSeek and imports after confirmation', async () => {
    let imported = '';
    const settings = render(
      <SettingsPanel
        onImport={(text) => { imported = text; }}
        ocrReader={async () => '招商中证白酒指数 5,000.00 +420.00\n华夏中证电网设备主题ETF联接C 30,289.47 +2,289.47 -2.14'}
        recognizeImage={async (_imageDataUrl) => ({
          model: 'deepseek-v4-flash',
          holdings: [
            { fundName: '招商中证白酒指数', marketValue: 5000, profit: 420 },
            { fundName: '华夏中证电网设备主题ETF联接C', fundCode: '012000', marketValue: 30289.47, profit: 2289.47, dailyProfit: -2.14 },
          ],
        })}
      />,
    );
    roots.push(settings.root);

    const input = settings.container.querySelector('input[aria-label="上传支付宝持仓文件或图片"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'alipay.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      for (let tick = 0; tick < 5; tick += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });

    expect(settings.container.textContent).toContain('核对识别到的持仓');
    expect(settings.container.textContent).toContain('deepseek-v4-flash');
    const nameInput = settings.container.querySelector<HTMLInputElement>('input[aria-label="第 1 行基金名称"]');
    expect(nameInput?.value).toBe('招商中证白酒指数C');
    expect(settings.container.querySelector<HTMLInputElement>('input[aria-label="第 1 行基金代码"]')?.value).toBe('161725');

    // 用户二次修改第一行名称后再确认。
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      if (!nameInput || !nativeSetter) return;
      nativeSetter.call(nameInput, '招商中证白酒指数C');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const confirmButton = Array.from(settings.container.querySelectorAll('button')).find((button) => button.textContent?.includes('确认导入'));
    act(() => confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const parsed = JSON.parse(imported) as { holdings: Array<{ fundCode: string; fundName: string; recordedMarketValue: number; recordedDailyProfit?: number; costAmount: number; platform: string }> };
    expect(parsed.holdings).toHaveLength(2);
    expect(parsed.holdings[0]).toMatchObject({ fundCode: '161725', fundName: '招商中证白酒指数C', recordedMarketValue: 5000, platform: 'alipay' });
    expect(parsed.holdings[0].costAmount).toBeCloseTo(5000 - 420, 2);
    expect(parsed.holdings[1]).toMatchObject({ fundCode: '012000' });
    expect(parsed.holdings[1].recordedDailyProfit).toBeUndefined();
    expect(settings.container.textContent).toContain('已确认导入 2 条持仓');
    expect(settings.container.textContent).not.toContain('核对识别到的持仓');
  });

  it('imports uploaded text files as Alipay ledger data', async () => {
    let imported = '';
    const settings = render(<SettingsPanel importError="导入格式错误" onImport={(text) => { imported = text; }} />);
    roots.push(settings.root);

    const input = settings.container.querySelector('input[aria-label="上传支付宝持仓文件或图片"]') as HTMLInputElement;
    const file = new File(['支付宝 000001 华夏成长混合 100 1200 家庭账本'], 'holdings.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(settings.container.textContent).toContain('导入格式错误');
    expect(settings.container.textContent).toContain('已读取 holdings.txt');
    expect(JSON.parse(imported).holdings[0]).toMatchObject({
      fundCode: '000001',
      platform: 'alipay',
      accountName: '家庭账本',
    });
    expect(input.value).toBe('');
  });

  it('falls back to local OCR and cancels confirmation when cloud image recognition fails', async () => {
    const settings = render(
      <SettingsPanel
        onImport={() => undefined}
        recognizeImage={vi.fn()
          .mockRejectedValueOnce(new Error('cloud quota'))
          .mockResolvedValueOnce({
            model: 'deepseek-v4-flash',
            holdings: [{ fundName: '永赢科技智选混合C', marketValue: 2000, profit: 100 }],
          })}
        ocrReader={async (_file, onProgress) => {
          onProgress?.('recognizing', 0.42);
          return '永赢科技智选混合C 2,000.00 +100.00';
        }}
      />,
    );
    roots.push(settings.root);

    const input = settings.container.querySelector('input[aria-label="上传支付宝持仓文件或图片"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File([new Uint8Array([1])], 'fallback.webp', { type: 'image/webp' })], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      for (let tick = 0; tick < 6; tick += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });

    expect(settings.container.textContent).toContain('核对识别到的持仓');
    expect(settings.container.querySelector<HTMLInputElement>('input[aria-label="第 1 行基金代码"]')?.value).toBe('022365');
    const cancelButton = Array.from(settings.container.querySelectorAll('button')).find((button) => button.textContent?.includes('取消'));
    act(() => cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(settings.container.textContent).toContain('已取消本次导入');
  });

  it('shows OCR empty and recognition empty notices for image imports', async () => {
    const localEmpty = render(
      <SettingsPanel
        onImport={() => undefined}
        recognizeImage={async () => { throw new Error('cloud unavailable'); }}
        ocrReader={async () => '   '}
      />,
    );
    roots.push(localEmpty.root);
    const emptyInput = localEmpty.container.querySelector('input[aria-label="上传支付宝持仓文件或图片"]') as HTMLInputElement;
    Object.defineProperty(emptyInput, 'files', { value: [new File([new Uint8Array([1])], 'empty.png', { type: 'image/png' })], configurable: true });
    await act(async () => {
      emptyInput.dispatchEvent(new Event('change', { bubbles: true }));
      for (let tick = 0; tick < 4; tick += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    expect(localEmpty.container.textContent).toContain('未从截图中读取到文字');

    const noHoldings = render(
      <SettingsPanel
        onImport={() => undefined}
        recognizeImage={async () => ({ model: 'deepseek-v4-flash', holdings: [] })}
      />,
    );
    roots.push(noHoldings.root);
    const noHoldingsInput = noHoldings.container.querySelector('input[aria-label="上传支付宝持仓文件或图片"]') as HTMLInputElement;
    Object.defineProperty(noHoldingsInput, 'files', { value: [new File([new Uint8Array([1])], 'blank.jpg', { type: 'image/jpeg' })], configurable: true });
    await act(async () => {
      noHoldingsInput.dispatchEvent(new Event('change', { bubbles: true }));
      for (let tick = 0; tick < 4; tick += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    expect(noHoldings.container.textContent).toContain('未从截图中识别到持仓');
  });

  it('builds resilient fund code matches from noisy holding names', () => {
    expect(findFundCodeAlias('南方纳斯达克100指数C')).toMatchObject({ code: '016453' });
    expect(findFundCodeAlias('中国国有企业债债券C')).toMatchObject({ code: '006331', name: '中银国有企业债C' });
    expect(findFundCodeAlias('华夏中证电网设备主题ETF联接C')).toMatchObject({ code: '025857' });
    expect(buildFundCodeSearchQueries('永赢先锋半导体智选混合C')).toEqual(expect.arrayContaining(['半导体智选', '永赢半导体智选']));
    expect(buildFundCodeSearchQueries('富国创业板人工智能ETF联接C')).toEqual(expect.arrayContaining(['创业板人工智能', '富国创业板人工智能']));
    const match = pickBestFundCodeMatch('永赢科技智选混合C', [
      { code: '022364', name: '永赢科技智选混合发起A', netValue: 1, quoteDate: '2026-06-09', source: 'test', assetType: 'fund' },
      { code: '022365', name: '永赢科技智选混合发起C', netValue: 1, quoteDate: '2026-06-09', source: 'test', assetType: 'fund' },
    ]);
    expect(match?.code).toBe('022365');
  });

  it('recognizes a real Alipay holding screenshot without fund codes', () => {
    const ocrText = [
      '我 的 持 有 2 持 有 收益 排序',
      '名 称 SH/IEEWRD 持 有 收益 / 率',
      '南方 纳 斯 达 克 100 指 数 19,374.21 +2,624.21',
      '(QDIDC +49.08 +15.86%',
      '华夏 中 证 电网 设备 主题 30,289.47 +2,289.47',
      'ETF 联 接 C -2.14 +8.18%',
      '中 银 国 有 企业 债 债券 C 43,919.06 +1,034.94',
      '+35.26 +2.41%',
      '基金 销售 服务 由 蚂蚁 (杭州 ) 基金 销售 有 限 公司 提供',
    ].join('\n');
    const importText = buildRecognizedImport(ocrText, 'alipay');
    const parsed = JSON.parse(importText) as {
      holdings: Array<{ fundCode: string; fundName: string; recordedMarketValue: number; recordedDailyProfit?: number; costAmount: number; platform: string }>;
    };

    expect(parsed.holdings.length).toBeGreaterThanOrEqual(3);
    const first = parsed.holdings[0];
    expect(first.recordedMarketValue).toBe(19374.21);
    expect(first.recordedDailyProfit).toBeUndefined();
    expect(first.costAmount).toBeCloseTo(19374.21 - 2624.21, 2);
    expect(first.platform).toBe('alipay');
    expect(first.fundName).toContain('纳斯达克');
    expect(parsed.holdings.every((holding) => holding.recordedMarketValue > 0)).toBe(true);
  });

  it('keeps the import confirmation modal hidden when closed', () => {
    const modal = render(
      <ImportConfirmModal
        open={false}
        holdings={[{ fundName: '招商中证白酒指数', marketValue: 1000 }]}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    roots.push(modal.root);

    expect(modal.container.textContent).toBe('');
  });

  it('edits, resolves, removes, and confirms recognized import rows', async () => {
    const confirmed: unknown[] = [];
    const resolveFundCode = vi.fn(async () => ({
      fundCode: '016452',
      fundName: '南方纳斯达克100指数发起(QDII)A',
    }));
    const modal = render(
      <ImportConfirmModal
        open
        model="deepseek-v4-flash"
        holdings={[
          { fundName: '南方纳斯达克100指数A', marketValue: 1000, profit: 20 },
          { fundName: '无效行', marketValue: 0 },
        ]}
        resolveFundCode={resolveFundCode}
        onConfirm={(holdings) => confirmed.push(...holdings)}
        onCancel={() => undefined}
      />,
    );
    roots.push(modal.root);

    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const amountInput = modal.container.querySelector<HTMLInputElement>('input[aria-label="第 1 行持有金额"]');
    const profitInput = modal.container.querySelector<HTMLInputElement>('input[aria-label="第 1 行持有收益"]');
    act(() => {
      nativeSetter?.call(amountInput, '1,234.50');
      amountInput?.dispatchEvent(new Event('input', { bubbles: true }));
      nativeSetter?.call(profitInput, '-10.5');
      profitInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const resolveButton = Array.from(modal.container.querySelectorAll('button')).find((button) => button.textContent?.includes('查代码'));
    await act(async () => {
      resolveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(resolveFundCode).toHaveBeenCalledWith('南方纳斯达克100指数A');
    expect(modal.container.querySelector<HTMLInputElement>('input[aria-label="第 1 行基金代码"]')?.value).toBe('016452');

    const removeButton = modal.container.querySelector<HTMLButtonElement>('button[aria-label="删除第 2 行"]');
    act(() => removeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const confirmButton = Array.from(modal.container.querySelectorAll('button')).find((button) => button.textContent?.includes('确认导入'));
    act(() => confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(confirmed).toEqual([
      {
        fundName: '南方纳斯达克100指数发起(QDII)A',
        fundCode: '016452',
        marketValue: 1234.5,
        profit: -10.5,
      },
    ]);
  });
});

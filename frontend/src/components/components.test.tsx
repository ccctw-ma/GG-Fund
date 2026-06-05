import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculatePortfolioSummary } from '../portfolio';
import { decisionSteps } from '../decisionSteps';
import { BeginnerGuide } from './BeginnerGuide';
import { FundSearch } from './FundSearch';
import { MarketOverview } from './MarketOverview';
import { PortfolioPanel } from './PortfolioPanel';
import { SettingsPanel, buildRecognizedImport } from './SettingsPanel';

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

    expect(market.container.textContent).toContain('四大指数行情');
    expect(market.container.textContent).toContain('默认显示上证指数');
    expect(search.container.textContent).toContain('华夏成长混合');
    expect(search.container.textContent).toContain('实时估算');
    expect(search.container.textContent).toContain('基金分析走势图');
    expect(search.container.textContent).toContain('Fund Signal Matrix');
    expect(search.container.textContent).toContain('默认指标');
    expect(search.container.textContent).toContain('收盘价/净值');
    expect(search.container.textContent).toContain('最大回撤');
    expect(search.container.textContent).toContain('可选指标');
    expect(search.container.textContent).toContain('年化收益');
    expect(search.container.textContent).toContain('夏普');
    expect(search.container.textContent).toContain('相对基准');
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
    expect(search.container.textContent).toContain('Deepseek Agent');
    expect(search.container.textContent).toContain('核心判断');
    expect(search.container.textContent).toContain('驱动');
    expect(search.container.textContent).toContain('上涨原因来自持仓方向');
    expect(search.container.textContent).toContain('东方财富基金概况');
    expect(search.container.querySelector('.fund-ai-resize-handle.is-corner')).not.toBeNull();
    expect(localStorage.getItem('gg-fund:analysis-panel-rect')).toContain('"x"');
    const holdingButton = search.container.querySelector<HTMLButtonElement>('[data-testid="fund-holdings"] button');
    expect(holdingButton).not.toBeNull();
    const annualizedButton = Array.from(search.container.querySelectorAll('button')).find((button) => button.textContent?.includes('年化收益'));
    act(() => annualizedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(search.container.textContent).toContain('按当前时间范围起止净值折算为年化收益');
    act(() => holdingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onSelectCodes).toContain('600519');
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

  it('renders portfolio and settings empty states', () => {
    const portfolio = render(
      <PortfolioPanel
        summary={emptySummary}
        watchlist={[]}
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    const settings = render(<SettingsPanel onImport={() => undefined} />);
    roots.push(settings.root);

    expect(portfolio.container.textContent).toContain('还没有持仓');
    expect(portfolio.container.textContent).toContain('多平台账本');
    expect(portfolio.container.textContent).toContain('智能定投 / 目标止盈');
    expect(settings.container.textContent).toContain('多平台导入助手');
    expect(settings.container.textContent).toContain('上传支付宝持仓文件或图片');
    expect(settings.container.textContent).toContain('浏览器本地 OCR');
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
    const refreshButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('手动刷新'));
    act(() => refreshButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(refreshCount).toBe(1);

    const detailButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('详情'));
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
    expect(portfolio.container.textContent).toContain('Deepseek Agent');
    expect(portfolio.container.textContent).toContain('核心判断');
    expect(portfolio.container.textContent).toContain('驱动');
    expect(portfolio.container.textContent).toContain('上涨原因来自持仓方向');
    expect(portfolio.container.querySelector('.fund-ai-links a')?.textContent).toContain('东方财富基金概况');
    expect(localStorage.getItem('gg-fund:analysis-panel-rect')).toContain('"width"');
    const bottomModules = portfolio.container.querySelector('[data-testid="portfolio-bottom-modules"]');
    expect(bottomModules).not.toBeNull();
    expect(portfolio.container.textContent).toContain('多平台账本');
    expect(portfolio.container.textContent).toContain('风险诊断');
  });

  it('edits a holding code and name through the inline editor', () => {
    const edits: Array<{ id: string; patch: { fundCode: string; fundName: string } }> = [];
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
        onRemoveHolding={() => undefined}
        onUpdateHolding={() => undefined}
        onEditIdentity={(id, patch) => edits.push({ id, patch })}
      />,
    );
    roots.push(portfolio.root);

    const editButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('编辑'));
    act(() => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const codeInput = portfolio.container.querySelector<HTMLInputElement>('input[aria-label="某只截图基金 基金代码"]');
    expect(codeInput).not.toBeNull();
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      if (!codeInput || !nativeSetter) return;
      nativeSetter.call(codeInput, '110022');
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(portfolio.container.querySelectorAll('button')).find((button) => button.textContent?.includes('保存'));
    act(() => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(edits).toHaveLength(1);
    expect(edits[0]?.patch.fundCode).toBe('110022');
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

  it('recognizes an uploaded Alipay screenshot through the OCR reader', async () => {
    let imported = '';
    const ocrText = '支付宝 161725 招商中证白酒指数 500 420 默认账本';
    const settings = render(
      <SettingsPanel
        onImport={(text) => { imported = text; }}
        ocrReader={async () => ocrText}
      />,
    );
    roots.push(settings.root);

    const input = settings.container.querySelector('input[aria-label="上传支付宝持仓文件或图片"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'alipay.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const parsed = JSON.parse(imported) as { holdings: Array<{ fundCode: string; platform: string }> };
    expect(parsed.holdings[0]).toMatchObject({ fundCode: '161725', platform: 'alipay' });
    expect(settings.container.textContent).toContain('已识别截图');
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
      holdings: Array<{ fundCode: string; fundName: string; recordedMarketValue: number; costAmount: number; platform: string }>;
    };

    expect(parsed.holdings.length).toBeGreaterThanOrEqual(3);
    const first = parsed.holdings[0];
    expect(first.recordedMarketValue).toBe(19374.21);
    expect(first.costAmount).toBeCloseTo(19374.21 - 2624.21, 2);
    expect(first.platform).toBe('alipay');
    expect(first.fundName).toContain('纳斯达克');
    expect(parsed.holdings.every((holding) => holding.recordedMarketValue > 0)).toBe(true);
  });
});

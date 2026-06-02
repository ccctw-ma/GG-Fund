import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { calculatePortfolioSummary } from '../portfolio';
import { researchCatalog, getLiveCatalogItems } from '../researchCatalog';
import { BeginnerGuide } from './BeginnerGuide';
import { FundSearch } from './FundSearch';
import { MarketOverview } from './MarketOverview';
import { PortfolioPanel } from './PortfolioPanel';
import { SettingsPanel, buildRecognizedImport } from './SettingsPanel';
import { ToolUniverse } from './ToolUniverse';

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
  });

  it('renders market and fund sections with selected quote state', () => {
    const market = render(
      <MarketOverview
        indices={[{ code: '000001.SH', name: '上证指数', value: 4098.64, change: 4.91, changePercent: 0.12, quoteTime: '2026-05-29 15:00:00' }]}
        loading={false}
      />,
    );
    roots.push(market.root);

    const search = render(
      <FundSearch
        query="000001"
        setQuery={() => undefined}
        results={[fund]}
        selectedFund={fund}
        history={[{ date: '2026-05-29', netValue: 1.35 }]}
        loading={false}
        onSearch={() => undefined}
        onSelect={() => undefined}
        onAddHolding={() => undefined}
        onToggleWatch={() => undefined}
        watchlist={[]}
      />,
    );
    roots.push(search.root);

    expect(market.container.textContent).toContain('全球市场雷达');
    expect(search.container.textContent).toContain('华夏成长混合');
    expect(search.container.textContent).toContain('实时估算');
    expect(search.container.textContent).toContain('基金分析走势图');
    expect(search.container.textContent).toContain('Fund Signal Matrix');
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
      />,
    );
    roots.push(portfolio.root);

    const settings = render(<SettingsPanel exportText="{}" onImport={() => undefined} />);
    roots.push(settings.root);

    expect(portfolio.container.textContent).toContain('还没有持仓');
    expect(portfolio.container.textContent).toContain('多平台账本');
    expect(portfolio.container.textContent).toContain('智能定投 / 目标止盈');
    expect(settings.container.textContent).toContain('多平台导入助手');
    expect(settings.container.textContent).toContain('上传支付宝持仓文件或截图');
    expect(settings.container.textContent).toContain('浏览器本地 OCR');
    expect(settings.container.textContent).toContain('Cloudflare Worker / OpenNext');
    expect(settings.container.textContent).toContain('Resend');
    expect(settings.container.textContent).toContain('D1');
    expect(settings.container.textContent).toContain('KV 行情缓存为部署路线图能力');
  });

  it('renders error and populated portfolio branches', () => {
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
      {},
    );

    const portfolio = render(
      <PortfolioPanel
        summary={populatedSummary}
        watchlist={[{ fundCode: '110022', fundName: '易方达消费行业股票', createdAt: '2026-05-29T00:00:00.000Z' }]}
        onRemoveHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    expect(market.container.textContent).toContain('行情暂不可用');
    expect(portfolio.container.textContent).toContain('净值未知');
    expect(portfolio.container.textContent).toContain('净值缺失');
    expect(portfolio.container.textContent).toContain('支付宝账本');
    expect(portfolio.container.textContent).toContain('易方达消费行业股票');
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

  it('renders the investment tool universe catalog', () => {
    const universe = render(<ToolUniverse />);
    roots.push(universe.root);

    [
      '全景工具宇宙',
      '全球核心指数',
      '基金筛选、对比与诊断',
      '官方公告与高信任披露',
      'AKShare / AKTools',
      '已接入',
      '可接入',
      '路线图',
    ].forEach((text) => expect(universe.container.textContent).toContain(text));
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
        exportText="{}"
        onImport={(text) => { imported = text; }}
        ocrReader={async () => ocrText}
      />,
    );
    roots.push(settings.root);

    const input = settings.container.querySelector('input[aria-label="上传支付宝持仓文件"]') as HTMLInputElement;
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

  it('exposes a complete typed research catalog with live and roadmap capabilities', () => {
    expect(researchCatalog.assetNavigation.map((item) => item.title)).toEqual([
      '全球核心指数',
      '基金与 A 股行情',
      '养基账本',
      'ETF / LOF',
      'REITs',
      '债券与可转债',
      '新债 / 新发基金',
      '港美与全球观察',
    ]);
    expect(researchCatalog.toolGroups.map((group) => group.title)).toContain('基金筛选、对比与诊断');
    expect(researchCatalog.toolGroups.flatMap((group) => group.capabilities.map((capability) => capability.title))).toContain('盈亏周报/月报');
    expect(researchCatalog.sourceGroups.map((group) => group.title)).toContain('官方公告与高信任披露');
    expect(researchCatalog.openSourceStack.map((item) => item.name)).toEqual(['AKShare / AKTools', 'Qlib', 'Tushare', 'Backtrader', 'Pyfolio', 'Streamlit']);
    expect(getLiveCatalogItems().some((item) => item.title === '基金与 A 股行情')).toBe(true);
    expect(researchCatalog.assetNavigation.find((item) => item.title === '港美与全球观察')?.status).toBe('connectable');
  });
});

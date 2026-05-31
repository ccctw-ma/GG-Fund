import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { researchCatalog, getLiveCatalogItems, getRoadmapCatalogItems } from '../researchCatalog';
import { BeginnerGuide } from './BeginnerGuide';
import { FundSearch } from './FundSearch';
import { MarketOverview } from './MarketOverview';
import { PortfolioPanel } from './PortfolioPanel';
import { SettingsPanel } from './SettingsPanel';
import { ToolUniverse } from './ToolUniverse';

const fund = { code: '000001', name: '华夏成长混合', netValue: 1.35, quoteDate: '2026-05-29', quoteType: 'estimate' as const, source: 'test' };

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

    expect(market.container.textContent).toContain('今日大盘');
    expect(search.container.textContent).toContain('华夏成长混合');
    expect(search.container.textContent).toContain('实时估算');
  });

  it('renders portfolio and settings empty states', () => {
    const portfolio = render(
      <PortfolioPanel
        summary={{ totalCost: 0, totalMarketValue: 0, totalProfit: 0, totalReturnRate: 0, items: [] }}
        watchlist={[]}
        onRemoveHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    const settings = render(<SettingsPanel exportText="{}" onImport={() => undefined} />);
    roots.push(settings.root);

    expect(portfolio.container.textContent).toContain('还没有持仓');
    expect(settings.container.textContent).toContain('Cloudflare D1/KV');
  });

  it('renders error and populated portfolio branches', () => {
    const market = render(<MarketOverview indices={[]} loading={false} error="行情暂不可用" />);
    roots.push(market.root);

    const portfolio = render(
      <PortfolioPanel
        summary={{
          totalCost: 100,
          totalMarketValue: 88,
          totalProfit: -12,
          totalReturnRate: -12,
          items: [{
            id: 'holding-1',
            fundCode: '000001',
            fundName: '华夏成长混合',
            shares: 100,
            costAmount: 100,
            createdAt: '2026-05-29T00:00:00.000Z',
            updatedAt: '2026-05-29T00:00:00.000Z',
            marketValue: 88,
            profit: -12,
            returnRate: -12,
            weight: 100,
            quoteStatus: 'missing',
          }],
        }}
        watchlist={[{ fundCode: '110022', fundName: '易方达消费行业股票', createdAt: '2026-05-29T00:00:00.000Z' }]}
        onRemoveHolding={() => undefined}
      />,
    );
    roots.push(portfolio.root);

    expect(market.container.textContent).toContain('行情暂不可用');
    expect(portfolio.container.textContent).toContain('净值未知');
    expect(portfolio.container.textContent).toContain('易方达消费行业股票');
  });

  it('renders beginner decision guidance for selected funds', () => {
    const guide = render(
      <BeginnerGuide
        selectedFund={fund}
        leadingIndex={{ code: '000001.SH', name: '上证指数', value: 4098.64, change: -12, changePercent: -0.29, quoteTime: '2026-05-29 15:00:00' }}
        summary={{ totalCost: 1000, totalMarketValue: 1080, totalProfit: 80, totalReturnRate: 8, items: [] }}
      />,
    );
    roots.push(guide.root);

    expect(guide.container.textContent).toContain('基金小白决策地图');
    expect(guide.container.textContent).toContain('华夏成长混合');
    expect(guide.container.textContent).toContain('确认资金期限');
  });

  it('renders the investment tool universe catalog', () => {
    const universe = render(<ToolUniverse />);
    roots.push(universe.root);

    [
      '全景工具宇宙',
      'A 股指数',
      '基金筛选、对比与诊断',
      '官方公告与高信任披露',
      'AKShare / AKTools',
      '已接入',
      '可接入',
      '路线图',
    ].forEach((text) => expect(universe.container.textContent).toContain(text));
  });

  it('exposes a complete typed research catalog with live and roadmap capabilities', () => {
    expect(researchCatalog.assetNavigation.map((item) => item.title)).toEqual([
      'A 股指数',
      '基金净值',
      'ETF / LOF',
      'REITs',
      '债券与可转债',
      '新债 / 新发基金',
      '港美与全球观察',
    ]);
    expect(researchCatalog.toolGroups.map((group) => group.title)).toContain('基金筛选、对比与诊断');
    expect(researchCatalog.sourceGroups.map((group) => group.title)).toContain('官方公告与高信任披露');
    expect(researchCatalog.openSourceStack.map((item) => item.name)).toEqual(['AKShare / AKTools', 'Qlib', 'Tushare', 'Backtrader', 'Pyfolio', 'Streamlit']);
    expect(getLiveCatalogItems().some((item) => item.title === '基金净值')).toBe(true);
    expect(getRoadmapCatalogItems().some((item) => item.title === '港美与全球观察')).toBe(true);
  });
});

import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { calculatePortfolioSummary } from '../portfolio';
import { decisionSteps } from '../decisionSteps';
import { BeginnerGuide } from './BeginnerGuide';
import { FundSearch } from './FundSearch';
import { MarketOverview } from './MarketOverview';
import { PortfolioPanel } from './PortfolioPanel';
import { SettingsPanel, buildRecognizedImport } from './SettingsPanel';

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
      {
        '000001': {
          ...fund,
          dailyChangePercent: -1,
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

    const dailyButton = portfolio.container.querySelector<HTMLButtonElement>('[aria-controls="portfolio-insight-detail"][aria-pressed="true"]');
    expect(dailyButton).not.toBeNull();
    expect(portfolio.container.querySelector('[data-testid="portfolio-insight-detail"]')?.textContent).toContain('今日收益拆解');
    expect(portfolio.container.querySelector('[data-testid="portfolio-insight-detail"]')?.textContent).toContain('华夏成长混合');
    expect(portfolio.container.textContent).not.toContain('点击看明细');
    expect(portfolio.container.textContent).not.toContain('持仓市值拆解');
    const profitButton = Array.from(portfolio.container.querySelectorAll<HTMLButtonElement>('[aria-controls="portfolio-insight-detail"]')).find((button) => button.textContent?.includes('累计盈亏'));
    act(() => profitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(portfolio.container.querySelector('[data-testid="portfolio-insight-detail"]')?.textContent).toContain('累计盈亏拆解');
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

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FundTrendChart } from './FundTrendChart';

vi.mock('echarts-for-react', () => ({
  default: ({ option }: { option: { series?: Array<{ name: string; type?: string }> } }) => (
    <div data-testid="mock-echarts">{option.series?.map((series) => `${series.name}:${series.type}`).join('|')}</div>
  ),
}));

const risingHistory = [
  { date: '2026-06-01', netValue: 1 },
  { date: '2026-06-02', netValue: 1.05 },
  { date: '2026-06-03', netValue: 1.1 },
  { date: '2026-06-04', netValue: 1.2 },
];

const fallingHistory = [
  { date: '2026-06-01', netValue: 10 },
  { date: '2026-06-02', netValue: 9.5 },
  { date: '2026-06-03', netValue: 9 },
  { date: '2026-06-04', netValue: 8.8 },
];

function render(element: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, root };
}

describe('FundTrendChart', () => {
  const roots: Root[] = [];

  afterEach(() => {
    act(() => roots.splice(0).forEach((root) => root.unmount()));
    document.body.replaceChildren();
  });

  it('renders loading and empty states for missing history', () => {
    const loading = render(<FundTrendChart history={[]} loading />);
    roots.push(loading.root);
    expect(loading.container.textContent).toContain('正在加载历史数据');

    const empty = render(<FundTrendChart history={[]} emptyHint="没有走势" />);
    roots.push(empty.root);
    expect(empty.container.textContent).toContain('没有走势');
  });

  it('renders a custom stock-style chart without benchmark-only controls', () => {
    const chart = render(
      <FundTrendChart
        history={fallingHistory}
        valueName="收盘价"
        valueAxisName="价格"
        title="贵州茅台价格走势"
      />,
    );
    roots.push(chart.root);

    expect(chart.container.textContent).toContain('贵州茅台价格走势');
    expect(chart.container.textContent).toContain('风险收缩');
    expect(chart.container.textContent).toContain('K线');
    expect(chart.container.textContent).toContain('收盘价');
    expect(chart.container.textContent).not.toContain('相对基准');
    expect(chart.container.textContent).not.toContain('超额收益');

    const annualizedButton = Array.from(chart.container.querySelectorAll('button')).find((item) => item.textContent === '年化收益');
    act(() => annualizedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(chart.container.textContent).toContain('按当前时间范围起止净值折算为年化收益');
    expect(chart.container.querySelector('.profit-down')?.textContent).toContain('-');
    act(() => annualizedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(chart.container.textContent).not.toContain('按当前时间范围起止净值折算为年化收益');
  });

  it('toggles optional metrics and benchmark series', () => {
    const chart = render(
      <FundTrendChart
        history={risingHistory}
        benchmarkHistory={[
          { date: '2026-06-01', netValue: 100 },
          { date: '2026-06-02', netValue: 101 },
          { date: '2026-06-03', netValue: 102 },
          { date: '2026-06-04', netValue: 103 },
        ]}
        benchmarkName="测试基准"
      />,
    );
    roots.push(chart.root);

    for (const label of ['年化收益', '夏普', '波动率', '相对基准', '超额收益']) {
      const button = Array.from(chart.container.querySelectorAll('button')).find((item) => item.textContent === label);
      act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    }
    const closeButton = Array.from(chart.container.querySelectorAll('button')).find((item) => item.textContent === '收盘价/净值');
    act(() => closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const allRange = Array.from(chart.container.querySelectorAll('button')).find((item) => item.textContent === 'ALL');
    act(() => allRange?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(chart.container.textContent).toContain('按当前时间范围起止净值折算为年化收益');
    expect(chart.container.textContent).toContain('以 2% 年化无风险利率近似估算');
    expect(chart.container.textContent).toContain('测试基准 在当前区间内的累计收益');
    expect(chart.container.querySelector('[data-testid="mock-echarts"]')?.textContent).toContain('K线:candlestick');
    expect(chart.container.querySelector('[data-testid="mock-echarts"]')?.textContent).toContain('测试基准收益%:line');
    expect(chart.container.querySelector('[data-testid="mock-echarts"]')?.textContent).toContain('超额收益%:line');
    expect(chart.container.querySelector('[data-testid="mock-echarts"]')?.textContent).not.toContain('收盘价/净值');
  });
});

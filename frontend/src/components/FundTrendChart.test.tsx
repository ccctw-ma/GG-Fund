import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FundTrendChart } from './FundTrendChart';

vi.mock('echarts-for-react', () => ({
  default: ({ option }: { option: { series?: Array<{ name: string; type?: string }>; tooltip?: { formatter?: (params: unknown) => string }; yAxis?: Array<{ axisLabel?: { formatter?: (value: number) => string }; axisPointer?: { label?: { formatter?: (params: { value: number }) => string } } }> } }) => {
    const formatter = option.tooltip?.formatter;
    const axisLabelSample = option.yAxis?.[0]?.axisLabel?.formatter?.(1.23456) ?? '';
    const axisPointerSample = option.yAxis?.[0]?.axisPointer?.label?.formatter?.({ value: 1.23456 }) ?? '';
    const tooltipSamples = [
      formatter?.([
        { axisValueLabel: '2026-06-02', seriesName: 'K线', marker: '●', value: [4067.76482, 4075.1, 4063.69705518, 4079.1750999999995] },
        { seriesName: '点位', marker: '●', value: 4075.1 },
        { seriesName: '区间收益%', marker: '●', value: -3.92424242 },
      ]),
      formatter?.({ axisValue: '2026-06-03', seriesName: '夏普', marker: '●', value: 1.23456 }),
      formatter?.([
        { axisValueLabel: '2026-06-04', seriesName: 'K线', marker: '●', value: ['2026-06-04', 10, 10.2, 9.8, 10.5] },
        { seriesName: undefined, marker: undefined, value: 'bad-number' },
      ]),
      axisLabelSample,
      axisPointerSample,
    ].join('');
    return (
      <div data-testid="mock-echarts">
        <span data-testid="mock-series">{option.series?.map((series) => `${series.name}:${series.type}`).join('|')}</span>
        <span data-testid="mock-tooltip">{tooltipSamples}</span>
      </div>
    );
  },
}));

const fallingHistory = [
  { date: '2026-06-01', netValue: 10 },
  { date: '2026-06-02', netValue: 9.5 },
  { date: '2026-06-03', netValue: 9 },
  { date: '2026-06-04', netValue: 8.8 },
];

const ohlcHistory = [
  { date: '2026-06-01', netValue: 10.2, open: 10, close: 10.2, high: 10.5, low: 9.8 },
  { date: '2026-06-02', netValue: 9.9, high: 10.3 },
];

const longHistory = Array.from({ length: 22 }, (_, index) => ({
  date: `2026-06-${String(index + 1).padStart(2, '0')}`,
  netValue: 1 + index * 0.01,
}));

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

  it('renders a custom stock-style chart with value line by default and optional candles', () => {
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
    expect(chart.container.textContent).toContain('MA5');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).toContain('收盘价:line');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).toContain('MA5:line');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).toContain('MA10:line');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).toContain('MA20:line');
    expect(chart.container.textContent).toContain('价格');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).not.toContain('K线:candlestick');
    expect(chart.container.querySelector('[data-testid="mock-tooltip"]')?.textContent).toContain('开盘');
    expect(chart.container.querySelector('[data-testid="mock-tooltip"]')?.textContent).toContain('4,067.76');
    expect(chart.container.querySelector('[data-testid="mock-tooltip"]')?.textContent).toContain('最高');
    expect(chart.container.querySelector('[data-testid="mock-tooltip"]')?.textContent).toContain('4,079.18');
    expect(chart.container.querySelector('[data-testid="mock-tooltip"]')?.textContent).toContain('区间收益%');
    expect(chart.container.querySelector('[data-testid="mock-tooltip"]')?.textContent).toContain('-3.92');
    expect(chart.container.querySelector('[data-testid="mock-tooltip"]')?.textContent).not.toContain('4079.1750999999995');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).not.toContain('区间收益%');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).not.toContain('回撤%');
    expect(chart.container.textContent).not.toContain('相对基准');
    expect(chart.container.textContent).not.toContain('超额收益');
    const labels = Array.from(chart.container.querySelectorAll('button')).map((button) => button.textContent);
    expect(labels).not.toContain('年化收益');
    expect(labels).not.toContain('夏普');
    expect(labels).not.toContain('波动率');
    expect(chart.container.querySelectorAll('.radar-range-tabs button')).toHaveLength(6);

    const klineButton = Array.from(chart.container.querySelectorAll('button')).find((button) => button.textContent === 'K线');
    expect(klineButton?.getAttribute('aria-pressed')).toBe('false');
    act(() => klineButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(klineButton?.getAttribute('aria-pressed')).toBe('true');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).toContain('K线:candlestick');
  });

  it('uses provided OHLC fields for real candlestick data', () => {
    const chart = render(<FundTrendChart history={ohlcHistory} title="真实 K 线" />);
    roots.push(chart.root);

    expect(chart.container.textContent).toContain('真实 K 线');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).not.toContain('K线:candlestick');
    const klineButton = Array.from(chart.container.querySelectorAll('button')).find((button) => button.textContent === 'K线');
    act(() => klineButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).toContain('K线:candlestick');
  });

  it('keeps benchmark data out of the visual chart controls', () => {
    const chart = render(
      <FundTrendChart
        history={longHistory}
        benchmarkHistory={[
          { date: '2026-06-01', netValue: 100 },
          { date: '2026-06-02', netValue: 101 },
          { date: '2026-06-03', netValue: 102 },
          { date: '2026-06-04', netValue: 103 },
        ]}
      />,
    );
    roots.push(chart.root);

    const allRange = Array.from(chart.container.querySelectorAll('button')).find((item) => item.textContent === '更多');
    act(() => allRange?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).not.toContain('K线:candlestick');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).toContain('单位净值:line');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).toContain('MA5:line');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).not.toContain('区间收益%:line');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).not.toContain('回撤%:line');
    expect(chart.container.querySelector('[data-testid="mock-series"]')?.textContent).not.toContain('测试基准收益%:line');
    expect(chart.container.textContent).not.toContain('可选指标');
  });
});

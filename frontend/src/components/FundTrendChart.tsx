'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo, useState } from 'react';
import { calculateFundMetrics, selectHistoryRange, type FundRange } from '../fundMetrics';
import type { FundHistoryPoint } from '../types';
import { Button } from './ui/button';

const ranges: FundRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];
const signalFragments = [
  { text: 'NAV.core()', className: 'radar-fragment radar-fragment-a' },
  { text: 'drawdown.guard', className: 'radar-fragment radar-fragment-b' },
  { text: 'momentum.flow', className: 'radar-fragment radar-fragment-c' },
  { text: 'risk.signal', className: 'radar-fragment radar-fragment-d' },
  { text: 'position.trace', className: 'radar-fragment radar-fragment-e' },
];

type MetricKey = 'kline' | 'close' | 'return' | 'drawdown' | 'annualized' | 'sharpe' | 'volatility' | 'benchmark' | 'excess';

const defaultMetricKeys: MetricKey[] = ['kline', 'close'];
const optionalMetricKeys: MetricKey[] = ['return', 'drawdown', 'annualized', 'sharpe', 'volatility', 'benchmark', 'excess'];
const candleStyle = {
  up: '#ef5350',
  upFill: 'rgba(239, 83, 80, 0.9)',
  down: '#26a69a',
  downFill: 'rgba(38, 166, 154, 0.9)',
};
const metricLabels: Record<MetricKey, string> = {
  kline: 'K线',
  close: '收盘价',
  return: '区间收益',
  drawdown: '最大回撤',
  annualized: '年化收益',
  sharpe: '夏普',
  volatility: '波动率',
  benchmark: '相对基准',
  excess: '超额收益',
};

type ChartTooltipParam = {
  axisValue?: string | number;
  axisValueLabel?: string;
  seriesName?: string;
  marker?: string;
  value?: unknown;
};

const toFiniteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const formatChartNumber = (value: unknown, digits: number) => {
  const number = toFiniteNumber(value);
  if (number === undefined) return '--';
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number);
};

const buildKlineData = (points: FundHistoryPoint[]) => points.map((point, index) => {
  const close = point.close ?? point.netValue;
  if (point.open !== undefined || point.high !== undefined || point.low !== undefined || point.close !== undefined) {
    const open = point.open ?? close;
    const low = point.low ?? Math.min(open, close);
    const high = point.high ?? Math.max(open, close);
    return [open, close, low, high];
  }
  const previousClose = points[index - 1]?.netValue ?? close;
  const direction = close >= previousClose ? 1 : -1;
  const moveRatio = previousClose > 0 ? Math.abs(close / previousClose - 1) : 0;
  const bodyRatio = Math.min(Math.max(moveRatio * 0.32, 0.0018), 0.012);
  const wickRatio = Math.max(bodyRatio * 0.45, 0.001);
  const open = close * (1 - direction * bodyRatio);
  const high = Math.max(open, close) * (1 + wickRatio);
  const low = Math.min(open, close) * (1 - wickRatio);
  return [open, close, low, high];
});

const buildRollingMetricSeries = (points: FundHistoryPoint[], key: 'annualizedReturn' | 'sharpeRatio' | 'volatility') => (
  points.map((_, index) => (index === 0 ? null : calculateFundMetrics(points.slice(0, index + 1)).summary[key]))
);

export function FundTrendChart({
  history,
  benchmarkHistory = [],
  benchmarkName = '沪深300',
  kicker = 'Fund Signal Matrix',
  title = '基金分析走势图',
  valueName = '单位净值',
  valueAxisName = '净值',
  emptyHint = '暂无历史净值数据，选择其他基金或稍后重试。',
  loading = false,
  testId = 'fund-chart',
  height = 480,
}: {
  history: FundHistoryPoint[];
  benchmarkHistory?: FundHistoryPoint[];
  benchmarkName?: string;
  kicker?: string;
  title?: string;
  valueName?: string;
  valueAxisName?: string;
  emptyHint?: string;
  loading?: boolean;
  testId?: string;
  height?: number;
}) {
  const [range, setRange] = useState<FundRange>('1M');
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(defaultMetricKeys);
  const visible = useMemo(() => selectHistoryRange(history, range), [history, range]);
  const visibleBenchmark = useMemo(() => selectHistoryRange(benchmarkHistory, range), [benchmarkHistory, range]);
  const metrics = useMemo(() => calculateFundMetrics(visible, visibleBenchmark), [visible, visibleBenchmark]);
  const klineData = useMemo(() => buildKlineData(metrics.points), [metrics.points]);
  const rollingMetrics = useMemo(() => ({
    annualized: buildRollingMetricSeries(metrics.points, 'annualizedReturn'),
    sharpe: buildRollingMetricSeries(metrics.points, 'sharpeRatio'),
    volatility: buildRollingMetricSeries(metrics.points, 'volatility'),
  }), [metrics.points]);
  const activeMetricSet = useMemo(() => new Set(activeMetrics), [activeMetrics]);
  const lastPoint = metrics.points.at(-1);
  const firstPoint = metrics.points[0];
  const trendTone = metrics.summary.totalReturn >= 0 ? '趋势增强' : '风险收缩';
  const primaryLabel = valueName === '单位净值' ? '收盘价/净值' : valueName;
  const valueDigits = valueName === '单位净值' ? 4 : 2;
  const benchmarkAvailable = metrics.summary.benchmarkReturn !== undefined;
  const availableOptionalMetricKeys = optionalMetricKeys.filter((key) => (key === 'benchmark' || key === 'excess' ? benchmarkAvailable : true));

  function toggleMetric(key: MetricKey) {
    setActiveMetrics((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function formatTooltip(params: ChartTooltipParam | ChartTooltipParam[]) {
    const items = Array.isArray(params) ? params : [params];
    const titleText = items[0]?.axisValueLabel ?? String(items[0]?.axisValue ?? '');
    const rows = items.flatMap((item) => {
      const value = item.value;
      if (item.seriesName === 'K线' && Array.isArray(value)) {
        const values = value.length >= 5 ? value.slice(1, 5) : value.slice(0, 4);
        const labels = ['开盘', '收盘', '最低', '最高'];
        return [
          `<div class="chart-tooltip-series">${item.marker ?? ''}<strong>K线</strong></div>`,
          ...labels.map((label, index) => `<div class="chart-tooltip-row"><span>${label}</span><b>${formatChartNumber(values[index], valueDigits)}</b></div>`),
        ];
      }
      const digits = item.seriesName?.includes('%') ? 2 : item.seriesName === '夏普' ? 2 : valueDigits;
      return [`<div class="chart-tooltip-row"><span>${item.marker ?? ''}${item.seriesName ?? ''}</span><b>${formatChartNumber(value, digits)}</b></div>`];
    });
    return `<div class="chart-tooltip"><div class="chart-tooltip-title">${titleText}</div>${rows.join('')}</div>`;
  }

  if (history.length === 0) {
    return <div className="mt-5 rounded-[1.4rem] bg-[#fffaf0]/70 p-6 text-sm font-semibold text-ink/55">{loading ? '正在加载历史数据…' : emptyHint}</div>;
  }

  const candleBarWidth = metrics.points.length <= 12 ? 8 : metrics.points.length <= 32 ? 10 : '42%';
  const chartSeries = [
    activeMetricSet.has('kline') && {
      name: 'K线',
      type: 'candlestick',
      data: klineData,
      itemStyle: {
        color: candleStyle.upFill,
        color0: candleStyle.downFill,
        borderColor: candleStyle.up,
        borderColor0: candleStyle.down,
        borderColorDoji: '#f4b740',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          color: candleStyle.up,
          color0: candleStyle.down,
          borderColor: candleStyle.up,
          borderColor0: candleStyle.down,
          borderWidth: 1.6,
        },
      },
      barWidth: candleBarWidth,
      barMinWidth: 2,
      barMaxWidth: 10,
      large: true,
      largeThreshold: 600,
      z: 4,
    },
    activeMetricSet.has('close') && {
      name: primaryLabel,
      type: 'line',
      smooth: false,
      symbol: 'none',
      symbolSize: 0,
      showSymbol: false,
      lineStyle: { width: 1.05, opacity: 0.62, shadowBlur: 0 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(244,183,64,.08)' },
            { offset: 1, color: 'rgba(244,183,64,0)' },
          ],
        },
      },
      z: 2,
      data: metrics.points.map((point) => point.netValue),
    },
    activeMetricSet.has('return') && {
      name: '区间收益%',
      type: 'line',
      smooth: true,
      symbol: 'none',
      yAxisIndex: 1,
      lineStyle: { width: 2, type: 'dashed', shadowBlur: 14, shadowColor: 'rgba(255,93,82,.42)' },
      data: metrics.points.map((point) => point.cumulativeReturn),
    },
    activeMetricSet.has('drawdown') && {
      name: '回撤%',
      type: 'line',
      smooth: true,
      symbol: 'none',
      yAxisIndex: 1,
      lineStyle: { width: 2, shadowBlur: 12, shadowColor: 'rgba(63,214,160,.38)' },
      areaStyle: { opacity: 0.12 },
      data: metrics.points.map((point) => point.drawdown),
    },
    activeMetricSet.has('annualized') && {
      name: '年化收益%',
      type: 'line',
      smooth: true,
      symbol: 'none',
      yAxisIndex: 1,
      lineStyle: { width: 2, type: 'dashed', shadowBlur: 10, shadowColor: 'rgba(244,183,64,.28)' },
      data: rollingMetrics.annualized,
    },
    activeMetricSet.has('sharpe') && {
      name: '夏普',
      type: 'line',
      smooth: true,
      symbol: 'none',
      yAxisIndex: 1,
      lineStyle: { width: 2, type: 'dotted', shadowBlur: 10, shadowColor: 'rgba(125,226,184,.26)' },
      data: rollingMetrics.sharpe,
    },
    activeMetricSet.has('volatility') && {
      name: '波动率%',
      type: 'line',
      smooth: true,
      symbol: 'none',
      yAxisIndex: 1,
      lineStyle: { width: 2, type: 'dashed', shadowBlur: 10, shadowColor: 'rgba(140,200,255,.28)' },
      data: rollingMetrics.volatility,
    },
    activeMetricSet.has('benchmark') && benchmarkAvailable && {
      name: `${benchmarkName}收益%`,
      type: 'line',
      smooth: true,
      symbol: 'none',
      yAxisIndex: 1,
      lineStyle: { width: 2, type: 'dotted', shadowBlur: 10, shadowColor: 'rgba(140,200,255,.3)' },
      data: metrics.points.map((point) => point.benchmarkReturn ?? null),
    },
    activeMetricSet.has('excess') && benchmarkAvailable && {
      name: '超额收益%',
      type: 'line',
      smooth: true,
      symbol: 'none',
      yAxisIndex: 1,
      lineStyle: { width: 2, type: 'dashed', shadowBlur: 10, shadowColor: 'rgba(181,126,255,.32)' },
      data: metrics.points.map((point) => point.excessReturn ?? null),
    },
  ].filter(Boolean);

  const option = {
    backgroundColor: 'transparent',
    // 中国习惯：涨/收益用红，跌/回撤用绿。净值线保持金色。
    color: ['#ff5d52', '#f7c96b', '#3fd6a0', '#8cc8ff', '#b57eff'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(4, 17, 31, 0.92)',
      borderColor: 'rgba(244, 183, 64, 0.36)',
      textStyle: { color: '#f8fbff', fontWeight: 700 },
      extraCssText: 'border-radius: 10px; box-shadow: 0 18px 48px rgba(0,0,0,.35);',
      formatter: formatTooltip,
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#f4b740', opacity: 0.72 },
        lineStyle: { color: '#f4b740', opacity: 0.52 },
      },
    },
    legend: {
      top: 8,
      right: 14,
      data: chartSeries.map((series) => (series as { name: string }).name),
      textStyle: { color: 'rgba(158,177,199,.86)', fontWeight: 800 },
      itemWidth: 14,
      itemHeight: 7,
    },
    grid: { left: 46, right: 30, top: 54, bottom: 56 },
    dataZoom: [
      { type: 'inside' },
      {
        type: 'slider',
        height: 18,
        bottom: 18,
        borderColor: 'rgba(255,255,255,.1)',
        fillerColor: 'rgba(244,183,64,.12)',
        backgroundColor: 'rgba(255,255,255,.035)',
        handleStyle: { color: '#f4b740' },
        textStyle: { color: '#9eb1c7' },
      },
    ],
    xAxis: {
      type: 'category',
      data: metrics.points.map((point) => point.date),
      axisLabel: { color: 'rgba(158,177,199,.76)', fontWeight: 700 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,.12)' } },
      axisTick: { show: false },
      boundaryGap: true,
    },
    yAxis: [
      {
        type: 'value',
        name: valueAxisName,
        scale: true,
        nameTextStyle: { color: '#9eb1c7', fontWeight: 800 },
        axisLabel: { color: 'rgba(158,177,199,.76)', formatter: (value: number) => formatChartNumber(value, valueDigits), fontWeight: 700 },
        axisPointer: { label: { formatter: ({ value }: { value: number }) => formatChartNumber(value, valueDigits) } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,.055)' } },
      },
      {
        type: 'value',
        name: '%',
        nameTextStyle: { color: '#9eb1c7', fontWeight: 800 },
        axisLabel: { color: '#6f8095', formatter: (value: number) => `${formatChartNumber(value, 2)}%`, fontWeight: 700 },
        axisPointer: { label: { formatter: ({ value }: { value: number }) => `${formatChartNumber(value, 2)}%` } },
        splitLine: { show: false },
      },
    ],
    series: chartSeries,
  };

  return (
    <div className="fund-analysis-radar mt-5" data-testid={testId} aria-label="历史净值研究图">
      <div className="radar-grid" aria-hidden="true" />
      <div className="radar-scanline" aria-hidden="true" />
      {signalFragments.map((item) => <span key={item.text} className={item.className} aria-hidden="true">{item.text}</span>)}
      <div className="radar-header">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h4>{title}</h4>
          <p>{firstPoint?.date ?? '--'} 至 {lastPoint?.date ?? '--'} · {trendTone} · 默认展示 K 线与收盘价，可按需打开收益、回撤、风险与基准指标</p>
        </div>
        <div className="radar-range-tabs" aria-label="走势图时间范围">
          {ranges.map((item) => <Button key={item} size="sm" variant={item === range ? 'default' : 'secondary'} onClick={() => setRange(item)}>{item}</Button>)}
        </div>
      </div>
      <div className="radar-indicator-toolbar" aria-label="走势图指标开关">
        <div className="radar-indicator-group">
          <span>默认指标</span>
          {defaultMetricKeys.map((key) => (
            <Button key={key} size="sm" variant={activeMetricSet.has(key) ? 'default' : 'secondary'} onClick={() => toggleMetric(key)} aria-pressed={activeMetricSet.has(key)}>
              {key === 'close' ? primaryLabel : metricLabels[key]}
            </Button>
          ))}
        </div>
        <div className="radar-indicator-group">
          <span>可选指标</span>
          {availableOptionalMetricKeys.map((key) => (
            <Button key={key} size="sm" variant={activeMetricSet.has(key) ? 'default' : 'secondary'} onClick={() => toggleMetric(key)} aria-pressed={activeMetricSet.has(key)}>
              {metricLabels[key]}
            </Button>
          ))}
        </div>
      </div>
      <div className="radar-chart-frame">
        <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
      </div>
    </div>
  );
}

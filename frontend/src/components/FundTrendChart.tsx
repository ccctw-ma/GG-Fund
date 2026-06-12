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

const formatPercent = (value?: number) => (value === undefined ? '--' : `${value.toFixed(2)}%`);
const formatNumber = (value?: number) => (value === undefined ? '--' : value.toFixed(2));
const buildKlineData = (points: FundHistoryPoint[]) => points.map((point, index) => {
  const fallbackOpen = points[index - 1]?.netValue ?? point.netValue;
  const close = point.close ?? point.netValue;
  const open = point.open ?? fallbackOpen;
  const low = point.low ?? Math.min(open, close);
  const high = point.high ?? Math.max(open, close);
  return [open, close, low, high];
});

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
  const activeMetricSet = useMemo(() => new Set(activeMetrics), [activeMetrics]);
  const lastPoint = metrics.points.at(-1);
  const firstPoint = metrics.points[0];
  const trendTone = metrics.summary.totalReturn >= 0 ? '趋势增强' : '风险收缩';
  const primaryLabel = valueName === '单位净值' ? '收盘价/净值' : valueName;
  const benchmarkAvailable = metrics.summary.benchmarkReturn !== undefined;
  const availableOptionalMetricKeys = optionalMetricKeys.filter((key) => (key === 'benchmark' || key === 'excess' ? benchmarkAvailable : true));

  function toggleMetric(key: MetricKey) {
    setActiveMetrics((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  if (history.length === 0) {
    return <div className="mt-5 rounded-[1.4rem] bg-[#fffaf0]/70 p-6 text-sm font-semibold text-ink/55">{loading ? '正在加载历史数据…' : emptyHint}</div>;
  }

  const chartSeries = [
    activeMetricSet.has('kline') && {
      name: 'K线',
      type: 'candlestick',
      data: klineData,
      itemStyle: {
        color: 'rgba(255, 93, 82, 0.22)',
        color0: 'rgba(63, 214, 160, 0.2)',
        borderColor: 'rgba(255, 130, 118, 0.78)',
        borderColor0: 'rgba(110, 231, 189, 0.72)',
        borderWidth: 1.2,
      },
      barWidth: '30%',
      z: 1,
    },
    activeMetricSet.has('close') && {
      name: primaryLabel,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: false,
      lineStyle: { width: 3, shadowBlur: 14, shadowColor: 'rgba(244,183,64,.38)' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(244,183,64,.16)' },
            { offset: 1, color: 'rgba(244,183,64,0)' },
          ],
        },
      },
      z: 4,
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

  const optionalDetails = [
    activeMetricSet.has('return') && {
      label: '区间收益',
      value: formatPercent(metrics.summary.totalReturn),
      tone: metrics.summary.totalReturn >= 0 ? 'profit-up' : 'profit-down',
      detail: '当前选择时间范围内累计涨跌幅。',
    },
    activeMetricSet.has('drawdown') && {
      label: '最大回撤',
      value: formatPercent(metrics.summary.maxDrawdown),
      tone: 'profit-down',
      detail: '从阶段高点回落的最大幅度。',
    },
    activeMetricSet.has('annualized') && {
      label: '年化收益',
      value: formatPercent(metrics.summary.annualizedReturn),
      tone: metrics.summary.annualizedReturn >= 0 ? 'profit-up' : 'profit-down',
      detail: '按当前时间范围起止净值折算为年化收益，短周期会被放大。',
    },
    activeMetricSet.has('sharpe') && {
      label: '夏普',
      value: formatNumber(metrics.summary.sharpeRatio),
      detail: '以 2% 年化无风险利率近似估算，衡量单位波动承担的超额回报。',
    },
    activeMetricSet.has('volatility') && {
      label: '波动率',
      value: formatPercent(metrics.summary.volatility),
      detail: '由日收益标准差按 252 个交易日年化，越高代表价格波动越大。',
    },
    activeMetricSet.has('benchmark') && benchmarkAvailable && {
      label: `相对基准`,
      value: formatPercent(metrics.summary.benchmarkReturn),
      tone: (metrics.summary.benchmarkReturn ?? 0) >= 0 ? 'profit-up' : 'profit-down',
      detail: `${benchmarkName} 在当前区间内的累计收益，用于和基金走势对照。`,
    },
    activeMetricSet.has('excess') && benchmarkAvailable && {
      label: '超额收益',
      value: formatPercent(metrics.summary.excessReturn),
      tone: (metrics.summary.excessReturn ?? 0) >= 0 ? 'profit-up' : 'profit-down',
      detail: `基金区间收益减去 ${benchmarkName} 区间收益，正值表示跑赢基准。`,
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
    },
    yAxis: [
      {
        type: 'value',
        name: valueAxisName,
        scale: true,
        nameTextStyle: { color: '#9eb1c7', fontWeight: 800 },
        axisLabel: { color: 'rgba(158,177,199,.76)', fontWeight: 700 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,.055)' } },
      },
      {
        type: 'value',
        name: '%',
        nameTextStyle: { color: '#9eb1c7', fontWeight: 800 },
        axisLabel: { color: '#6f8095', formatter: '{value}%', fontWeight: 700 },
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
      <div className="radar-metrics">
        <div>
          <span>{primaryLabel}</span>
          <strong>{metrics.summary.latestNetValue.toFixed(valueName === '收盘价' ? 2 : 4)}</strong>
          <small>{valueAxisName}区间 {metrics.summary.lowNetValue.toFixed(4)} / {metrics.summary.highNetValue.toFixed(4)}</small>
        </div>
        {optionalDetails.map((item) => item && (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong className={'tone' in item && item.tone ? item.tone : undefined}>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
      <div className="radar-chart-frame">
        <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
      </div>
    </div>
  );
}

'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { calculateFundMetrics, selectHistoryRange, type FundRange } from '../fundMetrics';
import type { FundHistoryPoint } from '../types';
import { Button } from './ui/button';

const ranges: FundRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];
const rangeLabels: Record<FundRange, string> = {
  '1W': '五日',
  '1M': '日K',
  '3M': '周K',
  '6M': '半年',
  '1Y': '月K',
  ALL: '更多',
};

const candleStyle = {
  up: '#ff5d52',
  upFill: '#ff5d52',
  down: '#3fd6a0',
  downFill: '#3fd6a0',
};
const movingAverageColors = {
  MA5: '#f4b740',
  MA10: '#8cc8ff',
  MA20: '#b9a4ff',
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
  const previousClose = points[index - 1]?.netValue ?? close * 0.998;
  const open = previousClose;
  const moveRatio = previousClose > 0 ? Math.abs(close / previousClose - 1) : 0;
  const wickRatio = Math.min(Math.max(moveRatio * 0.16, 0.00045), 0.0032);
  const high = Math.max(open, close) * (1 + wickRatio);
  const low = Math.min(open, close) * (1 - wickRatio);
  return [open, close, low, high];
});

const buildMovingAverageSeries = (points: FundHistoryPoint[], windowSize: number) => points.map((_, index) => {
  if (index + 1 < windowSize) return null;
  const slice = points.slice(index + 1 - windowSize, index + 1);
  const total = slice.reduce((sum, point) => sum + point.netValue, 0);
  return total / windowSize;
});

export function FundTrendChart({
  history,
  benchmarkHistory = [],
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
  const visible = useMemo(() => selectHistoryRange(history, range), [history, range]);
  const visibleBenchmark = useMemo(() => selectHistoryRange(benchmarkHistory, range), [benchmarkHistory, range]);
  const metrics = useMemo(() => calculateFundMetrics(visible, visibleBenchmark), [visible, visibleBenchmark]);
  const klineData = useMemo(() => buildKlineData(metrics.points), [metrics.points]);
  const movingAverages = useMemo(() => ({
    MA5: buildMovingAverageSeries(metrics.points, 5),
    MA10: buildMovingAverageSeries(metrics.points, 10),
    MA20: buildMovingAverageSeries(metrics.points, 20),
  }), [metrics.points]);
  const lastPoint = metrics.points.at(-1);
  const firstPoint = metrics.points[0];
  const trendTone = metrics.summary.totalReturn >= 0 ? '趋势增强' : '风险收缩';
  const valueDigits = valueName === '单位净值' ? 4 : 2;

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

  const candleBarWidth = metrics.points.length <= 12 ? 12 : metrics.points.length <= 32 ? 10 : '48%';
  const chartSeries = [
    {
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
      barMinWidth: 4,
      barMaxWidth: 12,
      large: true,
      largeThreshold: 600,
      z: 4,
    },
    {
      name: 'MA5',
      type: 'line',
      smooth: true,
      symbol: 'none',
      showSymbol: false,
      lineStyle: { color: movingAverageColors.MA5, width: 1.3, opacity: 0.9 },
      data: movingAverages.MA5,
      z: 3,
    },
    {
      name: 'MA10',
      type: 'line',
      smooth: true,
      symbol: 'none',
      showSymbol: false,
      lineStyle: { color: movingAverageColors.MA10, width: 1.2, opacity: 0.88 },
      data: movingAverages.MA10,
      z: 3,
    },
    {
      name: 'MA20',
      type: 'line',
      smooth: true,
      symbol: 'none',
      showSymbol: false,
      lineStyle: { color: movingAverageColors.MA20, width: 1.2, opacity: 0.88 },
      data: movingAverages.MA20,
      z: 3,
    },
  ].filter(Boolean);

  const option = {
    backgroundColor: 'transparent',
    // 中国习惯：涨用红，跌用绿。均线沿用页面金色、蓝色、紫色辅助色。
    color: [candleStyle.up, movingAverageColors.MA5, movingAverageColors.MA10, movingAverageColors.MA20],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(5, 18, 32, 0.96)',
      borderColor: 'rgba(255, 255, 255, 0.14)',
      textStyle: { color: '#dce8f5', fontWeight: 700 },
      extraCssText: 'border-radius: 14px; box-shadow: 0 18px 48px rgba(0,0,0,.32); backdrop-filter: blur(18px);',
      formatter: formatTooltip,
      axisPointer: {
        type: 'cross',
      crossStyle: { color: 'rgba(158, 177, 199, .56)', opacity: 0.75, type: 'dashed' },
      lineStyle: { color: 'rgba(158, 177, 199, .56)', opacity: 0.75, type: 'dashed' },
      },
    },
    legend: {
      show: false,
      top: 6,
      right: 14,
      data: chartSeries.map((series) => (series as { name: string }).name),
      textStyle: { color: 'rgba(220,232,245,.86)', fontWeight: 800 },
      itemWidth: 12,
      itemHeight: 6,
    },
    grid: { left: 48, right: 24, top: 18, bottom: 34 },
    dataZoom: [
      { type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true },
    ],
    xAxis: {
      type: 'category',
      data: metrics.points.map((point) => point.date),
      axisLabel: { color: '#9eb1c7', fontWeight: 700, margin: 12 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,.14)' } },
      axisTick: { show: false },
      boundaryGap: true,
    },
    yAxis: [
      {
        type: 'value',
        name: '',
        scale: true,
        nameTextStyle: { color: '#9eb1c7', fontWeight: 800 },
        axisLabel: { color: '#9eb1c7', formatter: (value: number) => formatChartNumber(value, valueDigits), fontWeight: 700 },
        axisPointer: { label: { formatter: ({ value }: { value: number }) => formatChartNumber(value, valueDigits) } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,.08)' } },
      },
    ],
    series: chartSeries,
  };

  return (
    <div className="fund-analysis-radar mt-5" data-testid={testId} aria-label="历史净值研究图">
      <div className="radar-grid" aria-hidden="true" />
      <div className="radar-scanline" aria-hidden="true" />
      <div className="radar-header">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h4>{title}</h4>
          <p>{firstPoint?.date ?? '--'} 至 {lastPoint?.date ?? '--'} · {valueAxisName} · {trendTone}</p>
        </div>
        <div className="radar-range-tabs" aria-label="走势图时间范围">
          {ranges.map((item) => <Button key={item} className={item === range ? 'is-active' : undefined} size="sm" variant={item === range ? 'default' : 'secondary'} onClick={() => setRange(item)}>{rangeLabels[item]}</Button>)}
        </div>
      </div>
      <div className="chart-ma-strip" aria-label="移动均线数值">
        {(Object.entries(movingAverages) as Array<[keyof typeof movingAverages, Array<number | null>]>).map(([label, values]) => {
          const latestValue = [...values].reverse().find((value): value is number => typeof value === 'number' && Number.isFinite(value));
          return (
            <span key={label} className="chart-ma-token" style={{ '--ma-color': movingAverageColors[label] } as CSSProperties}>
              {label}: {formatChartNumber(latestValue, valueDigits)}
            </span>
          );
        })}
      </div>
      <div className="radar-chart-frame">
        <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
      </div>
    </div>
  );
}

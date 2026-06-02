'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo, useState } from 'react';
import { calculateFundMetrics, selectHistoryRange, type FundRange } from '../fundMetrics';
import type { FundHistoryPoint } from '../types';
import { Button } from './ui/button';

const ranges: FundRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];
const signalFragments = [
  { text: 'NAV.core()', className: 'radar-fragment radar-fragment-a' },
  { text: 'drawdown.guard', className: 'radar-fragment radar-fragment-b' },
  { text: 'momentum.flow', className: 'radar-fragment radar-fragment-c' },
  { text: 'risk.signal', className: 'radar-fragment radar-fragment-d' },
  { text: 'position.trace', className: 'radar-fragment radar-fragment-e' },
];

export function FundTrendChart({
  history,
  kicker = 'Fund Signal Matrix',
  title = '基金分析走势图',
  valueName = '单位净值',
  valueAxisName = '净值',
  emptyHint = '暂无历史净值数据，选择其他基金或稍后重试。',
  loading = false,
  testId = 'fund-chart',
}: {
  history: FundHistoryPoint[];
  kicker?: string;
  title?: string;
  valueName?: string;
  valueAxisName?: string;
  emptyHint?: string;
  loading?: boolean;
  testId?: string;
}) {
  const [range, setRange] = useState<FundRange>('1M');
  const visible = useMemo(() => selectHistoryRange(history, range), [history, range]);
  const metrics = useMemo(() => calculateFundMetrics(visible), [visible]);
  const lastPoint = metrics.points.at(-1);
  const firstPoint = metrics.points[0];
  const trendTone = metrics.summary.totalReturn >= 0 ? '趋势增强' : '风险收缩';

  if (history.length === 0) {
    return <div className="mt-5 rounded-[1.4rem] bg-[#fffaf0]/70 p-6 text-sm font-semibold text-ink/55">{loading ? '正在加载历史数据…' : emptyHint}</div>;
  }

  const option = {
    backgroundColor: 'transparent',
    color: ['#f7c96b', '#7de2b8', '#ff8a80'],
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
      top: 10,
      right: 18,
      data: [valueName, '区间收益%', '回撤%'],
      textStyle: { color: '#9eb1c7', fontWeight: 800 },
      itemWidth: 18,
      itemHeight: 8,
    },
    grid: { left: 46, right: 30, top: 62, bottom: 58 },
    dataZoom: [
      { type: 'inside' },
      {
        type: 'slider',
        height: 18,
        bottom: 18,
        borderColor: 'rgba(255,255,255,.1)',
        fillerColor: 'rgba(244,183,64,.18)',
        backgroundColor: 'rgba(255,255,255,.05)',
        handleStyle: { color: '#f4b740' },
        textStyle: { color: '#9eb1c7' },
      },
    ],
    xAxis: {
      type: 'category',
      data: metrics.points.map((point) => point.date),
      axisLabel: { color: '#6f8095', fontWeight: 700 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,.12)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: valueAxisName,
        scale: true,
        nameTextStyle: { color: '#9eb1c7', fontWeight: 800 },
        axisLabel: { color: '#6f8095', fontWeight: 700 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,.07)' } },
      },
      {
        type: 'value',
        name: '%',
        nameTextStyle: { color: '#9eb1c7', fontWeight: 800 },
        axisLabel: { color: '#6f8095', formatter: '{value}%', fontWeight: 700 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: valueName,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: false,
        lineStyle: { width: 4, shadowBlur: 18, shadowColor: 'rgba(244,183,64,.58)' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(244,183,64,.28)' },
              { offset: 1, color: 'rgba(244,183,64,0)' },
            ],
          },
        },
        data: metrics.points.map((point) => point.netValue),
      },
      {
        name: '区间收益%',
        type: 'line',
        smooth: true,
        symbol: 'none',
        yAxisIndex: 1,
        lineStyle: { width: 2, type: 'dashed', shadowBlur: 14, shadowColor: 'rgba(125,226,184,.42)' },
        data: metrics.points.map((point) => point.cumulativeReturn),
      },
      {
        name: '回撤%',
        type: 'line',
        smooth: true,
        symbol: 'none',
        yAxisIndex: 1,
        lineStyle: { width: 2, shadowBlur: 12, shadowColor: 'rgba(255,138,128,.38)' },
        areaStyle: { opacity: 0.12 },
        data: metrics.points.map((point) => point.drawdown),
      },
    ],
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
          <p>{firstPoint?.date ?? '--'} 至 {lastPoint?.date ?? '--'} · {trendTone} · {valueAxisName} / 收益 / 回撤同屏监控</p>
        </div>
        <div className="radar-range-tabs" aria-label="走势图时间范围">
          {ranges.map((item) => <Button key={item} size="sm" variant={item === range ? 'default' : 'secondary'} onClick={() => setRange(item)}>{item}</Button>)}
        </div>
      </div>
      <div className="radar-metrics">
        <div>
          <span>区间收益</span>
          <strong className={metrics.summary.totalReturn >= 0 ? 'profit-up' : 'profit-down'}>{metrics.summary.totalReturn.toFixed(2)}%</strong>
        </div>
        <div>
          <span>最大回撤</span>
          <strong className="profit-down">{metrics.summary.maxDrawdown.toFixed(2)}%</strong>
        </div>
        <div>
          <span>最新净值</span>
          <strong>{metrics.summary.latestNetValue.toFixed(4)}</strong>
        </div>
        <div>
          <span>净值区间</span>
          <strong>{metrics.summary.lowNetValue.toFixed(4)} / {metrics.summary.highNetValue.toFixed(4)}</strong>
        </div>
      </div>
      <div className="radar-chart-frame">
        <ReactECharts option={option} style={{ height: 360, width: '100%' }} notMerge lazyUpdate />
      </div>
    </div>
  );
}

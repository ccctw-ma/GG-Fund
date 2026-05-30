'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo, useState } from 'react';
import { calculateFundMetrics, selectHistoryRange, type FundRange } from '../fundMetrics';
import type { FundHistoryPoint } from '../types';
import { Button } from './ui/button';

const ranges: FundRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

export function FundTrendChart({ history }: { history: FundHistoryPoint[] }) {
  const [range, setRange] = useState<FundRange>('1M');
  const visible = useMemo(() => selectHistoryRange(history, range), [history, range]);
  const metrics = useMemo(() => calculateFundMetrics(visible), [visible]);

  if (history.length === 0) {
    return <div className="mt-5 rounded-[1.4rem] bg-[#fffaf0]/70 p-6 text-sm font-semibold text-ink/55">暂无历史净值数据，选择其他基金或稍后重试。</div>;
  }

  const option = {
    backgroundColor: 'transparent',
    color: ['#047857', '#2563eb', '#dc2626'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { top: 0, data: ['单位净值', '区间收益%', '回撤%'] },
    grid: { left: 44, right: 20, top: 48, bottom: 54 },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 18 }],
    xAxis: { type: 'category', data: metrics.points.map((point) => point.date), axisLabel: { color: '#68746b' } },
    yAxis: [
      { type: 'value', name: '净值', scale: true, axisLabel: { color: '#68746b' } },
      { type: 'value', name: '%', axisLabel: { color: '#68746b', formatter: '{value}%' } },
    ],
    series: [
      { name: '单位净值', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3 }, data: metrics.points.map((point) => point.netValue) },
      { name: '区间收益%', type: 'line', smooth: true, symbol: 'none', yAxisIndex: 1, lineStyle: { width: 2, type: 'dashed' }, data: metrics.points.map((point) => point.cumulativeReturn) },
      { name: '回撤%', type: 'line', smooth: true, symbol: 'none', yAxisIndex: 1, areaStyle: { opacity: 0.08 }, data: metrics.points.map((point) => point.drawdown) },
    ],
  };

  return (
    <div className="mt-5 rounded-[1.4rem] bg-[#fffaf0]/70 p-3" data-testid="fund-chart" aria-label="历史净值研究图">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-ink/70">
          <span>区间收益 <strong className={metrics.summary.totalReturn >= 0 ? 'text-[var(--bull)]' : 'text-[var(--bear)]'}>{metrics.summary.totalReturn.toFixed(2)}%</strong></span>
          <span>最大回撤 <strong className="text-[var(--bear)]">{metrics.summary.maxDrawdown.toFixed(2)}%</strong></span>
          <span>最新净值 <strong>{metrics.summary.latestNetValue.toFixed(4)}</strong></span>
        </div>
        <div className="flex flex-wrap gap-1">
          {ranges.map((item) => <Button key={item} size="sm" variant={item === range ? 'default' : 'secondary'} onClick={() => setRange(item)}>{item}</Button>)}
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 320, width: '100%' }} notMerge lazyUpdate />
    </div>
  );
}

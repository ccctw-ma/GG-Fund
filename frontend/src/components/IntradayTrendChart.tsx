'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import type { FundIntradayPoint } from '../types';

function cutoffTimeFromEstimate(estimateTime?: string) {
  const match = estimateTime?.match(/(?:^|\s)(\d{2}):(\d{2})(?::\d{2})?/);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

const buildIntradayKlineData = (points: FundIntradayPoint[]) => points.map((point, index) => {
  const fallbackOpen = points[index - 1]?.price ?? point.price;
  const close = point.close ?? point.price;
  const open = point.open ?? fallbackOpen;
  const low = point.low ?? Math.min(open, close);
  const high = point.high ?? Math.max(open, close);
  return [open, close, low, high];
});

export function IntradayTrendChart({
  points,
  title,
  dailyChangePercent,
  estimateTime,
  loading = false,
}: {
  points: FundIntradayPoint[];
  title: string;
  dailyChangePercent?: number;
  estimateTime?: string;
  loading?: boolean;
}) {
  const cutoffTime = cutoffTimeFromEstimate(estimateTime);
  const visiblePoints = useMemo(
    () => (cutoffTime ? points.filter((point) => point.time <= cutoffTime) : points),
    [cutoffTime, points],
  );
  const klineData = useMemo(() => buildIntradayKlineData(visiblePoints), [visiblePoints]);

  if (visiblePoints.length === 0) {
    return (
      <div className="intraday-empty">
        {loading ? '正在加载当日分时走势…' : '当前公开接口只返回单点实时估算，暂未拿到分钟级走势。ETF、股票类可交易标的一般可查看分时线。'}
      </div>
    );
  }

  const latest = visiblePoints.at(-1);
  const first = visiblePoints[0];
  const change = latest && first ? latest.price - first.price : 0;
  const displayedChange = dailyChangePercent ?? change;
  const source = latest?.source ?? first?.source ?? '公开行情接口';
  const sourceType = latest?.sourceType ?? first?.sourceType ?? 'direct';
  const option = {
    backgroundColor: 'transparent',
    color: ['#ff5d52', '#f7c96b', '#3fd6a0'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(4, 17, 31, 0.92)',
      borderColor: 'rgba(255, 93, 82, 0.36)',
      textStyle: { color: '#f8fbff', fontWeight: 700 },
    },
    legend: {
      top: 4,
      right: 12,
      data: ['分时K线', '分时价格', '均价'],
      textStyle: { color: '#9eb1c7', fontWeight: 800 },
    },
    grid: { left: 38, right: 18, top: 42, bottom: 30 },
    xAxis: {
      type: 'category',
      data: visiblePoints.map((point) => point.time),
      axisLabel: { color: '#6f8095', fontWeight: 700 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,.12)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#6f8095', fontWeight: 700 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,.07)' } },
    },
    series: [
      {
        name: '分时K线',
        type: 'candlestick',
        data: klineData,
        itemStyle: {
          color: '#ff5d52',
          color0: '#3fd6a0',
          borderColor: '#ff8a7f',
          borderColor0: '#6ee7bd',
        },
        barWidth: '52%',
        z: 2,
      },
      {
        name: '分时价格',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, shadowBlur: 12, shadowColor: 'rgba(255,93,82,.36)' },
        areaStyle: { opacity: 0.12 },
        data: visiblePoints.map((point) => point.price),
      },
      visiblePoints.some((point) => point.average !== undefined) && {
        name: '均价',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed', shadowBlur: 10, shadowColor: 'rgba(247,201,107,.28)' },
        data: visiblePoints.map((point) => point.average ?? null),
      },
    ].filter(Boolean),
  };

  return (
    <div className="intraday-chart-card" data-testid="intraday-trend-chart">
      <div className="intraday-chart-head">
        <div>
          <div className="intraday-title-line">
            <strong>{title}</strong>
            <small className={sourceType === 'estimated' ? 'intraday-source-badge is-estimated' : 'intraday-source-badge'}>{sourceType === 'estimated' ? '近似走势' : '真实分时'}</small>
          </div>
          <span>{visiblePoints[0]?.time} - {latest?.time} · {visiblePoints.length} 个分时点 · 已叠加分时K线</span>
          {dailyChangePercent !== undefined && (
            <span className="intraday-basis-line">收益口径：按日涨跌 {dailyChangePercent >= 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}%</span>
          )}
          <span className="intraday-source-line">数据来源：{source}</span>
        </div>
        <em className={displayedChange >= 0 ? 'profit-up' : 'profit-down'}>
          {displayedChange >= 0 ? '+' : ''}
          {dailyChangePercent !== undefined ? `${displayedChange.toFixed(2)}%` : displayedChange.toFixed(4)}
        </em>
      </div>
      <ReactECharts option={option} style={{ height: 260, width: '100%' }} notMerge lazyUpdate />
    </div>
  );
}

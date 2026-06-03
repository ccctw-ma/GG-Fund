import type { FundHistoryPoint } from './types';

export type FundRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export type FundMetricPoint = FundHistoryPoint & {
  cumulativeReturn: number;
  drawdown: number;
};

export type FundMetricSummary = {
  totalReturn: number;
  maxDrawdown: number;
  latestNetValue: number;
  highNetValue: number;
  lowNetValue: number;
};

const rangeDays: Record<Exclude<FundRange, 'ALL'>, number> = {
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 366,
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function selectHistoryRange(history: FundHistoryPoint[], range: FundRange) {
  if (range === 'ALL' || history.length === 0) return history;
  const latest = new Date(history.at(-1)?.date ?? '').getTime();
  if (Number.isNaN(latest)) return history;
  const cutoff = latest - rangeDays[range] * 24 * 60 * 60 * 1000;
  const selected = history.filter((point) => new Date(point.date).getTime() >= cutoff);
  return selected.length >= 2 ? selected : history;
}

export function calculateFundMetrics(history: FundHistoryPoint[]) {
  const first = history[0]?.netValue ?? 0;
  let high = first;
  let maxDrawdown = 0;
  const points: FundMetricPoint[] = history.map((point) => {
    high = Math.max(high, point.netValue);
    const cumulativeReturn = first ? round2(((point.netValue - first) / first) * 100) : 0;
    const drawdown = high ? round2(((point.netValue - high) / high) * 100) : 0;
    maxDrawdown = Math.min(maxDrawdown, drawdown);
    return { ...point, cumulativeReturn, drawdown };
  });
  const values = history.map((point) => point.netValue);
  return {
    points,
    summary: {
      totalReturn: points.at(-1)?.cumulativeReturn ?? 0,
      maxDrawdown,
      latestNetValue: values.at(-1) ?? 0,
      highNetValue: values.length ? Math.max(...values) : 0,
      lowNetValue: values.length ? Math.min(...values) : 0,
    } satisfies FundMetricSummary,
  };
}

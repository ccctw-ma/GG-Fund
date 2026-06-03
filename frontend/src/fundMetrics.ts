import type { FundHistoryPoint } from './types';

export type FundRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export type FundMetricPoint = FundHistoryPoint & {
  cumulativeReturn: number;
  drawdown: number;
  benchmarkReturn?: number;
  excessReturn?: number;
};

export type FundMetricSummary = {
  totalReturn: number;
  maxDrawdown: number;
  latestNetValue: number;
  highNetValue: number;
  lowNetValue: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  benchmarkReturn?: number;
  excessReturn?: number;
};

const rangeDays: Record<Exclude<FundRange, 'ALL'>, number> = {
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 366,
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const tradingDaysPerYear = 252;
const calendarDaysPerYear = 365;
const riskFreeRate = 2;

function daysBetween(start?: string, end?: string) {
  if (!start || !end) return 0;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return 0;
  return Math.max(1, Math.round((endTime - startTime) / (24 * 60 * 60 * 1000)));
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function dailyReturns(history: FundHistoryPoint[]) {
  const returns: number[] = [];
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1]?.netValue;
    const current = history[index]?.netValue;
    if (previous && current) returns.push(current / previous - 1);
  }
  return returns;
}

function annualizedReturn(totalReturn: number, days: number) {
  if (days <= 0) return totalReturn;
  const ratio = 1 + totalReturn / 100;
  if (ratio <= 0) return -100;
  return round2((ratio ** (calendarDaysPerYear / days) - 1) * 100);
}

function benchmarkReturnByDate(benchmarkHistory: FundHistoryPoint[], targetDates: string[]) {
  const byDate = new Map<string, number>();
  if (benchmarkHistory.length === 0) return byDate;
  const sorted = [...benchmarkHistory].sort((a, b) => a.date.localeCompare(b.date));
  const base = sorted[0]?.netValue;
  if (!base) return byDate;
  let benchmarkIndex = 0;
  for (const date of targetDates) {
    while (benchmarkIndex + 1 < sorted.length && sorted[benchmarkIndex + 1].date <= date) {
      benchmarkIndex += 1;
    }
    const point = sorted[benchmarkIndex];
    if (point && point.date <= date) {
      byDate.set(date, round2(((point.netValue - base) / base) * 100));
    }
  }
  return byDate;
}

export function selectHistoryRange(history: FundHistoryPoint[], range: FundRange) {
  if (range === 'ALL' || history.length === 0) return history;
  const latest = new Date(history.at(-1)?.date ?? '').getTime();
  if (Number.isNaN(latest)) return history;
  const cutoff = latest - rangeDays[range] * 24 * 60 * 60 * 1000;
  const selected = history.filter((point) => new Date(point.date).getTime() >= cutoff);
  return selected.length >= 2 ? selected : history;
}

export function calculateFundMetrics(history: FundHistoryPoint[], benchmarkHistory: FundHistoryPoint[] = []) {
  const first = history[0]?.netValue ?? 0;
  let high = first;
  const selectedBenchmark = benchmarkHistory.length > 0 ? selectHistoryRange(benchmarkHistory, 'ALL').filter((point) => {
    const date = new Date(point.date).getTime();
    const start = new Date(history[0]?.date ?? '').getTime();
    const end = new Date(history.at(-1)?.date ?? '').getTime();
    return Number.isFinite(date) && Number.isFinite(start) && Number.isFinite(end) && date >= start && date <= end;
  }) : [];
  const benchmarkReturns = benchmarkReturnByDate(selectedBenchmark, history.map((point) => point.date));
  let maxDrawdown = 0;
  const points: FundMetricPoint[] = history.map((point) => {
    high = Math.max(high, point.netValue);
    const cumulativeReturn = first ? round2(((point.netValue - first) / first) * 100) : 0;
    const drawdown = high ? round2(((point.netValue - high) / high) * 100) : 0;
    const benchmarkReturn = benchmarkReturns.get(point.date);
    maxDrawdown = Math.min(maxDrawdown, drawdown);
    const metricPoint: FundMetricPoint = {
      ...point,
      cumulativeReturn,
      drawdown,
    };
    if (benchmarkReturn !== undefined) {
      metricPoint.benchmarkReturn = benchmarkReturn;
      metricPoint.excessReturn = round2(cumulativeReturn - benchmarkReturn);
    }
    return metricPoint;
  });
  const values = history.map((point) => point.netValue);
  const returns = dailyReturns(history);
  const volatility = round2(standardDeviation(returns) * Math.sqrt(tradingDaysPerYear) * 100);
  const periodDays = daysBetween(history[0]?.date, history.at(-1)?.date);
  const totalReturn = points.at(-1)?.cumulativeReturn ?? 0;
  const annualized = annualizedReturn(totalReturn, periodDays);
  let benchmarkReturn: number | undefined;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index]?.benchmarkReturn !== undefined) {
      benchmarkReturn = points[index]?.benchmarkReturn;
      break;
    }
  }
  return {
    points,
    summary: {
      totalReturn,
      maxDrawdown,
      latestNetValue: values.at(-1) ?? 0,
      highNetValue: values.length ? Math.max(...values) : 0,
      lowNetValue: values.length ? Math.min(...values) : 0,
      annualizedReturn: annualized,
      volatility,
      sharpeRatio: volatility === 0 ? 0 : round2((annualized - riskFreeRate) / volatility),
      benchmarkReturn,
      excessReturn: benchmarkReturn === undefined ? undefined : round2(totalReturn - benchmarkReturn),
    } satisfies FundMetricSummary,
  };
}

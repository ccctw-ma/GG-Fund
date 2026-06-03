import { describe, expect, it } from 'vitest';
import { calculateFundMetrics, selectHistoryRange } from './fundMetrics';

const history = [
  { date: '2026-01-01', netValue: 1.0 },
  { date: '2026-01-02', netValue: 1.1 },
  { date: '2026-01-03', netValue: 1.05 },
  { date: '2026-01-04', netValue: 1.2 },
];

describe('fund metrics', () => {
  it('calculates cumulative return and max drawdown for visible history', () => {
    const metrics = calculateFundMetrics(history);

    expect(metrics.points).toEqual([
      { date: '2026-01-01', netValue: 1.0, cumulativeReturn: 0, drawdown: 0 },
      { date: '2026-01-02', netValue: 1.1, cumulativeReturn: 10, drawdown: 0 },
      { date: '2026-01-03', netValue: 1.05, cumulativeReturn: 5, drawdown: -4.55 },
      { date: '2026-01-04', netValue: 1.2, cumulativeReturn: 20, drawdown: 0 },
    ]);
    expect(metrics.summary).toEqual({ totalReturn: 20, maxDrawdown: -4.55, latestNetValue: 1.2, highNetValue: 1.2, lowNetValue: 1.0 });
  });

  it('selects a trailing range by calendar days', () => {
    const visible = selectHistoryRange([
      { date: '2026-01-01', netValue: 1 },
      { date: '2026-02-01', netValue: 1.1 },
      { date: '2026-03-01', netValue: 1.2 },
    ], '1M');

    expect(visible).toEqual([
      { date: '2026-02-01', netValue: 1.1 },
      { date: '2026-03-01', netValue: 1.2 },
    ]);
  });

  it('selects a one-week trailing range', () => {
    const visible = selectHistoryRange([
      { date: '2026-03-01', netValue: 1 },
      { date: '2026-03-20', netValue: 1.1 },
      { date: '2026-03-25', netValue: 1.15 },
      { date: '2026-03-26', netValue: 1.2 },
    ], '1W');

    expect(visible).toEqual([
      { date: '2026-03-20', netValue: 1.1 },
      { date: '2026-03-25', netValue: 1.15 },
      { date: '2026-03-26', netValue: 1.2 },
    ]);
  });
});

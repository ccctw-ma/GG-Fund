import { describe, expect, it } from 'vitest';
import type { FundQuote, Holding } from './types';
import { calculatePortfolioSummary } from './portfolio';

const holdings: Holding[] = [
  {
    id: 'h-1',
    fundCode: '000001',
    fundName: '华夏成长混合',
    shares: 1000,
    costAmount: 1200,
    purchaseDate: '2024-01-01',
    createdAt: '2026-05-28T00:00:00.000Z',
    updatedAt: '2026-05-28T00:00:00.000Z',
  },
  {
    id: 'h-2',
    fundCode: '110022',
    fundName: '易方达消费行业股票',
    shares: 500,
    costAmount: 900,
    createdAt: '2026-05-28T00:00:00.000Z',
    updatedAt: '2026-05-28T00:00:00.000Z',
  },
];

const quotes: Record<string, FundQuote> = {
  '000001': {
    code: '000001',
    name: '华夏成长混合',
    netValue: 1.35,
    dailyChangePercent: 0.8,
    quoteDate: '2026-05-28',
    source: 'test',
  },
  '110022': {
    code: '110022',
    name: '易方达消费行业股票',
    netValue: 1.6,
    dailyChangePercent: -0.2,
    quoteDate: '2026-05-28',
    source: 'test',
  },
};

describe('calculatePortfolioSummary', () => {
  it('calculates market value, profit, return rate, and weights from local holdings and quotes', () => {
    const summary = calculatePortfolioSummary(holdings, quotes);

    expect(summary.totalCost).toBe(2100);
    expect(summary.totalMarketValue).toBe(2150);
    expect(summary.totalProfit).toBe(50);
    expect(summary.totalReturnRate).toBeCloseTo(2.38095, 4);
    expect(summary.items).toHaveLength(2);
    expect(summary.items[0]).toMatchObject({
      fundCode: '000001',
      marketValue: 1350,
      profit: 150,
      returnRate: 12.5,
    });
    expect(summary.items[0].weight).toBeCloseTo(62.7907, 4);
    expect(summary.items[1].weight).toBeCloseTo(37.2093, 4);
  });

  it('keeps holdings with missing quotes visible and marks their quote status', () => {
    const summary = calculatePortfolioSummary(holdings, { '000001': quotes['000001'] });

    expect(summary.totalMarketValue).toBe(1350);
    expect(summary.items[1]).toMatchObject({
      fundCode: '110022',
      marketValue: 0,
      profit: -900,
      quoteStatus: 'missing',
    });
  });
});

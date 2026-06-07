import { describe, expect, it } from 'vitest';
import type { FundQuote, Holding } from './types';
import { calculatePortfolioSummary } from './portfolio';

const tradingDay = new Date('2026-05-28T10:30:00+08:00');

const holdings: Holding[] = [
  {
    id: 'h-1',
    fundCode: '000001',
    fundName: '华夏成长混合',
    shares: 1000,
    costAmount: 1200,
    purchaseDate: '2024-01-01',
    accountName: '家庭账本',
    platform: 'alipay',
    targetWeight: 45,
    createdAt: '2026-05-28T00:00:00.000Z',
    updatedAt: '2026-05-28T00:00:00.000Z',
  },
  {
    id: 'h-2',
    fundCode: '110022',
    fundName: '易方达消费行业股票',
    shares: 500,
    costAmount: 900,
    accountName: '长期定投',
    platform: 'tiantian',
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
    const summary = calculatePortfolioSummary(holdings, quotes, {}, tradingDay);

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
    expect(summary.estimatedDailyProfit).toBeCloseTo(9.1111, 4);
    expect(summary.dailyProfitAvailable).toBe(true);
    expect(summary.liveQuoteRatio).toBe(100);
    expect(summary.ledgers.map((ledger) => ledger.platform)).toEqual(['支付宝', '天天基金']);
    expect(summary.riskSignals.map((signal) => signal.title)).toContain('单只集中度偏高');
    expect(summary.reportSignals.map((signal) => signal.title)).toContain('今日估算收益');
    expect(summary.actionSignals.map((signal) => signal.title)).toContain('加减仓观察');
    expect(summary.plan.amount).toBe(100);
  });

  it('uses the fund name returned by the code quote as the canonical holding name', () => {
    const summary = calculatePortfolioSummary(
      [{ ...holdings[0], fundName: '人到指数基金多他广发电力公用事业ETF' }],
      {
        '000001': {
          ...quotes['000001'],
          name: '华夏成长混合',
        },
      },
      {},
      tradingDay,
    );

    expect(summary.items[0].fundName).toBe('华夏成长混合');
    expect(summary.reportSignals.find((signal) => signal.title === '贡献拆解')?.detail).toContain('华夏成长混合');
  });

  it('keeps holdings with missing quotes visible and marks their quote status', () => {
    const summary = calculatePortfolioSummary(holdings, { '000001': quotes['000001'] }, {}, tradingDay);

    expect(summary.totalMarketValue).toBe(1350);
    expect(summary.items[1]).toMatchObject({
      fundCode: '110022',
      marketValue: 0,
      profit: -900,
      quoteStatus: 'missing',
    });
    expect(summary.liveQuoteRatio).toBe(50);
    expect(summary.riskSignals.map((signal) => signal.title)).toContain('净值缺失');
  });

  it('revalues imported amount-only holdings from historical net values and live quotes', () => {
    const summary = calculatePortfolioSummary(
      [
        {
          id: 'h-3',
          fundCode: '161725',
          fundName: '招商中证白酒指数',
          recordedMarketValue: 1000,
          costAmount: 900,
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
      {
        '161725': {
          code: '161725',
          name: '招商中证白酒指数',
          netValue: 1.2,
          dailyChangePercent: 2,
          quoteDate: '2026-05-29',
          source: 'test',
        },
      },
      {
        '161725': [
          { date: '2026-04-30', netValue: 1 },
          { date: '2026-05-29', netValue: 1.2 },
        ],
      },
      new Date('2026-05-29T10:30:00+08:00'),
    );

    expect(summary.totalMarketValue).toBeCloseTo(1200, 2);
    expect(summary.totalProfit).toBeCloseTo(300, 2);
    expect(summary.totalReturnRate).toBeCloseTo(33.3333, 4);
    expect(summary.estimatedDailyProfit).toBeCloseTo(23.5294, 4);
    expect(summary.items[0]).toMatchObject({
      marketValue: 1200,
      profit: 300,
      quoteStatus: 'ok',
    });
  });

  it('shows the latest quoted daily profit on weekends and labels the quote date', () => {
    const summary = calculatePortfolioSummary(
      holdings,
      quotes,
      {},
      new Date('2026-06-07T10:30:00+08:00'),
    );

    expect(summary.dailyProfitAvailable).toBe(true);
    expect(summary.dailyProfitIsCurrent).toBe(false);
    expect(summary.dailyProfitDate).toBe('2026-05-28');
    expect(summary.estimatedDailyProfit).toBeCloseTo(9.1111, 4);
    expect(summary.items.every((item) => item.dailyProfitAvailable === true)).toBe(true);
    expect(summary.reportSignals.find((signal) => signal.title === '2026-05-28估算收益')?.detail).toContain('2026-05-28');
  });

  it('uses estimate time as the daily profit date for intraday estimates', () => {
    const summary = calculatePortfolioSummary(
      [holdings[0]],
      {
        '000001': {
          ...quotes['000001'],
          quoteDate: '2026-06-04',
          estimateTime: '2026-06-05 15:00',
          quoteType: 'estimate',
        },
      },
      {},
      new Date('2026-06-07T10:30:00+08:00'),
    );

    expect(summary.dailyProfitDate).toBe('2026-06-05');
    expect(summary.dailyProfitAvailable).toBe(true);
    expect(summary.dailyProfitIsCurrent).toBe(false);
  });
});

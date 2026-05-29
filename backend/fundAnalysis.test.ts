import { describe, expect, it } from 'vitest';
import { buildResearchPrompt, computeFundIndicators, normalizeAnalysisReport } from './fundAnalysis';

const history = [
  { date: '2026-01-01', netValue: 1.0 },
  { date: '2026-01-02', netValue: 1.1 },
  { date: '2026-01-03', netValue: 1.05 },
  { date: '2026-01-04', netValue: 1.2 },
];

describe('fund analysis agent helpers', () => {
  it('computes deterministic indicators from fund history', () => {
    expect(computeFundIndicators(history)).toEqual({
      totalReturn: 20,
      maxDrawdown: -4.55,
      shortMomentum: 20,
      volatility: expect.any(Number),
      trendSlope: expect.any(Number),
      sampleSize: 4,
    });
  });

  it('builds a prompt with fund, indicators, history, indices, and an output contract', () => {
    const prompt = buildResearchPrompt({
      fund: { code: '000001', name: '华夏成长混合', netValue: 1.2, quoteDate: '2026-01-04', source: 'test' },
      history,
      indices: [{ code: '000001.SH', name: '上证指数', value: 4098, change: 1, changePercent: 0.1, quoteTime: '2026-01-04 15:00:00' }],
      indicators: computeFundIndicators(history),
    });

    expect(prompt).toContain('华夏成长混合');
    expect(prompt).toContain('maxDrawdown');
    expect(prompt).toContain('scenarios');
    expect(prompt).toContain('不构成投资建议');
  });

  it('normalizes imperfect upstream text into report sections', () => {
    const report = normalizeAnalysisReport('趋势偏强，但需要注意回撤。');

    expect(report.summary).toContain('趋势偏强');
    expect(report.scenarios.length).toBeGreaterThan(0);
    expect(report.disclaimer).toContain('不构成投资建议');
  });
});

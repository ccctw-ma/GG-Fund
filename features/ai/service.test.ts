import { describe, expect, it } from 'vitest';
import { buildAnalyzeFundResponse, normalizeAnalyzeFundRequest } from './service';

const marketService = {
  getFund: async () => ({
    code: '000001',
    name: '华夏成长混合',
    netValue: 1.35,
    officialNetValue: 1.33,
    dailyChangePercent: 1.2,
    quoteDate: '2026-05-30',
    estimateTime: '2026-05-30 14:30',
    quoteType: 'estimate' as const,
    source: '天天基金实时估算',
  }),
  getFundHistory: async () => [
    { date: '2026-05-27', netValue: 1.31 },
    { date: '2026-05-28', netValue: 1.32 },
    { date: '2026-05-29', netValue: 1.34 },
    { date: '2026-05-30', netValue: 1.35 },
  ],
  getIndices: async () => [
    { code: '000001.SH', name: '上证指数', value: 3200, change: 10, changePercent: 0.31, quoteTime: '2026-05-30 15:00:00' },
  ],
};

describe('ai service', () => {
  it('validates analyze request payloads', () => {
    expect(normalizeAnalyzeFundRequest({ code: '000001' })).toEqual({ code: '000001' });
    expect(() => normalizeAnalyzeFundRequest({ code: 'ABC' })).toThrow('基金代码格式不正确');
  });

  it('falls back to deterministic analysis when DeepSeek is unavailable', async () => {
    const response = await buildAnalyzeFundResponse(
      { code: '000001' },
      { marketService, deepSeekApiKey: undefined },
    );

    expect(response.agent.model).toBe('local-fallback');
    expect(response.report.summary).toContain('华夏成长混合');
    expect(response.chartAnnotations).toEqual([
      expect.objectContaining({ label: '本地降级' }),
    ]);
  });

  it('normalizes DeepSeek output into a stable response contract', async () => {
    const deepSeekFetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: '上涨原因：估值与动量共振。',
                  trend: '趋势偏强',
                  risk: '注意波动回撤',
                  scenarios: [{ name: '中性情景', probability: 'medium', description: '延续震荡上行' }],
                  watchPoints: ['最大回撤'],
                  chartAnnotations: [{ label: '动量改善', description: '短期净值走强', tone: 'positive' }],
                  disclaimer: '不构成投资建议',
                }),
              },
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const response = await buildAnalyzeFundResponse(
      { code: '000001' },
      { marketService, deepSeekApiKey: 'test-secret', deepSeekFetch },
    );

    expect(response.agent.model).toBe('deepseek-v4-flash');
    expect(response.analysis).toContain('上涨原因');
    expect(response.chartAnnotations).toEqual([
      expect.objectContaining({ label: '动量改善', tone: 'positive' }),
    ]);
  });
});

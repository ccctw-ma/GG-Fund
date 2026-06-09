import { describe, expect, it } from 'vitest';
import { buildBeginnerGuide, buildResearchPrompt, buildStreamingResearchPrompt, computeFundIndicators, normalizeAnalysisReport, normalizeChartAnnotations } from './fundAnalysis';

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
    expect(prompt).toContain('beginnerGuide');
    expect(prompt).toContain('scenarios');
    expect(prompt).toContain('不构成投资建议');
  });

  it('builds beginner-friendly action guidance from indicators', () => {
    const guide = buildBeginnerGuide(
      { code: '000001', name: '华夏成长混合', netValue: 1.2, officialNetValue: 1.18, quoteType: 'estimate' },
      computeFundIndicators(history),
    );

    expect(guide.riskLevel).toMatch(/^R[1-5]$/);
    expect(guide.netValueExplanation).toContain('净值');
    expect(guide.actionPath.length).toBeGreaterThan(1);
  });

  it('normalizes imperfect upstream text into report sections', () => {
    const report = normalizeAnalysisReport('趋势偏强，但需要注意回撤。');

    expect(report.summary).toContain('趋势偏强');
    expect(report.beginnerGuide.suggestedAction).toBe('观察等待');
    expect(report.scenarios.length).toBeGreaterThan(0);
    expect(report.disclaimer).toContain('不构成投资建议');
  });

  it('handles empty or flat history without producing invalid indicators', () => {
    expect(computeFundIndicators([])).toEqual({
      totalReturn: 0,
      maxDrawdown: 0,
      shortMomentum: 0,
      volatility: 0,
      trendSlope: 0,
      sampleSize: 0,
    });
    expect(computeFundIndicators([{ date: '2026-01-01', netValue: 0 }])).toEqual(
      expect.objectContaining({ totalReturn: 0, shortMomentum: 0, trendSlope: 0, sampleSize: 1 }),
    );
  });

  it('builds streaming prompts with public research sources', () => {
    const prompt = buildStreamingResearchPrompt({
      fund: { code: '016452', name: '南方纳斯达克100指数发起(QDII)A', netValue: 2.3, quoteDate: '2026-06-09', source: 'test' },
      history,
      indices: [{ code: 'NDX.US', name: '纳斯达克100', value: 20000, change: 120, changePercent: 0.6, quoteTime: '2026-06-09 04:00:00' }],
      indicators: computeFundIndicators(history),
      researchSources: [{ title: '公开资料', url: 'https://example.com', summary: '跟踪纳斯达克100' }],
    });

    expect(prompt).toContain('南方纳斯达克100');
    expect(prompt).toContain('【核心判断】');
    expect(prompt).toContain('公开资料');
  });

  it('maps beginner guide risk levels and actions across indicator branches', () => {
    const baseFund = { code: '000001', name: '华夏成长混合', netValue: 1.2, quoteType: 'official' as const };

    expect(buildBeginnerGuide(baseFund, { totalReturn: 12, shortMomentum: 3, maxDrawdown: -0.2, volatility: 0.1, trendSlope: 1, sampleSize: 10 })).toMatchObject({
      riskLevel: 'R2',
      suggestedAction: '避免追涨',
    });
    expect(buildBeginnerGuide(baseFund, { totalReturn: 2, shortMomentum: 0, maxDrawdown: -4, volatility: 0.7, trendSlope: 1, sampleSize: 10 })).toMatchObject({
      riskLevel: 'R3',
      suggestedAction: '继续持有',
    });
    expect(buildBeginnerGuide(baseFund, { totalReturn: -12, shortMomentum: -3, maxDrawdown: -12, volatility: 1.2, trendSlope: -1, sampleSize: 10 })).toMatchObject({
      riskLevel: 'R4',
      suggestedAction: '分批减仓',
    });
    expect(buildBeginnerGuide(baseFund, { totalReturn: -2, shortMomentum: 2, maxDrawdown: -20, volatility: 2.2, trendSlope: -1, sampleSize: 10 })).toMatchObject({
      riskLevel: 'R5',
      suggestedAction: '观察等待',
    });
  });

  it('normalizes partial JSON reports with conservative defaults', () => {
    const report = normalizeAnalysisReport(JSON.stringify({
      summary: '短期震荡',
      beginnerGuide: {
        riskLevel: 'R4',
        riskExplanation: '波动较大',
        netValueExplanation: '看净值和成本',
        trendExplanation: '趋势震荡',
        suggestedAction: '分批减仓',
        actionPath: ['复盘'],
        suitableFor: ['长期资金'],
        avoid: ['追涨'],
      },
      scenarios: [],
      watchPoints: [],
      sourceNotes: [],
    }));

    expect(report.summary).toBe('短期震荡');
    expect(report.trend).toContain('趋势信息不足');
    expect(report.beginnerGuide.riskLevel).toBe('R4');
    expect(report.scenarios).toEqual([expect.objectContaining({ name: '中性情景' })]);
    expect(report.watchPoints).toContain('后续净值变化');
  });

  it('normalizes tagged text reports and falls back for invalid section values', () => {
    const report = normalizeAnalysisReport([
      '【核心判断】',
      '短期反弹，但证据不足。',
      '【新手说明】',
      '风险等级：RX',
      '建议动作：满仓梭哈',
      '执行路径：',
      '1. 先观察',
      '适合：',
      '- 长期资金',
      '避免：',
      '- 追涨杀跌',
      '【情景推演】',
      '- 乐观情景 | impossible | 继续修复',
      '- 无效行',
      '【关注点】',
      '- 最大回撤',
      '【数据来源】',
      '- 公开资料',
      '【免责声明】',
      '仅供参考',
    ].join('\n'));

    expect(report.summary).toContain('短期反弹');
    expect(report.beginnerGuide.riskLevel).toBe('R3');
    expect(report.beginnerGuide.suggestedAction).toBe('观察等待');
    expect(report.beginnerGuide.actionPath).toEqual(['先观察']);
    expect(report.scenarios).toEqual([{ name: '乐观情景', probability: 'medium', description: '继续修复' }]);
    expect(report.watchPoints).toEqual(['最大回撤']);
    expect(report.sourceNotes).toEqual(['公开资料']);
    expect(report.disclaimer).toBe('仅供参考');
  });

  it('normalizes chart annotations from JSON, tagged text, and fallbacks', () => {
    expect(normalizeChartAnnotations(JSON.stringify({
      chartAnnotations: [{ label: '估值修复', description: '资金回流', tone: 'positive' }],
    }), 'fallback')).toEqual([{ label: '估值修复', description: '资金回流', tone: 'positive' }]);

    expect(normalizeChartAnnotations(JSON.stringify({ chartAnnotations: [] }), 'fallback')).toEqual([
      { label: 'AI 观察', description: 'fallback', tone: 'neutral' },
    ]);

    expect(normalizeChartAnnotations([
      '【图表标注】',
      '- positive | 放量反弹 | 成交活跃',
      '- strange | 中性观察 | 等待确认',
      '- 无效行',
    ].join('\n'), 'fallback')).toEqual([
      { tone: 'positive', label: '放量反弹', description: '成交活跃' },
      { tone: 'neutral', label: '中性观察', description: '等待确认' },
    ]);
  });
});

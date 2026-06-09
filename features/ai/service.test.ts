import { describe, expect, it } from 'vitest';
import { buildAnalyzeFundResponse, normalizeAnalyzeFundRequest, streamAnalyzeFundResponse } from './service';

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

const webResearchFetch = (async (input: RequestInfo | URL) =>
  new Response(
    `<html><body>华夏成长混合 000001 基金经理稳定，基金持仓偏成长，近期受权益市场风格影响。</body></html>`,
    { status: String(input).includes('eastmoney') ? 200 : 404 },
  )) as unknown as typeof fetch;

describe('ai service', () => {
  it('validates analyze request payloads', () => {
    expect(normalizeAnalyzeFundRequest({ code: '000001' })).toEqual({ code: '000001' });
    expect(() => normalizeAnalyzeFundRequest({ code: 'ABC' })).toThrow('基金代码格式不正确');
  });

  it('falls back to deterministic analysis when DeepSeek is unavailable', async () => {
    const response = await buildAnalyzeFundResponse(
      { code: '000001' },
      { marketService, deepSeekApiKey: undefined, webResearchFetch },
    );

    expect(response.agent.model).toBe('local-fallback');
    expect(response.report.summary).toContain('华夏成长混合');
    expect(response.report.beginnerGuide.netValueExplanation).toContain('华夏成长混合');
    expect(response.report.beginnerGuide.actionPath.length).toBeGreaterThan(1);
    expect(response.chartAnnotations).toEqual([
      expect.objectContaining({ label: '本地降级' }),
    ]);
    expect(response.researchSources[0]?.summary).toContain('基金经理');
  });

  it('uses conservative local wording when history is weak and web research fails', async () => {
    const weakMarketService = {
      getFund: async () => ({ code: '000002', name: '回撤基金', netValue: 0.8, quoteDate: '2026-05-30', quoteType: 'official' as const, source: 'test' }),
      getFundHistory: async () => [
        { date: '2026-05-27', netValue: 1.2 },
        { date: '2026-05-28', netValue: 1.05 },
        { date: '2026-05-29', netValue: 0.9 },
        { date: '2026-05-30', netValue: 0.8 },
      ],
      getIndices: async () => [],
    };
    const failingResearchFetch = (async () => {
      throw new Error('blocked');
    }) as unknown as typeof fetch;

    const response = await streamAnalyzeFundResponse(
      { code: '000002' },
      { marketService: weakMarketService, webResearchFetch: failingResearchFetch },
      { onStatus: () => undefined, onDelta: () => undefined },
    );

    expect(response.agent.model).toBe('local-fallback');
    expect(response.report.summary).toContain('近 5 期净值走弱');
    expect(response.report.risk).toContain('历史最大回撤偏深');
    expect(response.report.scenarios[0]?.probability).toBe('medium');
    expect(response.researchSources).toEqual([]);
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
                  marketDrivers: '成长风格反弹带动净值上行。',
                  outlook: '后续看权益市场风险偏好和基金重仓方向。',
                  risk: '注意波动回撤',
                  beginnerGuide: {
                    riskLevel: 'R4',
                    riskExplanation: '回撤可承受但需要控制仓位',
                    netValueExplanation: '净值要结合成本看',
                    trendExplanation: '趋势偏强但不要追涨',
                    suggestedAction: '继续持有',
                    actionPath: ['继续观察', '分批执行'],
                    suitableFor: ['三年以上闲钱'],
                    avoid: ['追涨杀跌'],
                  },
                  scenarios: [{ name: '中性情景', probability: 'medium', description: '延续震荡上行' }],
                  watchPoints: ['最大回撤'],
                  sourceNotes: ['参考东方财富公开材料与历史净值。'],
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
      { marketService, deepSeekApiKey: 'test-secret', deepSeekFetch, webResearchFetch },
    );

    expect(response.agent.model).toBe('deepseek-v4-flash');
    expect(response.analysis).toContain('上涨原因');
    expect(response.report.beginnerGuide.suggestedAction).toBe('继续持有');
    expect(response.report.marketDrivers).toContain('成长风格');
    expect(response.chartAnnotations).toEqual([
      expect.objectContaining({ label: '动量改善', tone: 'positive' }),
    ]);
  });

  it('maps DeepSeek JSON and stream failures to HttpError', async () => {
    const failedFetch = (async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch;

    await expect(buildAnalyzeFundResponse(
      { code: '000001' },
      { marketService, deepSeekApiKey: 'test-secret', deepSeekFetch: failedFetch, webResearchFetch },
    )).rejects.toThrow('DeepSeek 分析服务暂不可用');

    await expect(streamAnalyzeFundResponse(
      { code: '000001' },
      { marketService, deepSeekApiKey: 'test-secret', deepSeekFetch: failedFetch, webResearchFetch },
    )).rejects.toThrow('DeepSeek 流式分析服务暂不可用');
  });

  it('rejects unavailable DeepSeek stream bodies', async () => {
    const noBodyFetch = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;

    await expect(streamAnalyzeFundResponse(
      { code: '000001' },
      { marketService, deepSeekApiKey: 'test-secret', deepSeekFetch: noBodyFetch, webResearchFetch },
    )).rejects.toThrow('DeepSeek 流式响应不可用');
  });

  it('normalizes empty DeepSeek messages through the fallback report parser', async () => {
    const deepSeekFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 })) as unknown as typeof fetch;

    const response = await buildAnalyzeFundResponse(
      { code: '000001' },
      { marketService, deepSeekApiKey: 'test-secret', deepSeekFetch, webResearchFetch },
    );

    expect(response.analysis).toBe('暂无分析结果');
    expect(response.report.marketDrivers).toContain('无法可靠拆分涨跌原因');
  });

  it('streams readable DeepSeek output and normalizes it into report sections', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"【核心判断】\\n基金短期仍看成长风格修复。\\n\\n"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"【趋势】\\n趋势偏强但节奏会反复。\\n\\n【涨跌原因】\\n主要受成长板块回暖与基金重仓方向修复驱动。\\n\\n"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"【后续观察】\\n继续关注风格切换和回撤。\\n\\n【风险提示】\\n短期波动仍高。\\n\\n【关注点】\\n- 最大回撤\\n- 成长指数强弱\\n\\n【数据来源】\\n- 东方财富基金概况\\n\\n【免责声明】\\n不构成投资建议"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const deepSeekFetch = (async () => {
      let index = 0;
      return new Response(new ReadableStream({
        pull(controller) {
          if (index >= chunks.length) {
            controller.close();
            return;
          }
          controller.enqueue(new TextEncoder().encode(chunks[index]));
          index += 1;
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const statuses: string[] = [];
    const deltas: string[] = [];
    const response = await streamAnalyzeFundResponse(
      { code: '000001' },
      {
        marketService,
        deepSeekApiKey: 'test-secret',
        deepSeekFetch,
        webResearchFetch,
      },
      {
        onStatus: (message) => statuses.push(message),
        onDelta: (delta) => deltas.push(delta),
      },
    );

    expect(statuses.at(-1)).toContain('分析完成');
    expect(deltas.join('')).toContain('核心判断');
    expect(response.agent.model).toBe('deepseek-v4-flash');
    expect(response.report.marketDrivers).toContain('成长板块回暖');
    expect(response.report.watchPoints).toContain('最大回撤');
  });

  it('ignores empty stream deltas and normalizes empty stream output', async () => {
    const deepSeekFetch = (async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    }), { status: 200 })) as unknown as typeof fetch;
    const deltas: string[] = [];

    const response = await streamAnalyzeFundResponse(
      { code: '000001' },
      { marketService, deepSeekApiKey: 'test-secret', deepSeekFetch, webResearchFetch },
      { onDelta: (delta) => deltas.push(delta) },
    );

    expect(deltas).toEqual([]);
    expect(response.analysis).toBe('暂无分析结果');
    expect(response.chartAnnotations).toEqual([expect.objectContaining({ label: 'AI 观察' })]);
  });
});

import { buildBeginnerGuide, buildResearchPrompt, computeFundIndicators, normalizeAnalysisReport, normalizeChartAnnotations, type FundResearchSource } from '../../backend/fundAnalysis';
import { HttpError } from '../../lib/http';
import type { FundHistoryPoint, FundQuote, IndexQuote } from '../../shared/types';
import type { MarketService } from '../market/service';

export type AnalyzeFundRequest = {
  code: string;
};

export type AnalyzeFundResponse = {
  fund: FundQuote;
  agent: {
    model: string;
    steps: Array<{ name: string; status: 'done'; summary: string }>;
    indicators: ReturnType<typeof computeFundIndicators>;
  };
  report: ReturnType<typeof normalizeAnalysisReport>;
  chartAnnotations: Array<{ date?: string; label: string; description: string; tone: 'positive' | 'negative' | 'neutral' }>;
  researchSources: FundResearchSource[];
  analysis: string;
};

type AnalyzeFundDependencies = {
  marketService: Pick<MarketService, 'getFund' | 'getFundHistory' | 'getIndices'>;
  deepSeekApiKey?: string;
  deepSeekFetch?: typeof fetch;
  webResearchFetch?: typeof fetch;
};

const RESEARCH_TIMEOUT_MS = 5000;

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickRelevantSnippet(text: string, keywords: string[]) {
  const normalized = text.slice(0, 20_000);
  const index = keywords
    .map((keyword) => normalized.indexOf(keyword))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, index - 240);
  return normalized.slice(start, start + 900);
}

async function fetchText(fetcher: typeof fetch, url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEARCH_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      headers: {
        'user-agent': 'GG-Fund research agent/1.0',
        accept: 'text/html,application/json,text/plain,*/*',
      },
      signal: controller.signal,
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

async function collectResearchSources(fund: Pick<FundQuote, 'code' | 'name'>, fetcher: typeof fetch): Promise<FundResearchSource[]> {
  const targets = [
    { title: '东方财富基金概况', url: `https://fundf10.eastmoney.com/jbgk_${fund.code}.html` },
    { title: '东方财富基金持仓', url: `https://fundf10.eastmoney.com/ccmx_${fund.code}.html` },
    { title: '东方财富基金经理', url: `https://fundf10.eastmoney.com/jjjl_${fund.code}.html` },
    { title: '东方财富搜索结果', url: `https://so.eastmoney.com/web/s?keyword=${encodeURIComponent(`${fund.code} ${fund.name}`)}` },
  ];
  const pages = await Promise.all(targets.map(async (target) => {
    const raw = await fetchText(fetcher, target.url);
    const summary = pickRelevantSnippet(stripHtml(raw), [fund.code, fund.name, '基金经理', '持仓', '规模', '业绩']);
    return summary ? { ...target, summary } : undefined;
  }));
  return pages.filter((source): source is FundResearchSource => Boolean(source));
}

export function normalizeAnalyzeFundRequest(body: unknown): AnalyzeFundRequest {
  const code = typeof body === 'object' && body !== null ? String((body as { code?: unknown }).code ?? '') : '';
  if (!/^\d{6}$/.test(code)) {
    throw new HttpError(400, 'FUND_CODE_INVALID', '基金代码格式不正确');
  }
  return { code };
}

function buildLocalReport(fund: Pick<FundQuote, 'name' | 'code' | 'netValue' | 'officialNetValue' | 'quoteType'>, indicators: ReturnType<typeof computeFundIndicators>) {
  const trendVerb = indicators.shortMomentum >= 1 ? '近 5 期净值走强' : indicators.shortMomentum <= -1 ? '近 5 期净值走弱' : '近 5 期净值震荡';
  const riskVerb = indicators.maxDrawdown <= -10 ? '历史最大回撤偏深，需关注下行风险' : indicators.maxDrawdown <= -5 ? '历史最大回撤中等，建议设置止损线' : '历史最大回撤可控';
  const probability: 'low' | 'medium' | 'high' = indicators.volatility > 2 ? 'low' : indicators.volatility > 1 ? 'medium' : 'high';
  return {
    summary: `${fund.name}(${fund.code}) 一年区间收益 ${indicators.totalReturn.toFixed(2)}%，${trendVerb}，最大回撤 ${indicators.maxDrawdown.toFixed(2)}%。`,
    trend: `区间收益 ${indicators.totalReturn.toFixed(2)}%、短期动量 ${indicators.shortMomentum.toFixed(2)}%、趋势斜率 ${indicators.trendSlope.toFixed(2)}，${trendVerb}。`,
    marketDrivers: `本地降级模式未联网归因，当前主要依据净值走势和指数联动判断：${trendVerb}，短期涨跌更可能来自基金持仓方向与大盘风格共同影响。`,
    outlook: `未来走势需重点观察短期动量是否延续、最大回撤是否扩大，以及主要指数是否继续支撑该基金持仓方向。`,
    risk: `波动率 ${indicators.volatility.toFixed(2)}，${riskVerb}。`,
    beginnerGuide: buildBeginnerGuide(fund, indicators),
    scenarios: [
      { name: '乐观情景', probability, description: '若净值持续突破近期高点，区间收益有望延续。' },
      { name: '中性情景', probability: 'medium' as const, description: '若市场维持震荡，净值围绕当前水平波动。' },
      { name: '压力情景', probability: 'low' as const, description: '若回撤再度逼近历史最大值，需关注止损。' },
    ],
    watchPoints: ['净值突破近期高点', '最大回撤是否扩大', '主要指数与板块的联动'],
    sourceNotes: ['未配置 DeepSeek key 或 AI 不可用时使用本地确定性指标报告；联网材料不参与降级结论。'],
    disclaimer: '本分析为本地指标推算，仅供学习参考，不构成投资建议。',
  };
}

export async function buildAnalyzeFundResponse(
  request: AnalyzeFundRequest,
  dependencies: AnalyzeFundDependencies,
): Promise<AnalyzeFundResponse> {
  const deepSeekFetch = dependencies.deepSeekFetch ?? fetch;
  const fund = await dependencies.marketService.getFund(request.code);
  const history = await dependencies.marketService.getFundHistory(request.code, '1y');
  const indices = await dependencies.marketService.getIndices();
  const researchSources = await collectResearchSources(fund, dependencies.webResearchFetch ?? fetch);
  const indicators = computeFundIndicators(history as FundHistoryPoint[]);
  const steps: AnalyzeFundResponse['agent']['steps'] = [
    { name: 'collect_fund_quote', status: 'done', summary: `读取 ${fund.name} 当前净值 ${fund.netValue}` },
    { name: 'collect_history', status: 'done', summary: `读取 ${history.length} 条历史净值` },
    { name: 'collect_market_context', status: 'done', summary: `读取 ${indices.length} 个主要指数` },
    { name: 'collect_web_research', status: 'done', summary: `联网读取 ${researchSources.length} 条公开基金材料` },
    { name: 'compute_indicators', status: 'done', summary: `区间收益 ${indicators.totalReturn.toFixed(2)}%，最大回撤 ${indicators.maxDrawdown.toFixed(2)}%` },
  ];
  const prompt = buildResearchPrompt({
    fund: fund as FundQuote,
    history: history as FundHistoryPoint[],
    indices: indices as IndexQuote[],
    indicators,
    researchSources,
  });
  steps.push({ name: 'build_research_prompt', status: 'done', summary: '构建包含指标、行情和输出契约的研究提示' });

  if (!dependencies.deepSeekApiKey) {
    const report = buildLocalReport(fund, indicators);
    steps.push({ name: 'call_deepseek', status: 'done', summary: '未配置 DeepSeek key，使用本地确定性报告作为降级输出' });
    steps.push({ name: 'normalize_report', status: 'done', summary: '基于指标生成离线趋势/风险/情景报告' });
    return {
      fund,
      agent: { model: 'local-fallback', steps, indicators },
      report,
      chartAnnotations: [{ label: '本地降级', description: report.summary, tone: 'neutral' }],
      researchSources,
      analysis: report.summary,
    };
  }

  const response = await deepSeekFetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${dependencies.deepSeekApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: '你是谨慎的基金研究助理。必须输出结构化 JSON，必须强调不构成投资建议。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.25,
    }),
  });
  if (!response.ok) {
    throw new HttpError(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 分析服务暂不可用');
  }
  steps.push({ name: 'call_deepseek', status: 'done', summary: 'DeepSeek v4 Flash 返回结构化研究内容' });

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '暂无分析结果';
  const report = normalizeAnalysisReport(content);
  const chartAnnotations = normalizeChartAnnotations(content, report.summary);
  steps.push({ name: 'normalize_report', status: 'done', summary: '规范化研究报告、情景和图表标注' });

  return {
    fund,
    agent: { model: 'deepseek-v4-flash', steps, indicators },
    report,
    chartAnnotations,
    researchSources,
    analysis: report.summary,
  };
}

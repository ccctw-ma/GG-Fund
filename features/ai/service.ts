import { buildBeginnerGuide, buildResearchPrompt, buildStreamingResearchPrompt, computeFundIndicators, normalizeAnalysisReport, normalizeChartAnnotations, type FundResearchSource } from '../../backend/fundAnalysis';
import { HttpError } from '../../lib/http';
import type { FundHistoryPoint, FundQuote, IndexQuote } from '../../shared/types';
import type { MarketService } from '../market/service';

export type AnalyzeFundRequest = {
  code: string;
};

export type AnalyzeFundFollowUpRequest = {
  code: string;
  question: string;
  context?: {
    summary?: string;
    trend?: string;
    marketDrivers?: string;
    outlook?: string;
    risk?: string;
  };
};

export type AnalyzeFundFollowUpResponse = {
  answer: string;
  model: string;
  sourceNotes: string[];
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

export type AnalyzeFundStreamCallbacks = {
  onStatus?: (message: string) => void;
  onDelta?: (delta: string) => void;
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

export function normalizeAnalyzeFundFollowUpRequest(body: unknown): AnalyzeFundFollowUpRequest {
  const payload = typeof body === 'object' && body !== null ? body as { code?: unknown; question?: unknown; context?: unknown } : {};
  const code = String(payload.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) {
    throw new HttpError(400, 'FUND_CODE_INVALID', '基金代码格式不正确');
  }
  const question = String(payload.question ?? '').trim();
  if (question.length < 2 || question.length > 500) {
    throw new HttpError(400, 'FOLLOW_UP_QUESTION_INVALID', '追问内容需为 2-500 个字符');
  }
  const rawContext = typeof payload.context === 'object' && payload.context !== null ? payload.context as Record<string, unknown> : {};
  const context = Object.fromEntries(
    ['summary', 'trend', 'marketDrivers', 'outlook', 'risk']
      .map((key) => [key, typeof rawContext[key] === 'string' ? String(rawContext[key]).slice(0, 900) : undefined])
      .filter(([, value]) => value),
  ) as AnalyzeFundFollowUpRequest['context'];
  return { code, question, context };
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

type AnalyzeFundPrepared = {
  fund: FundQuote;
  history: FundHistoryPoint[];
  indices: IndexQuote[];
  indicators: ReturnType<typeof computeFundIndicators>;
  researchSources: FundResearchSource[];
  steps: AnalyzeFundResponse['agent']['steps'];
};

async function prepareAnalyzeFund(
  request: AnalyzeFundRequest,
  dependencies: AnalyzeFundDependencies,
  callbacks?: AnalyzeFundStreamCallbacks,
): Promise<AnalyzeFundPrepared> {
  callbacks?.onStatus?.('正在读取基金净值与历史走势...');
  const fund = await dependencies.marketService.getFund(request.code) as FundQuote;
  const history = await dependencies.marketService.getFundHistory(request.code, '1y') as FundHistoryPoint[];
  const indices = await dependencies.marketService.getIndices() as IndexQuote[];
  callbacks?.onStatus?.('正在联网抓取公开材料...');
  const researchSources = await collectResearchSources(fund, dependencies.webResearchFetch ?? fetch);
  const indicators = computeFundIndicators(history);
  const steps: AnalyzeFundResponse['agent']['steps'] = [
    { name: 'collect_fund_quote', status: 'done', summary: `读取 ${fund.name} 当前净值 ${fund.netValue}` },
    { name: 'collect_history', status: 'done', summary: `读取 ${history.length} 条历史净值` },
    { name: 'collect_market_context', status: 'done', summary: `读取 ${indices.length} 个主要指数` },
    { name: 'collect_web_research', status: 'done', summary: `联网读取 ${researchSources.length} 条公开基金材料` },
    { name: 'compute_indicators', status: 'done', summary: `区间收益 ${indicators.totalReturn.toFixed(2)}%，最大回撤 ${indicators.maxDrawdown.toFixed(2)}%` },
  ];
  return { fund, history, indices, indicators, researchSources, steps };
}

function buildFallbackAnalyzeFundResponse(prepared: AnalyzeFundPrepared): AnalyzeFundResponse {
  const report = buildLocalReport(prepared.fund, prepared.indicators);
  const steps = [
    ...prepared.steps,
    { name: 'build_research_prompt', status: 'done' as const, summary: '构建包含指标、行情和输出契约的研究提示' },
    { name: 'call_deepseek', status: 'done' as const, summary: '未配置 DeepSeek key，使用本地确定性报告作为降级输出' },
    { name: 'normalize_report', status: 'done' as const, summary: '基于指标生成离线趋势/风险/情景报告' },
  ];
  return {
    fund: prepared.fund,
    agent: { model: 'local-fallback', steps, indicators: prepared.indicators },
    report,
    chartAnnotations: [{ label: '本地降级', description: report.summary, tone: 'neutral' }],
    researchSources: prepared.researchSources,
    analysis: report.summary,
  };
}

function buildFallbackFollowUpAnswer(request: AnalyzeFundFollowUpRequest, prepared: AnalyzeFundPrepared): AnalyzeFundFollowUpResponse {
  const { fund, indicators } = prepared;
  const trendTone = indicators.shortMomentum >= 1 ? '短期动量偏强' : indicators.shortMomentum <= -1 ? '短期动量偏弱' : '短期动量震荡';
  const answer = `${fund.name}(${fund.code}) 当前只能基于本地行情指标回答：近一年区间收益 ${indicators.totalReturn.toFixed(2)}%，最大回撤 ${indicators.maxDrawdown.toFixed(2)}%，${trendTone}。针对“${request.question}”，建议先把问题拆成三点观察：1）这笔资金的使用期限是否能覆盖波动周期；2）该基金在组合中的占比是否过高；3）后续净值是否继续扩大回撤或突破近期高点。未配置 DeepSeek key 时无法进行新的联网推理，因此这不是投资建议。`;
  return {
    answer,
    model: 'local-fallback',
    sourceNotes: ['未配置 DeepSeek key 或 AI 不可用时使用本地确定性指标回答；不构成投资建议。'],
  };
}

function buildFollowUpPrompt(request: AnalyzeFundFollowUpRequest, prepared: AnalyzeFundPrepared) {
  return `你是谨慎的中国公募基金研究助理。用户已经看过一份初始基金分析报告，现在在报告后继续追问。请直接回答追问，保持简洁、可执行、基于证据，不构成投资建议。

基金：${prepared.fund.name} (${prepared.fund.code})
当前净值/估算：${prepared.fund.netValue}
报价日期：${prepared.fund.quoteDate}
指标 JSON：${JSON.stringify(prepared.indicators)}
最近历史净值：${JSON.stringify(prepared.history.slice(-30))}
主要指数：${JSON.stringify(prepared.indices.slice(0, 12))}
公开材料摘要：${JSON.stringify(prepared.researchSources)}
上一轮分析摘要：${JSON.stringify(request.context ?? {})}

用户追问：${request.question}

回答要求：
1. 用中文回答，最多 4 段；
2. 如果用户问买卖决策，给“观察条件/分批动作/风险边界”，不要承诺收益；
3. 如果证据不足，明确说明证据不足；
4. 结尾保留“不构成投资建议”的风险提示。`;
}

async function readDeepSeekStream(
  response: Response,
  callbacks?: AnalyzeFundStreamCallbacks,
) {
  if (!response.body) throw new HttpError(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 流式响应不可用');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let eventBoundary = buffer.indexOf('\n\n');
    while (eventBoundary >= 0) {
      const eventChunk = buffer.slice(0, eventBoundary);
      buffer = buffer.slice(eventBoundary + 2);
      const data = eventChunk
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
        .join('');
      if (data && data !== '[DONE]') {
        const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = payload.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          fullText += delta;
          callbacks?.onDelta?.(delta);
        }
      }
      eventBoundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }

  return fullText.trim();
}

export async function buildAnalyzeFundResponse(
  request: AnalyzeFundRequest,
  dependencies: AnalyzeFundDependencies,
): Promise<AnalyzeFundResponse> {
  const deepSeekFetch = dependencies.deepSeekFetch ?? fetch;
  const prepared = await prepareAnalyzeFund(request, dependencies);
  const prompt = buildResearchPrompt({
    fund: prepared.fund,
    history: prepared.history,
    indices: prepared.indices,
    indicators: prepared.indicators,
    researchSources: prepared.researchSources,
  });
  const steps = [...prepared.steps, { name: 'build_research_prompt', status: 'done' as const, summary: '构建包含指标、行情和输出契约的研究提示' }];

  if (!dependencies.deepSeekApiKey) {
    return buildFallbackAnalyzeFundResponse(prepared);
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
    fund: prepared.fund,
    agent: { model: 'deepseek-v4-flash', steps, indicators: prepared.indicators },
    report,
    chartAnnotations,
    researchSources: prepared.researchSources,
    analysis: report.summary,
  };
}

export async function streamAnalyzeFundResponse(
  request: AnalyzeFundRequest,
  dependencies: AnalyzeFundDependencies,
  callbacks?: AnalyzeFundStreamCallbacks,
): Promise<AnalyzeFundResponse> {
  const deepSeekFetch = dependencies.deepSeekFetch ?? fetch;
  const prepared = await prepareAnalyzeFund(request, dependencies, callbacks);
  if (!dependencies.deepSeekApiKey) {
    callbacks?.onStatus?.('未检测到 DeepSeek key，已切换到本地降级分析。');
    const fallback = buildFallbackAnalyzeFundResponse(prepared);
    callbacks?.onDelta?.(fallback.report.summary);
    return fallback;
  }

  callbacks?.onStatus?.('正在连接 DeepSeek 并开始流式生成...');
  const prompt = buildStreamingResearchPrompt({
    fund: prepared.fund,
    history: prepared.history,
    indices: prepared.indices,
    indicators: prepared.indicators,
    researchSources: prepared.researchSources,
  });
  const steps = [...prepared.steps, { name: 'build_research_prompt', status: 'done' as const, summary: '构建流式研究提示并等待模型输出' }];

  const response = await deepSeekFetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${dependencies.deepSeekApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      stream: true,
      messages: [
        { role: 'system', content: '你是谨慎的基金研究助理。输出必须简洁、可读、基于证据，并强调不构成投资建议。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.25,
    }),
  });

  if (!response.ok) {
    throw new HttpError(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 流式分析服务暂不可用');
  }

  callbacks?.onStatus?.('DeepSeek 正在逐段生成分析...');
  const content = await readDeepSeekStream(response, callbacks);
  const report = normalizeAnalysisReport(content || '暂无分析结果');
  const chartAnnotations = normalizeChartAnnotations(content || '', report.summary);
  steps.push({ name: 'call_deepseek', status: 'done', summary: 'DeepSeek v4 Flash 已流式返回研究内容' });
  steps.push({ name: 'normalize_report', status: 'done', summary: '规范化研究报告、情景和图表标注' });
  callbacks?.onStatus?.('分析完成，已整理成结构化结论。');

  return {
    fund: prepared.fund,
    agent: { model: 'deepseek-v4-flash', steps, indicators: prepared.indicators },
    report,
    chartAnnotations,
    researchSources: prepared.researchSources,
    analysis: report.summary,
  };
}

export async function buildAnalyzeFundFollowUpResponse(
  request: AnalyzeFundFollowUpRequest,
  dependencies: AnalyzeFundDependencies,
): Promise<AnalyzeFundFollowUpResponse> {
  const deepSeekFetch = dependencies.deepSeekFetch ?? fetch;
  const prepared = await prepareAnalyzeFund(request, dependencies);
  if (!dependencies.deepSeekApiKey) {
    return buildFallbackFollowUpAnswer(request, prepared);
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
        { role: 'system', content: '你是谨慎的基金研究助理，回答必须基于数据，不构成投资建议。' },
        { role: 'user', content: buildFollowUpPrompt(request, prepared) },
      ],
      temperature: 0.22,
    }),
  });
  if (!response.ok) {
    throw new HttpError(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 追问服务暂不可用');
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = data.choices?.[0]?.message?.content?.trim() || '暂时没有生成有效回答，请换个问题重试。';
  return {
    answer,
    model: 'deepseek-v4-flash',
    sourceNotes: ['结合当前行情、历史净值、主要指数和上一轮分析上下文生成；不构成投资建议。'],
  };
}

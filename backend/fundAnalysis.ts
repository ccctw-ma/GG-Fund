import type { FundHistoryPoint, FundQuote, IndexQuote } from '../shared/types';

export type FundAnalysisIndicators = {
  totalReturn: number;
  maxDrawdown: number;
  shortMomentum: number;
  volatility: number;
  trendSlope: number;
  sampleSize: number;
};

export type FundAnalysisReport = {
  summary: string;
  trend: string;
  marketDrivers: string;
  outlook: string;
  risk: string;
  beginnerGuide: {
    riskLevel: 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
    riskExplanation: string;
    netValueExplanation: string;
    trendExplanation: string;
    suggestedAction: '继续持有' | '观察等待' | '分批加仓' | '分批减仓' | '避免追涨';
    actionPath: string[];
    suitableFor: string[];
    avoid: string[];
  };
  scenarios: Array<{ name: string; probability: 'low' | 'medium' | 'high'; description: string }>;
  watchPoints: string[];
  sourceNotes: string[];
  disclaimer: string;
};

export type ChartAnnotation = {
  date?: string;
  label: string;
  description: string;
  tone: 'positive' | 'negative' | 'neutral';
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function computeFundIndicators(history: FundHistoryPoint[]): FundAnalysisIndicators {
  const first = history[0]?.netValue ?? 0;
  const last = history.at(-1)?.netValue ?? first;
  let high = first;
  let maxDrawdown = 0;
  const returns: number[] = [];
  for (let index = 0; index < history.length; index += 1) {
    const point = history[index];
    high = Math.max(high, point.netValue);
    maxDrawdown = Math.min(maxDrawdown, high ? ((point.netValue - high) / high) * 100 : 0);
    if (index > 0) {
      const previous = history[index - 1].netValue;
      if (previous) returns.push(((point.netValue - previous) / previous) * 100);
    }
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / (returns.length || 1);
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length || 1);
  const recent = history.slice(-5);
  const recentFirst = recent[0]?.netValue ?? first;
  const recentLast = recent.at(-1)?.netValue ?? last;
  return {
    totalReturn: first ? round2(((last - first) / first) * 100) : 0,
    maxDrawdown: round2(maxDrawdown),
    shortMomentum: recentFirst ? round2(((recentLast - recentFirst) / recentFirst) * 100) : 0,
    volatility: round2(Math.sqrt(variance)),
    trendSlope: history.length > 1 ? round2(((last - first) / (history.length - 1)) * 100) : 0,
    sampleSize: history.length,
  };
}

export type FundResearchSource = {
  title: string;
  url: string;
  summary: string;
};

export function buildResearchPrompt(input: { fund: FundQuote; history: FundHistoryPoint[]; indices: IndexQuote[]; indicators: FundAnalysisIndicators; researchSources?: FundResearchSource[] }) {
  return `你是谨慎的中国公募基金研究 Agent。请基于数据做情景分析，不构成投资建议。

基金：${input.fund.name} (${input.fund.code})
当前净值/估算：${input.fund.netValue}
报价日期：${input.fund.quoteDate}
数据来源：${input.fund.source}

指标 JSON：${JSON.stringify(input.indicators)}
最近历史净值：${JSON.stringify(input.history.slice(-30))}
市场指数：${JSON.stringify(input.indices)}
联网公开材料：${JSON.stringify(input.researchSources ?? [])}

请严格按下面 JSON 输出，不要输出 markdown：
{
  "summary": "一句话总结",
  "trend": "结合 totalReturn、shortMomentum、trendSlope 说明趋势",
  "marketDrivers": "结合联网公开材料、指数、持仓/基金经理/基金主题解释为什么涨或为什么跌；没有足够证据时明确说证据不足",
  "outlook": "分析未来 1-3 个月可能影响走势的因素、触发条件和不确定性，不做收益承诺",
  "risk": "结合 maxDrawdown、volatility 说明风险",
  "beginnerGuide": {
    "riskLevel": "R1|R2|R3|R4|R5",
    "riskExplanation": "用小白能理解的话解释波动和回撤",
    "netValueExplanation": "解释当前净值、官方净值或估算净值怎么看",
    "trendExplanation": "解释当前趋势和大盘环境，不做收益承诺",
    "suggestedAction": "继续持有|观察等待|分批加仓|分批减仓|避免追涨",
    "actionPath": ["第一步做什么", "第二步观察什么", "第三步如何复盘"],
    "suitableFor": ["适合什么资金期限或风险承受能力"],
    "avoid": ["应该避免的错误操作"]
  },
  "scenarios": [
    {"name":"乐观情景","probability":"low|medium|high","description":"触发条件和表现"},
    {"name":"中性情景","probability":"low|medium|high","description":"触发条件和表现"},
    {"name":"压力情景","probability":"low|medium|high","description":"触发条件和表现"}
  ],
  "watchPoints": ["需要观察的指标或事件"],
  "sourceNotes": ["使用了哪些公开网页/接口材料，哪些只是估算或证据不足"],
  "chartAnnotations": [
    {"label":"图表标注", "description":"为什么标注", "tone":"positive|negative|neutral"}
  ],
  "disclaimer": "不构成投资建议"
}`;
}

function inferRiskLevel(indicators: FundAnalysisIndicators): FundAnalysisReport['beginnerGuide']['riskLevel'] {
  const drawdown = Math.abs(indicators.maxDrawdown);
  if (drawdown < 1 && indicators.volatility < 0.35) return 'R2';
  if (drawdown < 5 && indicators.volatility < 0.8) return 'R3';
  if (drawdown < 15 && indicators.volatility < 1.8) return 'R4';
  return 'R5';
}

function inferSuggestedAction(indicators: FundAnalysisIndicators): FundAnalysisReport['beginnerGuide']['suggestedAction'] {
  if (indicators.totalReturn > 8 && indicators.shortMomentum > 2) return '避免追涨';
  if (indicators.totalReturn > 0 && indicators.shortMomentum >= -1 && indicators.maxDrawdown > -10) return '继续持有';
  if (indicators.totalReturn < -8 && indicators.shortMomentum < -2) return '分批减仓';
  if (indicators.totalReturn < 0 && indicators.shortMomentum > 1) return '观察等待';
  return '观察等待';
}

export function buildBeginnerGuide(
  fund: Pick<FundQuote, 'name' | 'code' | 'netValue' | 'officialNetValue' | 'quoteType'>,
  indicators: FundAnalysisIndicators,
): FundAnalysisReport['beginnerGuide'] {
  const riskLevel = inferRiskLevel(indicators);
  const suggestedAction = inferSuggestedAction(indicators);
  const quoteKind = fund.quoteType === 'estimate' ? '盘中估算净值' : '官方单位净值';
  const officialText = fund.officialNetValue ? `，上一官方净值约 ${fund.officialNetValue}` : '';
  return {
    riskLevel,
    riskExplanation: `${riskLevel} 是基于近一年回撤 ${indicators.maxDrawdown.toFixed(2)}% 和日波动 ${indicators.volatility.toFixed(2)} 的简化估算；回撤越深，越需要确认自己能否承受短期亏损。`,
    netValueExplanation: `${fund.name}(${fund.code}) 当前${quoteKind}为 ${fund.netValue}${officialText}。净值不是“贵不贵”的唯一标准，更重要的是买入成本、持有份额、长期收益率和最大回撤。`,
    trendExplanation: `近一年区间收益 ${indicators.totalReturn.toFixed(2)}%，近 5 期动量 ${indicators.shortMomentum.toFixed(2)}%。趋势向上不代表一定继续上涨，趋势走弱也不等于必须立刻卖出。`,
    suggestedAction,
    actionPath: [
      '先确认这笔钱的使用期限：一年内要用的钱不要重仓波动基金。',
      '再看组合占比：单只基金不要让一次波动决定整个账户体验。',
      '最后分批执行：用定投、分批止盈或分批减仓替代一次性情绪化操作。',
    ],
    suitableFor: [
      riskLevel === 'R4' || riskLevel === 'R5' ? '能接受较大净值波动、投资期限三年以上的资金。' : '希望波动相对可控、愿意持续观察的中短期资金。',
      '愿意按月复盘收益率、最大回撤和大盘环境的投资者。',
    ],
    avoid: [
      '不要只因为一天上涨就追高买入。',
      '不要只因为短期浮亏就一次性清仓。',
      '不要把应急资金投入高波动基金。',
    ],
  };
}

function fallbackBeginnerGuide(summary: string): FundAnalysisReport['beginnerGuide'] {
  return {
    riskLevel: 'R3',
    riskExplanation: '当前上游报告没有完整风险等级，先按中等风险理解，并继续观察最大回撤和波动。',
    netValueExplanation: '单位净值代表每份基金的价值，但是否赚钱取决于你的买入成本、份额和持有时间。',
    trendExplanation: summary || '趋势信息不足，建议结合更长历史净值和主要指数走势继续观察。',
    suggestedAction: '观察等待',
    actionPath: ['确认资金期限', '观察净值和回撤', '分批执行而非一次性操作'],
    suitableFor: ['愿意学习基金基础知识并定期复盘的投资者。'],
    avoid: ['避免追涨杀跌', '避免忽略风险承受能力'],
  };
}

export function normalizeAnalysisReport(content: string): FundAnalysisReport {
  try {
    const parsed = JSON.parse(content) as Partial<FundAnalysisReport>;
    const summary = parsed.summary || content;
    return {
      summary,
      trend: parsed.trend || '趋势信息不足，需要结合更长历史净值继续观察。',
      marketDrivers: parsed.marketDrivers || '当前公开材料不足以归因涨跌，先结合净值、指数和持仓变化观察。',
      outlook: parsed.outlook || '未来走势取决于市场风格、基金持仓方向和回撤修复情况，不宜线性外推。',
      risk: parsed.risk || '风险信息不足，请关注回撤和波动。',
      beginnerGuide: parsed.beginnerGuide || fallbackBeginnerGuide(summary),
      scenarios: parsed.scenarios?.length ? parsed.scenarios : [{ name: '中性情景', probability: 'medium', description: '维持当前走势，等待更多数据确认。' }],
      watchPoints: parsed.watchPoints?.length ? parsed.watchPoints : ['后续净值变化', '主要指数走势', '最大回撤变化'],
      sourceNotes: parsed.sourceNotes?.length ? parsed.sourceNotes : ['未获得足够公开网页材料，主要依据净值和指数数据。'],
      disclaimer: parsed.disclaimer || '本分析仅供学习参考，不构成投资建议。',
    };
  } catch {
    return {
      summary: content,
      trend: content,
      marketDrivers: '当前 AI 输出不是结构化 JSON，无法可靠拆分涨跌原因。',
      outlook: '未来走势需要继续结合基金公告、持仓变化和市场指数确认。',
      risk: '请结合最大回撤、波动率和个人风险承受能力审慎判断。',
      beginnerGuide: fallbackBeginnerGuide(content),
      scenarios: [{ name: '中性情景', probability: 'medium', description: '当前信息不足以支持单边判断，建议继续观察。' }],
      watchPoints: ['后续净值变化', '主要指数走势', '基金公告和持仓变化'],
      sourceNotes: ['AI 输出解析失败，已保留原始摘要并使用保守降级解释。'],
      disclaimer: '本分析仅供学习参考，不构成投资建议。',
    };
  }
}

export function normalizeChartAnnotations(content: string, fallback: string): ChartAnnotation[] {
  try {
    const parsed = JSON.parse(content) as { chartAnnotations?: ChartAnnotation[] };
    return parsed.chartAnnotations?.length ? parsed.chartAnnotations : [{ label: 'AI 观察', description: fallback, tone: 'neutral' }];
  } catch {
    return [{ label: 'AI 观察', description: fallback, tone: 'neutral' }];
  }
}

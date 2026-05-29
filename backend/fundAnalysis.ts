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
  risk: string;
  scenarios: Array<{ name: string; probability: 'low' | 'medium' | 'high'; description: string }>;
  watchPoints: string[];
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

export function buildResearchPrompt(input: { fund: FundQuote; history: FundHistoryPoint[]; indices: IndexQuote[]; indicators: FundAnalysisIndicators }) {
  return `你是谨慎的中国公募基金研究 Agent。请基于数据做情景分析，不构成投资建议。

基金：${input.fund.name} (${input.fund.code})
当前净值/估算：${input.fund.netValue}
报价日期：${input.fund.quoteDate}
数据来源：${input.fund.source}

指标 JSON：${JSON.stringify(input.indicators)}
最近历史净值：${JSON.stringify(input.history.slice(-30))}
市场指数：${JSON.stringify(input.indices)}

请严格按下面 JSON 输出，不要输出 markdown：
{
  "summary": "一句话总结",
  "trend": "结合 totalReturn、shortMomentum、trendSlope 说明趋势",
  "risk": "结合 maxDrawdown、volatility 说明风险",
  "scenarios": [
    {"name":"乐观情景","probability":"low|medium|high","description":"触发条件和表现"},
    {"name":"中性情景","probability":"low|medium|high","description":"触发条件和表现"},
    {"name":"压力情景","probability":"low|medium|high","description":"触发条件和表现"}
  ],
  "watchPoints": ["需要观察的指标或事件"],
  "chartAnnotations": [
    {"label":"图表标注", "description":"为什么标注", "tone":"positive|negative|neutral"}
  ],
  "disclaimer": "不构成投资建议"
}`;
}

export function normalizeAnalysisReport(content: string): FundAnalysisReport {
  try {
    const parsed = JSON.parse(content) as Partial<FundAnalysisReport>;
    return {
      summary: parsed.summary || content,
      trend: parsed.trend || '趋势信息不足，需要结合更长历史净值继续观察。',
      risk: parsed.risk || '风险信息不足，请关注回撤和波动。',
      scenarios: parsed.scenarios?.length ? parsed.scenarios : [{ name: '中性情景', probability: 'medium', description: '维持当前走势，等待更多数据确认。' }],
      watchPoints: parsed.watchPoints?.length ? parsed.watchPoints : ['后续净值变化', '主要指数走势', '最大回撤变化'],
      disclaimer: parsed.disclaimer || '本分析仅供学习参考，不构成投资建议。',
    };
  } catch {
    return {
      summary: content,
      trend: content,
      risk: '请结合最大回撤、波动率和个人风险承受能力审慎判断。',
      scenarios: [{ name: '中性情景', probability: 'medium', description: '当前信息不足以支持单边判断，建议继续观察。' }],
      watchPoints: ['后续净值变化', '主要指数走势', '基金公告和持仓变化'],
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

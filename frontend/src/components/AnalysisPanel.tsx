'use client';

import { Brain, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import type { FundAnalysisResponse, FundQuote } from '../types';

export function AnalysisPanel({ selectedFund }: { selectedFund?: FundQuote }) {
  const [result, setResult] = useState<FundAnalysisResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function analyze() {
    if (!selectedFund) return;
    setLoading(true);
    setError(undefined);
    try {
      setResult(await api.analyzeFund(selectedFund.code));
    } catch (event) {
      setError(event instanceof Error ? event.message : '分析失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="market-card bg-ink p-6 text-paper" id="ai-analysis">
      <div className="section-kicker text-mint/75">基金研究 Agent</div>
      <h2 className="font-display mt-2 text-3xl font-black tracking-[-0.04em] text-cream">DeepSeek 多步骤分析</h2>
      <p className="mt-2 text-sm leading-6 text-paper/65">Agent 先采集行情，再评估动量，最后调用 DeepSeek v4 Flash。API key 只保存在 Cloudflare Secret。</p>
      <button className="paper-button mt-4" onClick={analyze} disabled={!selectedFund || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
        {selectedFund ? `分析 ${selectedFund.name}` : '先选择基金'}
      </button>
      {result?.agent && (
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-paper/15 bg-paper/10 p-3"><span className="text-xs text-paper/55">区间收益</span><strong className="block text-lg text-mint">{result.agent.indicators.totalReturn.toFixed(2)}%</strong></div>
          <div className="rounded-2xl border border-paper/15 bg-paper/10 p-3"><span className="text-xs text-paper/55">最大回撤</span><strong className="block text-lg text-red-200">{result.agent.indicators.maxDrawdown.toFixed(2)}%</strong></div>
          <div className="rounded-2xl border border-paper/15 bg-paper/10 p-3"><span className="text-xs text-paper/55">短期动量</span><strong className="block text-lg text-mint">{result.agent.indicators.shortMomentum.toFixed(2)}%</strong></div>
          <div className="rounded-2xl border border-paper/15 bg-paper/10 p-3"><span className="text-xs text-paper/55">样本数</span><strong className="block text-lg text-cream">{result.agent.indicators.sampleSize}</strong></div>
        </div>
      )}
      {result?.report && (
        <div className="mt-4 grid gap-3">
          <article className="rounded-3xl border border-paper/15 bg-paper/10 p-4">
            <h3 className="font-bold text-mint">研究摘要</h3>
            <p className="mt-2 text-sm leading-7 text-paper/85">{result.report.summary}</p>
          </article>
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-3xl border border-paper/15 bg-paper/10 p-4"><h3 className="font-bold text-mint">趋势判断</h3><p className="mt-2 text-sm leading-7 text-paper/80">{result.report.trend}</p></article>
            <article className="rounded-3xl border border-paper/15 bg-paper/10 p-4"><h3 className="font-bold text-red-100">风险提示</h3><p className="mt-2 text-sm leading-7 text-paper/80">{result.report.risk}</p></article>
          </div>
          <article className="rounded-3xl border border-paper/15 bg-paper/10 p-4">
            <h3 className="font-bold text-mint">情景推演</h3>
            <div className="mt-3 grid gap-2">
              {result.report.scenarios.map((scenario) => <p key={scenario.name} className="rounded-2xl bg-paper/10 p-3 text-sm text-paper/80"><strong>{scenario.name} · {scenario.probability}</strong><br />{scenario.description}</p>)}
            </div>
          </article>
          <article className="rounded-3xl border border-paper/15 bg-paper/10 p-4">
            <h3 className="font-bold text-mint">观察点</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-paper/80">
              {result.report.watchPoints.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </article>
          <p className="text-xs leading-6 text-paper/55">{result.report.disclaimer}</p>
        </div>
      )}
      {result?.agent && (
        <ol className="mt-4 grid gap-2 text-sm" data-testid="agent-steps">
          {result.agent.steps.map((step, index) => (
            <li key={step.name} className="rounded-2xl border border-paper/15 bg-paper/10 p-3">
              <span className="font-mono text-mint/70">0{index + 1}</span> <strong>{step.name}</strong>
              <p className="mt-1 text-paper/70">{step.summary}</p>
            </li>
          ))}
        </ol>
      )}
      {result?.analysis && !result.report && <pre className="mt-4 whitespace-pre-wrap rounded-3xl border border-paper/15 bg-paper/10 p-4 text-sm leading-7 text-paper/90">{result.analysis}</pre>}
      {error && <p className="mt-3 text-sm font-bold text-red-200">{error}</p>}
    </section>
  );
}

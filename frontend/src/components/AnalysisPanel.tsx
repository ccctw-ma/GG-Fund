import { Brain, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api, type FundAnalysisResponse } from '../api';
import type { FundQuote } from '../types';

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
        <ol className="mt-4 grid gap-2 text-sm" data-testid="agent-steps">
          {result.agent.steps.map((step, index) => (
            <li key={step.name} className="rounded-2xl border border-paper/15 bg-paper/10 p-3">
              <span className="font-mono text-mint/70">0{index + 1}</span> <strong>{step.name}</strong>
              <p className="mt-1 text-paper/70">{step.summary}</p>
            </li>
          ))}
        </ol>
      )}
      {result?.analysis && <pre className="mt-4 whitespace-pre-wrap rounded-3xl border border-paper/15 bg-paper/10 p-4 text-sm leading-7 text-paper/90">{result.analysis}</pre>}
      {error && <p className="mt-3 text-sm font-bold text-red-200">{error}</p>}
    </section>
  );
}

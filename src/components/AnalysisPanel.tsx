import { Brain, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import type { FundQuote } from '../types';

export function AnalysisPanel({ selectedFund }: { selectedFund?: FundQuote }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function analyze() {
    if (!selectedFund) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await api.analyzeFund(selectedFund.code);
      setAnalysis(result.analysis);
    } catch (event) {
      setError(event instanceof Error ? event.message : '分析失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="newspaper-panel bg-ink p-5 text-paper" id="ai-analysis">
      <div className="section-kicker text-paper/60">DeepSeek research note</div>
      <h2 className="font-display text-2xl">基金走势分析</h2>
      <p className="mt-2 text-sm leading-6 text-paper/65">服务端拉取实时行情、历史净值和指数数据，用 DeepSeek v4 Flash 生成研究摘要。API key 只保存在 Cloudflare Secret。</p>
      <button className="paper-button mt-4" onClick={analyze} disabled={!selectedFund || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
        {selectedFund ? `分析 ${selectedFund.name}` : '先选择基金'}
      </button>
      {analysis && <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-paper/15 bg-paper/10 p-4 text-sm leading-7 text-paper/90">{analysis}</pre>}
      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
    </section>
  );
}

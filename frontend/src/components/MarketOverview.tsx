import { Activity } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { IndexQuote } from '../types';
import { Badge } from './ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

export function MarketOverview({ indices, loading, error }: { indices: IndexQuote[]; loading: boolean; error?: string }) {
  return (
    <Card id="markets" className="overflow-hidden">
      <CardHeader>
        <div>
          <Badge tone="blue" className="mb-2"><Activity className="h-3 w-3" /> Market</Badge>
          <CardTitle>今日大盘</CardTitle>
          <CardDescription>实时指数概览，使用 Recharts 绘制涨跌幅分布。</CardDescription>
        </div>
        <Badge tone="slate">公开数据</Badge>
      </CardHeader>
      {loading && <p className="text-sm font-semibold text-ink/50">正在加载市场数据…</p>}
      {error && <p className="rounded-3xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="rounded-[1.6rem] bg-[#10251f]/[0.04] p-3">
        <div className="h-56 min-h-56 min-w-0 overflow-x-auto" data-testid="market-chart">
          <BarChart width={640} height={220} data={indices} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,37,31,.12)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#68746b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#68746b' }} />
            <Tooltip />
            <Bar dataKey="changePercent" name="涨跌幅%" fill="#0d3029" radius={[10, 10, 0, 0]} />
          </BarChart>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {indices.map((index) => {
          const positive = index.changePercent >= 0;
          return (
            <article className="rounded-[1.4rem] border border-[#10251f]/10 bg-white/55 p-4 shadow-sm" key={index.code}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-extrabold text-ink">{index.name}</span>
                <span className={positive ? 'text-[var(--bull)]' : 'text-[var(--bear)]'}>{positive ? '▲' : '▼'}</span>
              </div>
              <strong className="block text-3xl font-black tracking-tight text-ink">{index.value.toFixed(2)}</strong>
              <em className={positive ? 'not-italic font-black text-[var(--bull)]' : 'not-italic font-black text-[var(--bear)]'}>
                {positive ? '+' : ''}{index.change.toFixed(2)} / {positive ? '+' : ''}{index.changePercent.toFixed(2)}%
              </em>
              <small className="mt-3 block text-xs font-semibold text-ink/45">{index.quoteTime}</small>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

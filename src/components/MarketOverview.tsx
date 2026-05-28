import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
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
          <CardDescription>主要指数延迟行情，显示最新来源时间。</CardDescription>
        </div>
        <Badge tone="slate">公开数据</Badge>
      </CardHeader>
      {loading && <p className="text-sm text-slate-500">正在加载市场数据…</p>}
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {indices.map((index) => {
          const positive = index.changePercent >= 0;
          const Icon = positive ? TrendingUp : TrendingDown;
          return (
            <article className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4" key={index.code}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-700">{index.name}</span>
                <Icon className={positive ? 'h-5 w-5 text-red-500' : 'h-5 w-5 text-emerald-500'} />
              </div>
              <strong className="block text-3xl font-black tracking-tight text-slate-950">{index.value.toFixed(2)}</strong>
              <em className={positive ? 'not-italic font-bold text-red-600' : 'not-italic font-bold text-emerald-600'}>
                {positive ? '+' : ''}{index.change.toFixed(2)} / {positive ? '+' : ''}{index.changePercent.toFixed(2)}%
              </em>
              <small className="mt-3 block text-xs text-slate-400">{index.quoteTime}</small>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

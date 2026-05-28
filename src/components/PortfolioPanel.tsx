import { PieChart, Trash2, WalletCards } from 'lucide-react';
import type { PortfolioSummary, WatchItem } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });

export function PortfolioPanel({
  summary,
  watchlist,
  onRemoveHolding,
}: {
  summary: PortfolioSummary;
  watchlist: WatchItem[];
  onRemoveHolding: (id: string) => void;
}) {
  const positive = summary.totalProfit >= 0;

  return (
    <Card id="portfolio" className="lg:col-span-2">
      <CardHeader>
        <div>
          <Badge tone="blue" className="mb-2"><WalletCards className="h-3 w-3" /> Portfolio</Badge>
          <CardTitle>我的持仓分析</CardTitle>
          <CardDescription>持仓仍保存在浏览器本地，服务端数据库用于组合快照和行情缓存能力。</CardDescription>
        </div>
        <Badge tone={positive ? 'red' : 'green'}>{summary.totalReturnRate.toFixed(2)}%</Badge>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl bg-slate-950 p-5 text-white"><span className="text-sm text-slate-300">当前市值</span><strong className="mt-2 block text-3xl">{money.format(summary.totalMarketValue)}</strong></div>
        <div className="rounded-3xl bg-slate-100 p-5 text-slate-950"><span className="text-sm text-slate-500">投入成本</span><strong className="mt-2 block text-3xl">{money.format(summary.totalCost)}</strong></div>
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200"><span className="text-sm text-slate-500">累计盈亏</span><strong className={positive ? 'mt-2 block text-3xl text-red-600' : 'mt-2 block text-3xl text-emerald-600'}>{money.format(summary.totalProfit)}</strong></div>
      </div>
      {summary.items.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500">还没有持仓。搜索基金后点击“加入持仓”即可开始分析。</div>
      ) : (
        <div className="mt-5 grid gap-3">
          {summary.items.map((item) => (
            <article className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-[1.4fr_1fr_0.7fr_auto] md:items-center" key={item.id}>
              <div>
                <strong className="text-slate-950">{item.fundName}</strong>
                <small className="block text-slate-500">{item.fundCode} · 份额 {item.shares}</small>
              </div>
              <div>
                <span className="font-bold text-slate-950">{money.format(item.marketValue)}</span>
                <small className={item.profit >= 0 ? 'block font-semibold text-red-600' : 'block font-semibold text-emerald-600'}>{money.format(item.profit)} / {item.returnRate.toFixed(2)}%</small>
              </div>
              <div>
                <span className="font-bold text-slate-950"><PieChart className="mr-1 inline h-4 w-4" />{item.weight.toFixed(1)}%</span>
                <small className="block text-slate-500">{item.quoteStatus === 'ok' ? item.quote?.quoteDate : '净值未知'}</small>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRemoveHolding(item.id)}><Trash2 className="h-4 w-4" />删除</Button>
            </article>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <h3 className="mr-2 w-full text-lg font-bold text-slate-950">自选基金</h3>
        {watchlist.length === 0 ? <p className="text-sm text-slate-500">暂无自选基金。</p> : watchlist.map((item) => <Badge tone="slate" key={item.fundCode}>{item.fundName} {item.fundCode}</Badge>)}
      </div>
    </Card>
  );
}

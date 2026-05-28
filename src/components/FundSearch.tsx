import { Search, Star, WalletCards } from 'lucide-react';
import type { FundHistoryPoint, FundQuote, WatchItem } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';

type Props = {
  query: string;
  setQuery: (value: string) => void;
  results: FundQuote[];
  selectedFund?: FundQuote;
  history: FundHistoryPoint[];
  loading: boolean;
  error?: string;
  onSearch: () => void;
  onSelect: (code: string) => void;
  onAddHolding: (fund: FundQuote) => void;
  onToggleWatch: (fund: FundQuote) => void;
  watchlist: WatchItem[];
};

export function FundSearch({
  query,
  setQuery,
  results,
  selectedFund,
  history,
  loading,
  error,
  onSearch,
  onSelect,
  onAddHolding,
  onToggleWatch,
  watchlist,
}: Props) {
  const max = Math.max(...history.map((point) => point.netValue), 1);
  const min = Math.min(...history.map((point) => point.netValue), 0);
  const range = Math.max(max - min, 0.01);

  return (
    <Card id="funds" className="lg:col-span-1">
      <CardHeader>
        <div>
          <Badge tone="blue" className="mb-2"><Search className="h-3 w-3" /> Funds</Badge>
          <CardTitle>基金搜索</CardTitle>
          <CardDescription>接入天天基金盘中估算与东方财富官方净值；基金官方净值通常按交易日更新。</CardDescription>
        </div>
      </CardHeader>
      <div className="flex gap-2">
        <Input
          aria-label="基金代码或名称"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onSearch()}
          placeholder="输入基金代码或名称，例如 000001 / 消费"
        />
        <Button onClick={onSearch}><Search className="h-4 w-4" />搜索</Button>
      </div>
      {loading && <p className="mt-3 text-sm text-slate-500">正在查询基金…</p>}
      {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-4 grid gap-2">
        {results.map((fund) => (
          <button className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg" key={fund.code} onClick={() => onSelect(fund.code)}>
            <span>
              <strong className="block text-slate-900">{fund.name}</strong>
              <small className="text-slate-500">{fund.code} · {fund.source}{fund.quoteDate ? ` · ${fund.quoteDate}` : ''}</small>
            </span>
            <strong className="text-lg tabular-nums text-slate-950">{fund.netValue ? fund.netValue.toFixed(4) : '--'}</strong>
          </button>
        ))}
      </div>
      {selectedFund && (
        <article className="mt-5 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <Badge tone={selectedFund.quoteType === 'estimate' ? 'red' : 'green'} className="mb-2">
                {selectedFund.quoteType === 'estimate' ? '实时估算' : '官方净值'}
              </Badge>
              <h3 className="text-2xl font-black tracking-tight text-slate-950">{selectedFund.name}</h3>
              <p className="text-sm text-slate-500">
                {selectedFund.code} · {selectedFund.quoteType === 'estimate' ? '盘中估算净值' : '最新官方净值'} {selectedFund.netValue ? selectedFund.netValue.toFixed(4) : '--'} · 官方日期 {selectedFund.quoteDate || '待更新'}
              </p>
              {selectedFund.officialNetValue && selectedFund.quoteType === 'estimate' && (
                <p className="mt-1 text-sm text-slate-500">上一官方净值：{selectedFund.officialNetValue.toFixed(4)} · 估算时间：{selectedFund.estimateTime || '未知'}</p>
              )}
              <p className={selectedFund.dailyChangePercent && selectedFund.dailyChangePercent >= 0 ? 'mt-2 font-bold text-red-600' : 'mt-2 font-bold text-emerald-600'}>
                日涨跌：{selectedFund.dailyChangePercent?.toFixed(2) ?? '--'}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onAddHolding(selectedFund)}><WalletCards className="h-4 w-4" />加入持仓</Button>
              <Button variant="secondary" onClick={() => onToggleWatch(selectedFund)}>
                <Star className="h-4 w-4" />{watchlist.some((item) => item.fundCode === selectedFund.code) ? '移出自选' : '加入自选'}
              </Button>
            </div>
          </div>
          <div className="mt-5 flex h-28 items-end gap-1 rounded-2xl border border-blue-100 bg-white/70 p-3" aria-label="历史净值走势">
            {history.map((point) => (
              <span
                key={point.date}
                className="flex-1 rounded-t-full bg-gradient-to-t from-blue-600 to-cyan-300"
                style={{ height: `${Math.max(10, ((point.netValue - min) / range) * 92)}%` }}
                title={`${point.date}: ${point.netValue}`}
              />
            ))}
          </div>
        </article>
      )}
    </Card>
  );
}

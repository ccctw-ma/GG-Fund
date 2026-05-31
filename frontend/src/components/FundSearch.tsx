'use client';

import { Search, Star, WalletCards } from 'lucide-react';
import type { FundHistoryPoint, FundQuote, WatchItem } from '../types';
import { FundTrendChart } from './FundTrendChart';
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

const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
const compactNumberFormat = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 2 });

function formatAssetValue(fund: FundQuote) {
  return fund.assetType === 'stock' ? fund.netValue.toFixed(2) : fund.netValue ? fund.netValue.toFixed(4) : '--';
}

export function FundSearch({ query, setQuery, results, selectedFund, history, loading, error, onSearch, onSelect, onAddHolding, onToggleWatch, watchlist }: Props) {
  const selectedIsStock = selectedFund?.assetType === 'stock';
  return (
    <Card id="funds" className="lg:col-span-1">
      <CardHeader>
        <div>
          <Badge tone="blue" className="mb-2"><Search className="h-3 w-3" /> Data Gateway</Badge>
          <CardTitle>金融资产搜索</CardTitle>
          <CardDescription>基金净值、A股实时行情、公开数据源自动切换。</CardDescription>
        </div>
      </CardHeader>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input aria-label="基金、股票代码或名称" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSearch()} placeholder="输入基金/股票，例如 000001 / 消费 / 600519 / 茅台" />
        <Button onClick={onSearch}><Search className="h-4 w-4" />搜索</Button>
      </div>
      {loading && <p className="mt-3 text-sm font-semibold text-ink/50">正在查询金融数据…</p>}
      {error && <p className="mt-3 rounded-3xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-4 grid gap-2">
        {results.map((fund) => (
          <button className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[1.35rem] border border-white/10 bg-slate-950/42 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_14px_36px_rgba(0,0,0,.16)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--mint)]/45 hover:bg-slate-950/58" key={`${fund.assetType ?? 'fund'}-${fund.code}`} onClick={() => onSelect(fund.code)}>
            <span>
              <strong className="block text-[rgba(248,250,252,.96)]">{fund.name}</strong>
              <small className="text-[rgba(226,232,240,.68)]">{fund.assetType === 'stock' ? '股票' : '基金'} · {fund.market ? `${fund.market} · ` : ''}{fund.code} · {fund.source}{fund.quoteDate ? ` · ${fund.quoteDate}` : ''}</small>
            </span>
            <span className="text-right">
              <strong className="block text-lg tabular-nums text-[rgba(248,250,252,.98)]">{formatAssetValue(fund)}</strong>
              {fund.dailyChangePercent !== undefined && <small className={fund.dailyChangePercent >= 0 ? 'font-black text-[#7de2b8]' : 'font-black text-[#ff8f8f]'}>{fund.dailyChangePercent >= 0 ? '+' : ''}{fund.dailyChangePercent.toFixed(2)}%</small>}
            </span>
          </button>
        ))}
      </div>
      {selectedFund && (
        <article className="mt-5 rounded-[1.75rem] border border-[#10251f]/10 bg-gradient-to-br from-white/80 to-[#e5f7e9]/70 p-5 shadow-inner">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <Badge tone={selectedIsStock ? 'blue' : selectedFund.quoteType === 'estimate' ? 'red' : 'green'} className="mb-2">{selectedIsStock ? '实时股价' : selectedFund.quoteType === 'estimate' ? '实时估算' : '官方净值'}</Badge>
              <h3 className="font-display text-3xl font-black tracking-[-0.05em] text-ink">{selectedFund.name}</h3>
              <p className="text-sm font-semibold text-ink/60">{selectedFund.market ? `${selectedFund.market} · ` : ''}{selectedFund.code} · {selectedIsStock ? '最新价' : selectedFund.quoteType === 'estimate' ? '盘中估算净值' : '最新官方净值'} {formatAssetValue(selectedFund)} · 日期 {selectedFund.quoteDate || '待更新'}</p>
              {selectedFund.officialNetValue && selectedFund.quoteType === 'estimate' && <p className="mt-1 text-sm text-ink/60">上一官方净值：{selectedFund.officialNetValue.toFixed(4)} · 估算时间：{selectedFund.estimateTime || '未知'}</p>}
              <p className={selectedFund.dailyChangePercent && selectedFund.dailyChangePercent >= 0 ? 'mt-2 font-black text-[var(--bull)]' : 'mt-2 font-black text-[var(--bear)]'}>日涨跌：{selectedFund.dailyChangePercent?.toFixed(2) ?? '--'}%</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onAddHolding(selectedFund)}><WalletCards className="h-4 w-4" />加入持仓</Button>
              <Button variant="secondary" onClick={() => onToggleWatch(selectedFund)}><Star className="h-4 w-4" />{watchlist.some((item) => item.fundCode === selectedFund.code) ? '移出自选' : '加入自选'}</Button>
            </div>
          </div>
          {selectedIsStock ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['今开', selectedFund.open ? numberFormat.format(selectedFund.open) : '--'],
                ['昨收', selectedFund.previousClose ? numberFormat.format(selectedFund.previousClose) : '--'],
                ['最高 / 最低', selectedFund.high && selectedFund.low ? `${numberFormat.format(selectedFund.high)} / ${numberFormat.format(selectedFund.low)}` : '--'],
                ['成交量 / 成交额', selectedFund.volume || selectedFund.turnover ? `${selectedFund.volume ? compactNumberFormat.format(selectedFund.volume) : '--'} / ${selectedFund.turnover ? compactNumberFormat.format(selectedFund.turnover) : '--'}` : '--'],
              ].map(([label, value]) => (
                <div className="rounded-3xl border border-[#10251f]/10 bg-white/60 p-4" key={label}>
                  <small className="text-xs font-black uppercase tracking-[0.18em] text-ink/45">{label}</small>
                  <strong className="mt-2 block text-lg font-black text-ink">{value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <FundTrendChart history={history} />
          )}
        </article>
      )}
    </Card>
  );
}

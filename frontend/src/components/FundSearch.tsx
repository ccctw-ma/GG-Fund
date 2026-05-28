import { Search, Star, WalletCards } from 'lucide-react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
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

export function FundSearch({ query, setQuery, results, selectedFund, history, loading, error, onSearch, onSelect, onAddHolding, onToggleWatch, watchlist }: Props) {
  return (
    <Card id="funds" className="lg:col-span-1">
      <CardHeader>
        <div>
          <Badge tone="blue" className="mb-2"><Search className="h-3 w-3" /> Funds</Badge>
          <CardTitle>基金搜索</CardTitle>
          <CardDescription>盘中估算、官方净值与历史净值曲线。</CardDescription>
        </div>
      </CardHeader>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input aria-label="基金代码或名称" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSearch()} placeholder="输入基金代码或名称，例如 000001 / 消费" />
        <Button onClick={onSearch}><Search className="h-4 w-4" />搜索</Button>
      </div>
      {loading && <p className="mt-3 text-sm font-semibold text-ink/50">正在查询基金…</p>}
      {error && <p className="mt-3 rounded-3xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-4 grid gap-2">
        {results.map((fund) => (
          <button className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[1.35rem] border border-[#10251f]/10 bg-white/58 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#047857]/40 hover:bg-white" key={fund.code} onClick={() => onSelect(fund.code)}>
            <span><strong className="block text-ink">{fund.name}</strong><small className="text-ink/55">{fund.code} · {fund.source}{fund.quoteDate ? ` · ${fund.quoteDate}` : ''}</small></span>
            <strong className="text-lg tabular-nums text-ink">{fund.netValue ? fund.netValue.toFixed(4) : '--'}</strong>
          </button>
        ))}
      </div>
      {selectedFund && (
        <article className="mt-5 rounded-[1.75rem] border border-[#10251f]/10 bg-gradient-to-br from-white/80 to-[#e5f7e9]/70 p-5 shadow-inner">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <Badge tone={selectedFund.quoteType === 'estimate' ? 'red' : 'green'} className="mb-2">{selectedFund.quoteType === 'estimate' ? '实时估算' : '官方净值'}</Badge>
              <h3 className="font-display text-3xl font-black tracking-[-0.05em] text-ink">{selectedFund.name}</h3>
              <p className="text-sm font-semibold text-ink/60">{selectedFund.code} · {selectedFund.quoteType === 'estimate' ? '盘中估算净值' : '最新官方净值'} {selectedFund.netValue ? selectedFund.netValue.toFixed(4) : '--'} · 官方日期 {selectedFund.quoteDate || '待更新'}</p>
              {selectedFund.officialNetValue && selectedFund.quoteType === 'estimate' && <p className="mt-1 text-sm text-ink/60">上一官方净值：{selectedFund.officialNetValue.toFixed(4)} · 估算时间：{selectedFund.estimateTime || '未知'}</p>}
              <p className={selectedFund.dailyChangePercent && selectedFund.dailyChangePercent >= 0 ? 'mt-2 font-black text-[var(--bull)]' : 'mt-2 font-black text-[var(--bear)]'}>日涨跌：{selectedFund.dailyChangePercent?.toFixed(2) ?? '--'}%</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onAddHolding(selectedFund)}><WalletCards className="h-4 w-4" />加入持仓</Button>
              <Button variant="secondary" onClick={() => onToggleWatch(selectedFund)}><Star className="h-4 w-4" />{watchlist.some((item) => item.fundCode === selectedFund.code) ? '移出自选' : '加入自选'}</Button>
            </div>
          </div>
          <div className="mt-5 h-48 min-h-48 min-w-0 overflow-x-auto rounded-[1.4rem] bg-[#fffaf0]/70 p-2" data-testid="fund-chart" aria-label="历史净值走势">
            <LineChart width={640} height={190} data={history} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,37,31,.12)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#68746b' }} minTickGap={18} />
              <YAxis domain={['dataMin', 'dataMax']} tick={{ fontSize: 11, fill: '#68746b' }} />
              <Tooltip />
              <Line type="monotone" dataKey="netValue" name="单位净值" stroke="#047857" strokeWidth={3} dot={false} />
            </LineChart>
          </div>
        </article>
      )}
    </Card>
  );
}

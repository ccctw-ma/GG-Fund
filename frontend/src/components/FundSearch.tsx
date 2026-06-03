'use client';

import { Layers, Search, Star, WalletCards } from 'lucide-react';
import type { FundHistoryPoint, FundHoldings, FundQuote, WatchItem } from '../types';
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
  benchmarkHistory?: FundHistoryPoint[];
  holdings?: FundHoldings;
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
const fixedPercent = (value: number) => value.toFixed(2);

function formatAssetValue(fund: FundQuote) {
  return fund.assetType === 'stock' ? fund.netValue.toFixed(2) : fund.netValue ? fund.netValue.toFixed(4) : '--';
}

export function FundSearch({ query, setQuery, results, selectedFund, history, benchmarkHistory = [], holdings, loading, error, onSearch, onSelect, onAddHolding, onToggleWatch, watchlist }: Props) {
  const selectedIsStock = selectedFund?.assetType === 'stock';
  const holdingStocks = holdings?.stocks ?? [];
  const disclosedStockWeight = holdingStocks.reduce((sum, stock) => sum + stock.weight, 0);
  const topTenWeight = holdingStocks.reduce((sum, stock, index) => sum + ((stock.isTopTen ?? (stock.rank ? stock.rank <= 10 : index < 10)) ? stock.weight : 0), 0);
  const disclosedBeyondTopTenWeight = Math.max(0, disclosedStockWeight - topTenWeight);
  const undisclosedWeight = Math.max(0, 100 - disclosedStockWeight);
  return (
    <Card id="funds" className="fund-search-card">
      <CardHeader>
        <div>
          <Badge tone="violet" className="mb-2"><Search className="h-3 w-3" /> Data Gateway</Badge>
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
      <div className="fund-result-tabs">
        {results.map((fund) => (
          <button className={`fund-result-tab ${selectedFund?.code === fund.code ? 'is-active' : ''}`} key={`${fund.assetType ?? 'fund'}-${fund.code}`} onClick={() => onSelect(fund.code)} aria-pressed={selectedFund?.code === fund.code}>
            <span>
              <strong className="block text-[rgba(248,250,252,.96)]">{fund.name}</strong>
              <small className="text-[rgba(226,232,240,.68)]">{fund.assetType === 'stock' ? '股票' : '基金'} · {fund.market ? `${fund.market} · ` : ''}{fund.code} · {fund.source}{fund.quoteDate ? ` · ${fund.quoteDate}` : ''}</small>
            </span>
            <span className="text-right">
              <strong className="block text-lg tabular-nums text-[rgba(248,250,252,.98)]">{formatAssetValue(fund)}</strong>
              {fund.dailyChangePercent !== undefined && <small className={fund.dailyChangePercent >= 0 ? 'font-black text-[var(--bull)]' : 'font-black text-[var(--bear)]'}>{fund.dailyChangePercent >= 0 ? '+' : ''}{fund.dailyChangePercent.toFixed(2)}%</small>}
            </span>
          </button>
        ))}
      </div>
      {selectedFund && (
        <article className="fund-detail-panel">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <Badge tone={selectedIsStock ? 'blue' : selectedFund.quoteType === 'estimate' ? 'red' : 'green'} className="mb-2">{selectedIsStock ? '实时股价' : selectedFund.quoteType === 'estimate' ? '实时估算' : '官方净值'}</Badge>
              <h3 className="font-display text-3xl font-black tracking-[-0.05em] text-[var(--text-strong)]">{selectedFund.name}</h3>
              <p className="text-sm font-semibold text-[var(--text-muted)]">{selectedFund.market ? `${selectedFund.market} · ` : ''}{selectedFund.code} · {selectedIsStock ? '最新价' : selectedFund.quoteType === 'estimate' ? '盘中估算净值' : '最新官方净值'} {formatAssetValue(selectedFund)} · 日期 {selectedFund.quoteDate || '待更新'}</p>
              {selectedFund.officialNetValue && selectedFund.quoteType === 'estimate' && <p className="mt-1 text-sm text-[var(--text-muted)]">上一官方净值：{selectedFund.officialNetValue.toFixed(4)} · 估算时间：{selectedFund.estimateTime || '未知'}</p>}
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
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4" key={label}>
                  <small className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</small>
                  <strong className="mt-2 block text-lg font-black text-[var(--text-strong)]">{value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <FundTrendChart history={history} benchmarkHistory={benchmarkHistory} />
          )}
          {!selectedIsStock && holdingStocks.length > 0 && (
            <div className="fund-holdings" data-testid="fund-holdings">
              <div className="fund-holdings-head">
                <span><Layers className="h-4 w-4" /> 已披露股票持仓 / 占净值比</span>
                {holdings?.reportDate && <small>报告期 {holdings.reportDate}</small>}
              </div>
              <p className="fund-holdings-note">
                已披露股票合计 {fixedPercent(disclosedStockWeight)}%，其中前十大 {fixedPercent(topTenWeight)}%、前十大以外已披露 {fixedPercent(disclosedBeyondTopTenWeight)}%；未逐项披露或非股票资产约 {fixedPercent(undisclosedWeight)}%。
              </p>
              <ul>
                {holdingStocks.map((stock, index) => (
                  <li key={stock.code}>
                    <button type="button" onClick={() => onSelect(stock.code)} aria-label={`查看 ${stock.name} 详情`}>
                      <span className="fund-holdings-name">
                        <strong>{stock.name}</strong>
                        <small>
                          #{stock.rank ?? index + 1} · {stock.code}{stock.industry ? ` · ${stock.industry}` : ''}{stock.changeType ? ` · ${stock.changeType}` : ''}
                          {stock.shares !== undefined ? ` · 持股 ${numberFormat.format(stock.shares)}万股` : ''}
                        </small>
                      </span>
                      <span className="fund-holdings-weight">
                        <em>{stock.weight.toFixed(2)}%</em>
                        <i style={{ width: `${Math.min(100, stock.weight * 4)}%` }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </Card>
  );
}

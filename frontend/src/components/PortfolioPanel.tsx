'use client';

import { BellRing, Check, ClipboardList, Pencil, PieChart, Radar, Repeat2, Trash2, WalletCards, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PortfolioItem, PortfolioSignal, PortfolioSummary, WatchItem } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });

function signalClass(signal: PortfolioSignal) {
  return `yb-signal yb-signal-${signal.tone}`;
}

type SortKey = 'marketValue' | 'returnRate' | 'name';

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: 'marketValue', label: '按市值' },
  { key: 'returnRate', label: '按收益率' },
  { key: 'name', label: '按名称' },
];

function sortItems(items: PortfolioItem[], key: SortKey) {
  const next = [...items];
  if (key === 'marketValue') return next.sort((a, b) => b.marketValue - a.marketValue);
  if (key === 'returnRate') return next.sort((a, b) => b.returnRate - a.returnRate);
  return next.sort((a, b) => a.fundName.localeCompare(b.fundName, 'zh-Hans-CN'));
}

export function PortfolioPanel({
  summary,
  watchlist,
  onRemoveHolding,
  onUpdateHolding,
}: {
  summary: PortfolioSummary;
  watchlist: WatchItem[];
  onRemoveHolding: (id: string) => void;
  onUpdateHolding: (id: string, patch: { recordedMarketValue: number; costAmount: number }) => void;
}) {
  const positive = summary.totalProfit >= 0;
  const [sortKey, setSortKey] = useState<SortKey>('marketValue');
  const [editingId, setEditingId] = useState<string>();
  const [editValue, setEditValue] = useState('');
  const [editCost, setEditCost] = useState('');
  const sortedItems = useMemo(() => sortItems(summary.items, sortKey), [summary.items, sortKey]);

  function startEdit(item: PortfolioItem) {
    setEditingId(item.id);
    setEditValue(item.marketValue.toFixed(2));
    setEditCost(item.costAmount.toFixed(2));
  }

  function cancelEdit() {
    setEditingId(undefined);
    setEditValue('');
    setEditCost('');
  }

  function commitEdit(id: string) {
    const recordedMarketValue = Number(editValue);
    const costAmount = Number(editCost);
    if (!Number.isFinite(recordedMarketValue) || recordedMarketValue <= 0 || !Number.isFinite(costAmount) || costAmount < 0) return;
    onUpdateHolding(id, { recordedMarketValue: Number(recordedMarketValue.toFixed(2)), costAmount: Number(costAmount.toFixed(2)) });
    cancelEdit();
  }

  return (
    <Card id="portfolio" className="lg:col-span-2">
      <CardHeader>
        <div>
          <Badge tone="blue" className="mb-2"><WalletCards className="h-3 w-3" /> Yangjibao Layer</Badge>
          <CardTitle>我的持仓分析</CardTitle>
          <CardDescription>对标养基宝的账本、盈亏报告、风险提醒和定投路径；真实交易/OCR/全网用户行为暂不伪造。</CardDescription>
        </div>
        <Badge tone={positive ? 'red' : 'green'}>{summary.totalReturnRate.toFixed(2)}%</Badge>
      </CardHeader>
      <div className="yb-hero-grid">
        <div className="yb-metric yb-metric-primary"><span>当前市值</span><strong>{money.format(summary.totalMarketValue)}</strong><small>实时覆盖 {summary.liveQuoteRatio.toFixed(0)}%</small></div>
        <div className="yb-metric"><span>今日估算收益</span><strong className={summary.estimatedDailyProfit >= 0 ? 'profit-up' : 'profit-down'}>{summary.estimatedDailyProfit >= 0 ? '+' : ''}{money.format(summary.estimatedDailyProfit)}</strong><small>按已返回日涨跌本地估算</small></div>
        <div className="yb-metric"><span>累计盈亏</span><strong className={positive ? 'profit-up' : 'profit-down'}>{money.format(summary.totalProfit)}</strong><small>{summary.totalReturnRate.toFixed(2)}% · 投入 {money.format(summary.totalCost)}</small></div>
      </div>
      <div className="yb-module-grid">
        <section className="yb-module">
          <h3><ClipboardList className="h-4 w-4" /> 多平台账本</h3>
          {summary.ledgers.length === 0 ? (
            <p className="yb-empty-copy">导入或添加持仓后，自动按支付宝、理财通、天天基金、雪球等来源分账本汇总。</p>
          ) : (
            <div className="yb-ledger-list">
              {summary.ledgers.map((ledger) => (
                <article key={`${ledger.accountName}-${ledger.platform}`}>
                  <span>{ledger.accountName} · {ledger.platform}</span>
                  <strong>{money.format(ledger.marketValue)}</strong>
                  <small>{ledger.holdingCount} 只 · 盈亏 {money.format(ledger.profit)}</small>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="yb-module yb-module-glow">
          <h3><Repeat2 className="h-4 w-4" /> 智能定投 / 目标止盈</h3>
          <strong className="yb-plan-amount">{money.format(summary.plan.amount)}</strong>
          <p>{summary.plan.title} · {summary.plan.cadence}</p>
          <small>{summary.plan.detail}</small>
        </section>
      </div>
      <div className="yb-signal-grid">
        <section className="yb-signal-panel">
          <h3><Radar className="h-4 w-4" /> 风险诊断</h3>
          {summary.riskSignals.map((signal) => <article className={signalClass(signal)} key={signal.title}><strong>{signal.title}</strong><span>{signal.detail}</span></article>)}
        </section>
        <section className="yb-signal-panel">
          <h3><BellRing className="h-4 w-4" /> 盈亏报告与提醒</h3>
          {[...summary.reportSignals, ...summary.actionSignals].map((signal) => <article className={signalClass(signal)} key={signal.title}><strong>{signal.title}</strong><span>{signal.detail}</span></article>)}
        </section>
      </div>
      {summary.items.length === 0 ? (
        <div className="mt-5 rounded-[1.7rem] border border-dashed border-[#10251f]/18 p-8 text-center font-semibold text-ink/50">还没有持仓。搜索基金后点击“加入持仓”即可开始分析。</div>
      ) : (
        <>
          <div className="yb-holding-toolbar">
            <span>持仓明细</span>
            <div className="yb-sort-group" role="group" aria-label="持仓排序">
              {sortOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={option.key === sortKey ? 'yb-sort-chip is-active' : 'yb-sort-chip'}
                  aria-pressed={option.key === sortKey}
                  onClick={() => setSortKey(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            {sortedItems.map((item) => (
              <article className="yb-holding-row" key={item.id}>
                <div>
                  <strong className="yb-holding-name">{item.fundName}</strong>
                  <small className="yb-holding-meta">{/^\d{6}$/.test(item.fundCode) ? item.fundCode : '自填持仓'}{item.shares ? ` · 份额 ${item.shares}` : ''}</small>
                </div>
                {editingId === item.id ? (
                  <div className="yb-holding-edit">
                    <label>
                      <span>持有金额</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={editValue} onChange={(event) => setEditValue(event.target.value)} aria-label={`${item.fundName} 持有金额`} />
                    </label>
                    <label>
                      <span>成本金额</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={editCost} onChange={(event) => setEditCost(event.target.value)} aria-label={`${item.fundName} 成本金额`} />
                    </label>
                  </div>
                ) : (
                  <div>
                    <span className="yb-holding-value">{money.format(item.marketValue)}</span>
                    <small className={item.profit >= 0 ? 'yb-holding-profit-up' : 'yb-holding-profit-down'}>{money.format(item.profit)} / {item.returnRate.toFixed(2)}%</small>
                  </div>
                )}
                <div>
                  <span className="yb-holding-weight"><PieChart className="mr-1 inline h-4 w-4" />{item.weight.toFixed(1)}%</span>
                  <small className="yb-holding-meta">{item.quote ? `${item.quote.quoteDate} · 今日 ${money.format(item.estimatedDailyProfit)}` : ''}</small>
                </div>
                {editingId === item.id ? (
                  <div className="yb-holding-actions">
                    <Button variant="ghost" size="sm" onClick={() => commitEdit(item.id)}><Check className="h-4 w-4" />保存</Button>
                    <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-4 w-4" />取消</Button>
                  </div>
                ) : (
                  <div className="yb-holding-actions">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)}><Pencil className="h-4 w-4" />编辑</Button>
                    <Button variant="ghost" size="sm" onClick={() => onRemoveHolding(item.id)}><Trash2 className="h-4 w-4" />删除</Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <h3 className="mr-2 w-full text-lg font-black text-ink">自选基金</h3>
        {watchlist.length === 0 ? <p className="text-sm font-semibold text-ink/50">暂无自选基金。</p> : watchlist.map((item) => <Badge tone="slate" key={item.fundCode}>{item.fundName} {item.fundCode}</Badge>)}
      </div>
    </Card>
  );
}

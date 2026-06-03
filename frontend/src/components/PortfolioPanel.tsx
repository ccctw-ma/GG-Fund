'use client';

import { BellRing, Check, ChevronDown, ClipboardList, Info, LineChart, Pencil, PieChart, Radar, Repeat2, Trash2, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { FundHistoryPoint, FundHoldings, FundQuote, PortfolioItem, PortfolioSignal, PortfolioSummary, WatchItem } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FundTrendChart } from './FundTrendChart';

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
  onEditIdentity,
}: {
  summary: PortfolioSummary;
  watchlist: WatchItem[];
  onRemoveHolding: (id: string) => void;
  onUpdateHolding: (id: string, patch: { recordedMarketValue: number; costAmount: number }) => void;
  onEditIdentity?: (id: string, patch: { fundCode: string; fundName: string }) => void;
}) {
  const positive = summary.totalProfit >= 0;
  const [sortKey, setSortKey] = useState<SortKey>('marketValue');
  const [editingId, setEditingId] = useState<string>();
  const [editValue, setEditValue] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string>();
  const [detailId, setDetailId] = useState<string>();
  const [historyMap, setHistoryMap] = useState<Record<string, FundHistoryPoint[]>>({});
  const [holdingsMap, setHoldingsMap] = useState<Record<string, FundHoldings>>({});
  const [stockId, setStockId] = useState<string>();
  const [stockQuoteMap, setStockQuoteMap] = useState<Record<string, FundQuote | null>>({});
  const sortedItems = useMemo(() => sortItems(summary.items, sortKey), [summary.items, sortKey]);

  const expandedItem = useMemo(() => summary.items.find((item) => item.id === expandedId), [summary.items, expandedId]);
  const expandedCode = expandedItem && /^\d{6}$/.test(expandedItem.fundCode) ? expandedItem.fundCode : undefined;
  const expandedHistory = expandedCode ? historyMap[expandedCode] ?? [] : [];
  const expandedLoading = Boolean(expandedCode) && historyMap[expandedCode ?? ''] === undefined;

  const detailItem = useMemo(() => summary.items.find((item) => item.id === detailId), [summary.items, detailId]);
  const detailCode = detailItem && /^\d{6}$/.test(detailItem.fundCode) ? detailItem.fundCode : undefined;
  const detailHoldings = detailCode ? holdingsMap[detailCode] : undefined;
  const detailHoldingsLoading = Boolean(detailCode) && holdingsMap[detailCode ?? ''] === undefined;

  useEffect(() => {
    if (!expandedCode || historyMap[expandedCode] !== undefined) return;
    let cancelled = false;
    api.getFundHistory(expandedCode, 'all')
      .then((points) => {
        if (!cancelled) setHistoryMap((current) => ({ ...current, [expandedCode]: points }));
      })
      .catch(() => {
        if (!cancelled) setHistoryMap((current) => ({ ...current, [expandedCode]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [expandedCode, historyMap]);

  useEffect(() => {
    if (!detailCode || holdingsMap[detailCode] !== undefined) return;
    let cancelled = false;
    api.getFundHoldings(detailCode)
      .then((holdings) => {
        if (!cancelled) setHoldingsMap((current) => ({ ...current, [detailCode]: holdings }));
      })
      .catch(() => {
        if (!cancelled) setHoldingsMap((current) => ({ ...current, [detailCode]: { stocks: [] } }));
      });
    return () => {
      cancelled = true;
    };
  }, [detailCode, holdingsMap]);

  useEffect(() => {
    if (!stockId || stockQuoteMap[stockId] !== undefined) return;
    let cancelled = false;
    api.getFund(stockId)
      .then((quote) => {
        if (!cancelled) setStockQuoteMap((current) => ({ ...current, [stockId]: quote }));
      })
      .catch(() => {
        if (!cancelled) setStockQuoteMap((current) => ({ ...current, [stockId]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [stockId, stockQuoteMap]);

  function toggleStock(code: string) {
    setStockId((current) => (current === code ? undefined : code));
  }

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? undefined : id));
  }

  function toggleDetail(id: string) {
    setDetailId((current) => (current === id ? undefined : id));
  }

  function startEdit(item: PortfolioItem) {
    setEditingId(item.id);
    setEditValue(item.marketValue.toFixed(2));
    setEditCost(item.costAmount.toFixed(2));
    setEditCode(/^\d{6}$/.test(item.fundCode) ? item.fundCode : '');
    setEditName(item.fundName);
  }

  function cancelEdit() {
    setEditingId(undefined);
    setEditValue('');
    setEditCost('');
    setEditCode('');
    setEditName('');
  }

  function commitEdit(id: string) {
    const recordedMarketValue = Number(editValue);
    const costAmount = Number(editCost);
    if (!Number.isFinite(recordedMarketValue) || recordedMarketValue <= 0 || !Number.isFinite(costAmount) || costAmount < 0) return;
    onUpdateHolding(id, { recordedMarketValue: Number(recordedMarketValue.toFixed(2)), costAmount: Number(costAmount.toFixed(2)) });
    const base = summary.items.find((item) => item.id === id);
    const codeChanged = editCode.trim() !== (base && /^\d{6}$/.test(base.fundCode) ? base.fundCode : '');
    const nameChanged = editName.trim() !== (base?.fundName ?? '');
    if (onEditIdentity && (codeChanged || nameChanged)) {
      onEditIdentity(id, { fundCode: editCode.trim(), fundName: editName.trim() });
    }
    cancelEdit();
  }

  return (
    <Card id="portfolio" className="lg:col-span-2">
      <CardHeader>
        <div>
          <Badge tone="amber" className="mb-2"><WalletCards className="h-3 w-3" /> Yangjibao Layer</Badge>
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
            {sortedItems.map((item) => {
              const hasCode = /^\d{6}$/.test(item.fundCode);
              const isExpanded = expandedId === item.id;
              const isDetail = detailId === item.id;
              return (
              <div key={item.id} className="yb-holding-wrap">
              <article className="yb-holding-row">
                <div>
                  <strong className="yb-holding-name">{item.fundName}</strong>
                  <small className="yb-holding-meta">{hasCode ? item.fundCode : '自填持仓'}{item.shares ? ` · 份额 ${item.shares}` : ''}</small>
                </div>
                {editingId === item.id ? (
                  <div className="yb-holding-edit">
                    <label>
                      <span>基金名称</span>
                      <input type="text" value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="改名称后自动查代码" aria-label={`${item.fundName} 基金名称`} />
                    </label>
                    <label>
                      <span>基金代码</span>
                      <input type="text" inputMode="numeric" value={editCode} onChange={(event) => setEditCode(event.target.value)} placeholder="6 位代码，自动拉详情" aria-label={`${item.fundName} 基金代码`} />
                    </label>
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
                    <Button variant="ghost" size="sm" aria-expanded={isDetail} aria-label={`${item.fundName} 持仓详情`} onClick={() => toggleDetail(item.id)}>
                      <Info className="h-4 w-4" />详情<ChevronDown className={`h-4 w-4 transition-transform ${isDetail ? 'rotate-180' : ''}`} />
                    </Button>
                    {hasCode && (
                      <Button variant="ghost" size="sm" aria-expanded={isExpanded} aria-label={`${item.fundName} 走势`} onClick={() => toggleExpand(item.id)}>
                        <LineChart className="h-4 w-4" />走势<ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)}><Pencil className="h-4 w-4" />编辑</Button>
                    <Button variant="ghost" size="sm" onClick={() => onRemoveHolding(item.id)}><Trash2 className="h-4 w-4" />删除</Button>
                  </div>
                )}
              </article>
              {isDetail && (
                <>
                <div className="yb-holding-detail" data-testid="holding-detail">
                  <div><span>基金代码</span><strong>{hasCode ? item.fundCode : '待补全'}</strong></div>
                  <div><span>最新净值</span><strong>{item.quote?.netValue ? item.quote.netValue.toFixed(4) : '自填估值'}</strong></div>
                  <div><span>日涨跌</span><strong className={(item.quote?.dailyChangePercent ?? 0) >= 0 ? 'yb-holding-profit-up' : 'yb-holding-profit-down'}>{item.quote?.dailyChangePercent !== undefined ? `${item.quote.dailyChangePercent >= 0 ? '+' : ''}${item.quote.dailyChangePercent.toFixed(2)}%` : '--'}</strong></div>
                  <div><span>持有市值</span><strong>{money.format(item.marketValue)}</strong></div>
                  <div><span>持仓成本</span><strong>{money.format(item.costAmount)}</strong></div>
                  <div><span>累计盈亏</span><strong className={item.profit >= 0 ? 'yb-holding-profit-up' : 'yb-holding-profit-down'}>{money.format(item.profit)} / {item.returnRate.toFixed(2)}%</strong></div>
                  <div><span>组合权重</span><strong>{item.weight.toFixed(1)}%</strong></div>
                  <div><span>账本来源</span><strong>{item.accountName ?? '默认账本'}</strong></div>
                  {item.holdingDays !== undefined && <div><span>持有天数</span><strong>{item.holdingDays} 天</strong></div>}
                </div>
                {hasCode && (
                  <div className="fund-holdings" data-testid="holding-positions">
                    <div className="fund-holdings-head">
                      <span><PieChart className="h-4 w-4" /> 持仓组成 / 占净值比</span>
                      {detailHoldings?.reportDate && <small>报告期 {detailHoldings.reportDate}</small>}
                    </div>
                    {detailHoldingsLoading ? (
                      <p className="yb-empty-copy">正在加载持仓组成…</p>
                    ) : (detailHoldings?.stocks.length ?? 0) === 0 ? (
                      <p className="yb-empty-copy">暂无该基金的持仓组成数据（指数/货币型基金或未披露）。</p>
                    ) : (
                      <ul>
                        {detailHoldings?.stocks.map((stock) => {
                          const isStockOpen = stockId === stock.code;
                          const stockQuote = stockQuoteMap[stock.code];
                          const stockLoading = isStockOpen && stockQuote === undefined;
                          return (
                          <li key={stock.code} className="fund-holdings-item">
                            <button type="button" aria-expanded={isStockOpen} aria-label={`查看 ${stock.name} 详情`} onClick={() => toggleStock(stock.code)}>
                              <span className="fund-holdings-name">
                                <strong>{stock.name}</strong>
                                <small>{stock.code}{stock.industry ? ` · ${stock.industry}` : ''}{stock.changeType ? ` · ${stock.changeType}` : ''}</small>
                              </span>
                              <span className="fund-holdings-weight">
                                <em>{stock.weight.toFixed(2)}%</em>
                                <i style={{ width: `${Math.min(100, stock.weight * 4)}%` }} />
                              </span>
                              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isStockOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isStockOpen && (
                              <div className="fund-holdings-detail" data-testid="holding-stock-detail">
                                {stockLoading ? (
                                  <p className="yb-empty-copy">正在加载 {stock.name} 行情…</p>
                                ) : !stockQuote ? (
                                  <p className="yb-empty-copy">暂无 {stock.name} 的实时行情。</p>
                                ) : (
                                  <>
                                    <div><span>{stockQuote.assetType === 'stock' ? '最新价' : '净值'}</span><strong>{stockQuote.netValue?.toFixed(2) ?? '--'}</strong></div>
                                    <div><span>日涨跌</span><strong className={(stockQuote.dailyChangePercent ?? 0) >= 0 ? 'yb-holding-profit-up' : 'yb-holding-profit-down'}>{stockQuote.dailyChangePercent !== undefined ? `${stockQuote.dailyChangePercent >= 0 ? '+' : ''}${stockQuote.dailyChangePercent.toFixed(2)}%` : '--'}</strong></div>
                                    {stockQuote.open !== undefined && <div><span>今开</span><strong>{stockQuote.open.toFixed(2)}</strong></div>}
                                    {stockQuote.previousClose !== undefined && <div><span>昨收</span><strong>{stockQuote.previousClose.toFixed(2)}</strong></div>}
                                    {stockQuote.high !== undefined && stockQuote.low !== undefined && <div><span>最高 / 最低</span><strong>{stockQuote.high.toFixed(2)} / {stockQuote.low.toFixed(2)}</strong></div>}
                                    <div><span>占基金净值</span><strong>{stock.weight.toFixed(2)}%</strong></div>
                                    <div><span>数据来源</span><strong>{stockQuote.source}</strong></div>
                                  </>
                                )}
                              </div>
                            )}
                          </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                </>
              )}
              {isExpanded && hasCode && (
                <FundTrendChart
                  history={expandedHistory}
                  loading={expandedLoading}
                  testId="holding-chart"
                  kicker="Holding Signal Matrix"
                  title={`${item.fundName} 净值走势`}
                  emptyHint="暂无该基金的历史净值，稍后重试。"
                />
              )}
              </div>
              );
            })}
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

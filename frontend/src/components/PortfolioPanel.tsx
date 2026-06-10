'use client';

import { BellRing, Bot, Check, ChevronDown, ClipboardList, Info, LineChart, LoaderCircle, Pencil, PieChart, Plus, Radar, RefreshCw, Repeat2, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type { FundAnalysisResponse, FundHistoryPoint, FundHoldings, FundIntradayPoint, FundQuote, PortfolioItem, PortfolioSignal, PortfolioSummary, WatchItem } from '../types';
import { FundAnalysisPanel } from './FundAnalysisPanel';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle } from './ui/card';
import { FundTrendChart } from './FundTrendChart';
import { IntradayTrendChart } from './IntradayTrendChart';

const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
const timeFormat = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fixedPercent = (value: number) => value.toFixed(2);

function signalClass(signal: PortfolioSignal) {
  return `yb-signal yb-signal-${signal.tone}`;
}

type SortKey = 'marketValue' | 'returnRate' | 'name';
type InsightKey = 'holdings' | 'daily' | 'profit';
type DailySortKey = 'dailyProfit' | 'dailyChange' | 'marketValue' | 'name';
type ProfitSortKey = 'profit' | 'returnRate' | 'marketValue' | 'name';
type SortDirection = 'asc' | 'desc';
type SortState<Key extends string> = { key: Key; direction: SortDirection };

const sortOptions: Array<{ key: SortKey; label: string; defaultDirection: SortDirection }> = [
  { key: 'marketValue', label: '按市值', defaultDirection: 'desc' },
  { key: 'returnRate', label: '按收益率', defaultDirection: 'desc' },
  { key: 'name', label: '按名称', defaultDirection: 'asc' },
];

const dailySortOptions: Array<{ key: DailySortKey; label: string; defaultDirection: SortDirection }> = [
  { key: 'dailyProfit', label: '按收益', defaultDirection: 'asc' },
  { key: 'dailyChange', label: '按涨跌率', defaultDirection: 'asc' },
  { key: 'marketValue', label: '按市值', defaultDirection: 'desc' },
  { key: 'name', label: '按名称', defaultDirection: 'asc' },
];

const profitSortOptions: Array<{ key: ProfitSortKey; label: string; defaultDirection: SortDirection }> = [
  { key: 'profit', label: '按盈亏', defaultDirection: 'asc' },
  { key: 'returnRate', label: '按收益率', defaultDirection: 'asc' },
  { key: 'marketValue', label: '按市值', defaultDirection: 'desc' },
  { key: 'name', label: '按名称', defaultDirection: 'asc' },
];

function applyDirection(value: number, direction: SortDirection) {
  return direction === 'asc' ? value : -value;
}

function nextSortState<Key extends string>(
  current: SortState<Key>,
  key: Key,
  defaultDirection: SortDirection,
): SortState<Key> {
  if (current.key !== key) return { key, direction: defaultDirection };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

function sortDirectionLabel(direction: SortDirection) {
  return direction === 'asc' ? '正序' : '倒序';
}

function sortButtonLabel(label: string, isActive: boolean, direction: SortDirection, defaultDirection: SortDirection) {
  const currentDirection = isActive ? direction : defaultDirection;
  const nextDirection = isActive && direction === 'asc' ? '倒序' : '正序';
  return `${label}，${isActive ? `当前${sortDirectionLabel(direction)}` : `默认${sortDirectionLabel(defaultDirection)}`}，点击${isActive ? `切换为${nextDirection}` : `按${sortDirectionLabel(currentDirection)}排序`}`;
}

function sortArrows(isActive: boolean, direction: SortDirection) {
  return (
    <span className="yb-sort-arrows" aria-hidden="true">
      <span className={isActive && direction === 'asc' ? 'yb-sort-arrow is-selected' : 'yb-sort-arrow'}>↑</span>
      <span className={isActive && direction === 'desc' ? 'yb-sort-arrow is-selected' : 'yb-sort-arrow'}>↓</span>
    </span>
  );
}

function sortItems(items: PortfolioItem[], sort: SortState<SortKey>) {
  const next = [...items];
  const { key, direction } = sort;
  if (key === 'marketValue') return next.sort((a, b) => applyDirection(a.marketValue - b.marketValue, direction));
  if (key === 'returnRate') return next.sort((a, b) => applyDirection(a.returnRate - b.returnRate, direction));
  return next.sort((a, b) => applyDirection(a.fundName.localeCompare(b.fundName, 'zh-Hans-CN'), direction));
}

function sortDailyItems(items: PortfolioItem[], sort: SortState<DailySortKey>) {
  const next = [...items];
  const { key, direction } = sort;
  if (key === 'dailyProfit') return next.sort((a, b) => applyDirection(a.estimatedDailyProfit - b.estimatedDailyProfit, direction));
  if (key === 'dailyChange') return next.sort((a, b) => applyDirection((a.quote?.dailyChangePercent ?? -Infinity) - (b.quote?.dailyChangePercent ?? -Infinity), direction));
  if (key === 'marketValue') return next.sort((a, b) => applyDirection(a.marketValue - b.marketValue, direction));
  return next.sort((a, b) => applyDirection(a.fundName.localeCompare(b.fundName, 'zh-Hans-CN'), direction));
}

function sortProfitItems(items: PortfolioItem[], sort: SortState<ProfitSortKey>) {
  const next = [...items];
  const { key, direction } = sort;
  if (key === 'profit') return next.sort((a, b) => applyDirection(a.profit - b.profit, direction));
  if (key === 'returnRate') return next.sort((a, b) => applyDirection(a.returnRate - b.returnRate, direction));
  if (key === 'marketValue') return next.sort((a, b) => applyDirection(a.marketValue - b.marketValue, direction));
  return next.sort((a, b) => applyDirection(a.fundName.localeCompare(b.fundName, 'zh-Hans-CN'), direction));
}

function toneClass(value?: number) {
  if (value === undefined) return 'yb-tone-muted';
  return value >= 0 ? 'yb-tone-up' : 'yb-tone-down';
}

function signedMoney(value: number) {
  return `${value >= 0 ? '+' : ''}${money.format(value)}`;
}

function dailyProfitClass(value: number, available: boolean) {
  if (!available) return 'yb-tone-muted';
  return value >= 0 ? 'profit-up' : 'profit-down';
}

function dailyProfitText(value: number, available: boolean) {
  return available ? signedMoney(value) : '--';
}

function dailyProfitTitle(summary: Pick<PortfolioSummary, 'dailyProfitIsCurrent'>) {
  return summary.dailyProfitIsCurrent ? '今日估算收益' : '最近估算收益';
}

function dailyProfitMeta(summary: Pick<PortfolioSummary, 'dailyProfitAvailable' | 'dailyProfitDate' | 'dailyProfitIsCurrent'>) {
  if (!summary.dailyProfitAvailable) return '暂无可用日涨跌行情';
  const date = summary.dailyProfitDate ?? '最近行情日';
  return summary.dailyProfitIsCurrent ? `收益日期 ${date}` : `收益日期 ${date} · 非交易日沿用`;
}

// 持仓组成里的标的既可能是股票，也可能是基金（FOF/联接），逐源查找并在失败时自动重试。
async function fetchQuoteWithRetry(code: string, attempts = 3): Promise<FundQuote | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const quote = await api.getFund(code);
      if (quote) return quote;
    } catch {
      // 单次失败后退避重试，覆盖上游限流或临时不可用。
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  return null;
}

function assetTypeLabel(quote: FundQuote) {
  if (quote.assetType === 'stock') return '股票';
  if (quote.assetType === 'index') return '指数';
  return '基金';
}

export function PortfolioPanel({
  summary,
  watchlist,
  benchmarkHistory = [],
  quotesRefreshing = false,
  quotesUpdatedAt,
  onRefreshQuotes,
  onRemoveHolding,
  onUpdateHolding,
  onEditIdentity,
  onAddManualHolding,
}: {
  summary: PortfolioSummary;
  watchlist: WatchItem[];
  benchmarkHistory?: FundHistoryPoint[];
  quotesRefreshing?: boolean;
  quotesUpdatedAt?: string;
  onRefreshQuotes?: () => void | Promise<void>;
  onRemoveHolding: (id: string) => void;
  onUpdateHolding: (id: string, patch: { recordedMarketValue: number; costAmount: number }) => void;
  onEditIdentity?: (id: string, patch: { fundCode: string; fundName: string }) => void;
  onAddManualHolding?: (fund: FundQuote, patch: { recordedMarketValue: number; costAmount: number }) => void;
}) {
  const positive = summary.totalProfit >= 0;
  const [holdingSort, setHoldingSort] = useState<SortState<SortKey>>({ key: 'marketValue', direction: 'desc' });
  const [dailySort, setDailySort] = useState<SortState<DailySortKey>>({ key: 'dailyProfit', direction: 'asc' });
  const [profitSort, setProfitSort] = useState<SortState<ProfitSortKey>>({ key: 'profit', direction: 'asc' });
  const [activeInsight, setActiveInsight] = useState<InsightKey>('holdings');
  const [editingId, setEditingId] = useState<string>();
  const [editValue, setEditValue] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string>();
  const [detailId, setDetailId] = useState<string>();
  const [historyMap, setHistoryMap] = useState<Record<string, FundHistoryPoint[]>>({});
  const [holdingsMap, setHoldingsMap] = useState<Record<string, FundHoldings>>({});
  const [intradayCode, setIntradayCode] = useState<string>();
  const [intradayMap, setIntradayMap] = useState<Record<string, FundIntradayPoint[]>>({});
  const [stockId, setStockId] = useState<string>();
  const [stockQuoteMap, setStockQuoteMap] = useState<Record<string, FundQuote | null>>({});
  const [stockHistoryMap, setStockHistoryMap] = useState<Record<string, FundHistoryPoint[]>>({});
  const [analysisTarget, setAnalysisTarget] = useState<{ code: string; name: string }>();
  const [analysisLoadingCode, setAnalysisLoadingCode] = useState<string>();
  const [analysisError, setAnalysisError] = useState('');
  const [analysisMap, setAnalysisMap] = useState<Record<string, FundAnalysisResponse>>({});
  const [analysisStatusMap, setAnalysisStatusMap] = useState<Record<string, string>>({});
  const [analysisDraftMap, setAnalysisDraftMap] = useState<Record<string, string>>({});
  const [manualQuery, setManualQuery] = useState('');
  const [manualMarketValue, setManualMarketValue] = useState('');
  const [manualCost, setManualCost] = useState('');
  const [manualFund, setManualFund] = useState<FundQuote>();
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const historyLoadingRef = useRef<Set<string>>(new Set());
  const sortedItems = useMemo(() => sortItems(summary.items, holdingSort), [holdingSort, summary.items]);
  const dailyProfitItems = useMemo(
    () => sortDailyItems(summary.items, dailySort),
    [dailySort, summary.items],
  );
  const currentDailyProfitItems = dailyProfitItems.filter((item) => item.dailyProfitAvailable && item.dailyProfitDate === summary.dailyProfitDate);
  const staleDailyItems = dailyProfitItems.length - currentDailyProfitItems.length;
  const cumulativeProfitItems = useMemo(() => sortProfitItems(summary.items, profitSort), [profitSort, summary.items]);
  const dailyLosers = currentDailyProfitItems.filter((item) => item.estimatedDailyProfit < 0);
  const dailyGainers = currentDailyProfitItems.filter((item) => item.estimatedDailyProfit > 0);
  const quoteRefreshLabel = quotesUpdatedAt ? `最近刷新 ${timeFormat.format(new Date(quotesUpdatedAt))}` : '等待行情刷新';
  const dailyMeta = dailyProfitMeta(summary);

  const expandedItem = useMemo(() => summary.items.find((item) => item.id === expandedId), [summary.items, expandedId]);
  const expandedCode = expandedItem && /^\d{6}$/.test(expandedItem.fundCode) ? expandedItem.fundCode : undefined;
  const expandedHistory = expandedCode ? historyMap[expandedCode] ?? [] : [];
  const expandedLoading = Boolean(expandedCode) && historyMap[expandedCode ?? ''] === undefined;

  const detailItem = useMemo(() => summary.items.find((item) => item.id === detailId), [summary.items, detailId]);
  const detailCode = detailItem && /^\d{6}$/.test(detailItem.fundCode) ? detailItem.fundCode : undefined;
  const detailHoldings = detailCode ? holdingsMap[detailCode] : undefined;
  const detailHoldingsLoading = Boolean(detailCode) && holdingsMap[detailCode ?? ''] === undefined;
  const selectedAnalysis = analysisTarget ? analysisMap[analysisTarget.code] : undefined;
  useEffect(() => {
    if (!intradayCode || intradayMap[intradayCode] !== undefined) return;
    let cancelled = false;
    queueMicrotask(() => {
      const cached = api.getCachedFundIntraday(intradayCode);
      if (!cancelled && cached) setIntradayMap((current) => (current[intradayCode] ? current : { ...current, [intradayCode]: cached }));
    });
    api.getFundIntraday(intradayCode)
      .then((points) => {
        if (!cancelled) setIntradayMap((current) => ({ ...current, [intradayCode]: points }));
      })
      .catch(() => {
        if (!cancelled) setIntradayMap((current) => ({ ...current, [intradayCode]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [intradayCode, intradayMap]);

  useEffect(() => {
    if (!expandedCode || historyLoadingRef.current.has(expandedCode)) return;
    if (historyMap[expandedCode] !== undefined && historyMap[expandedCode].length > 28) return;
    historyLoadingRef.current.add(expandedCode);
    const code = expandedCode;
    queueMicrotask(() => {
      const cached = api.getCachedFundHistory(code, 'all') ?? api.getCachedFundHistory(code, '1m');
      if (cached?.length) setHistoryMap((current) => (current[code]?.length ? current : { ...current, [code]: cached }));
    });
    // 渐进式加载：先取 1 个月数据快速出图，再后台补全全量历史，降低首屏延迟。
    api.getFundHistory(code, '1m')
      .then((points) => {
        if (points.length > 0) setHistoryMap((current) => (current[code]?.length ? current : { ...current, [code]: points }));
      })
      .catch(() => undefined)
      .finally(() => {
        api.getFundHistory(code, 'all')
          .then((points) => {
            if (points.length > 0) setHistoryMap((current) => ({ ...current, [code]: points }));
            else setHistoryMap((current) => (current[code] ? current : { ...current, [code]: [] }));
          })
          .catch(() => {
            setHistoryMap((current) => (current[code] ? current : { ...current, [code]: [] }));
          })
          .finally(() => {
            historyLoadingRef.current.delete(code);
          });
      });
  }, [expandedCode, historyMap]);

  useEffect(() => {
    if (!detailCode || holdingsMap[detailCode] !== undefined) return;
    let cancelled = false;
    queueMicrotask(() => {
      const cached = api.getCachedFundHoldings(detailCode);
      if (!cancelled && cached) setHoldingsMap((current) => (current[detailCode] ? current : { ...current, [detailCode]: cached }));
    });
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

  async function openHoldingAnalysis(item: PortfolioItem) {
    if (!/^\d{6}$/.test(item.fundCode)) return;
    setAnalysisTarget({ code: item.fundCode, name: item.fundName });
    setAnalysisError('');
    if (analysisMap[item.fundCode]) return;
    setAnalysisLoadingCode(item.fundCode);
    setAnalysisStatusMap((current) => ({ ...current, [item.fundCode]: '正在准备分析上下文...' }));
    setAnalysisDraftMap((current) => ({ ...current, [item.fundCode]: '' }));
    try {
      const analysis = await api.analyzeFundStream(item.fundCode, {
        onStatus: (message) => setAnalysisStatusMap((current) => ({ ...current, [item.fundCode]: message })),
        onDelta: (delta) => setAnalysisDraftMap((current) => ({ ...current, [item.fundCode]: `${current[item.fundCode] ?? ''}${delta}` })),
      });
      setAnalysisMap((current) => ({ ...current, [item.fundCode]: analysis }));
    } catch (caught) {
      setAnalysisError(caught instanceof Error ? caught.message : '智能分析暂不可用');
    } finally {
      setAnalysisLoadingCode((current) => (current === item.fundCode ? undefined : current));
    }
  }

  useEffect(() => {
    if (!stockId || stockQuoteMap[stockId] !== undefined) return;
    let cancelled = false;
    fetchQuoteWithRetry(stockId)
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

  useEffect(() => {
    if (!stockId || !/^\d{6}$/.test(stockId) || stockHistoryMap[stockId] !== undefined) return;
    let cancelled = false;
    queueMicrotask(() => {
      const cached = api.getCachedFundHistory(stockId, 'all');
      if (!cancelled && cached?.length) setStockHistoryMap((current) => (current[stockId] ? current : { ...current, [stockId]: cached }));
    });
    api.getFundHistory(stockId, 'all')
      .then((points) => {
        if (!cancelled) setStockHistoryMap((current) => ({ ...current, [stockId]: points }));
      })
      .catch(() => {
        if (!cancelled) setStockHistoryMap((current) => ({ ...current, [stockId]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [stockId, stockHistoryMap]);

  function toggleStock(code: string) {
    setStockId((current) => (current === code ? undefined : code));
  }

  function retryStock(code: string) {
    // 清除上次查找结果让 effect 重新触发查找与重试。
    setStockQuoteMap((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
    setStockId(code);
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

  async function lookupManualHolding() {
    const normalizedQuery = manualQuery.trim();
    setManualError('');
    setManualFund(undefined);
    if (!normalizedQuery) {
      setManualError('请先填写基金代码或名称');
      return;
    }
    setManualLoading(true);
    try {
      const fund = /^\d{6}$/.test(normalizedQuery)
        ? await api.getFund(normalizedQuery)
        : (await api.searchFunds(normalizedQuery))[0];
      if (!fund) {
        setManualError('没有找到匹配的基金，请换代码或名称重试');
        return;
      }
      setManualFund(fund);
      if (!manualCost.trim() && manualMarketValue.trim()) setManualCost(manualMarketValue.trim());
    } catch (caught) {
      setManualError(caught instanceof Error ? caught.message : '基金信息拉取失败');
    } finally {
      setManualLoading(false);
    }
  }

  function confirmManualHolding() {
    if (!manualFund) {
      setManualError('请先拉取基金信息');
      return;
    }
    const recordedMarketValue = Number(manualMarketValue);
    const costAmount = Number(manualCost || manualMarketValue);
    if (!Number.isFinite(recordedMarketValue) || recordedMarketValue <= 0 || !Number.isFinite(costAmount) || costAmount < 0) {
      setManualError('请填写有效的持有金额和成本金额');
      return;
    }
    onAddManualHolding?.(manualFund, {
      recordedMarketValue: Number(recordedMarketValue.toFixed(2)),
      costAmount: Number(costAmount.toFixed(2)),
    });
    setManualQuery('');
    setManualMarketValue('');
    setManualCost('');
    setManualFund(undefined);
    setManualError('');
    setManualFormOpen(false);
  }

  const manualToggle = onAddManualHolding && (
    <Button
      variant={manualFormOpen ? 'outline' : 'secondary'}
      size="sm"
      aria-expanded={manualFormOpen}
      aria-controls="manual-holding-panel"
      onClick={() => {
        setManualFormOpen((current) => !current);
        setManualError('');
      }}
    >
      {manualFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {manualFormOpen ? '收起' : '增加'}
    </Button>
  );

  const manualHoldingPanel = onAddManualHolding && manualFormOpen && (
    <section className="yb-manual-holding-panel" id="manual-holding-panel" aria-label="手动新增持仓">
      <div>
        <strong>手动新增持仓</strong>
        <span>输入 6 位代码或基金名称，先拉取最新净值，再写入账户持仓。</span>
      </div>
      <div className="yb-manual-holding-form">
        <label>
          <span>代码或名称</span>
          <input
            type="text"
            value={manualQuery}
            onChange={(event) => setManualQuery(event.target.value)}
            placeholder="例如 000001 或 华夏成长"
            aria-label="手动新增持仓代码或名称"
          />
        </label>
        <label>
          <span>持有金额</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={manualMarketValue}
            onChange={(event) => setManualMarketValue(event.target.value)}
            placeholder="当前持有市值"
            aria-label="手动新增持仓持有金额"
          />
        </label>
        <label>
          <span>成本金额</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={manualCost}
            onChange={(event) => setManualCost(event.target.value)}
            placeholder="不填默认等于持有金额"
            aria-label="手动新增持仓成本金额"
          />
        </label>
        <Button variant="secondary" size="sm" onClick={() => void lookupManualHolding()} disabled={manualLoading}>
          {manualLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          拉取信息
        </Button>
        <Button variant="default" size="sm" onClick={confirmManualHolding} disabled={!manualFund}>
          <Check className="h-4 w-4" />更新持仓
        </Button>
      </div>
      {manualFund && (
        <div className="yb-manual-holding-preview" data-testid="manual-holding-preview">
          <span>{assetTypeLabel(manualFund)} · {manualFund.code}</span>
          <strong>{manualFund.name}</strong>
          <em>最新净值 {manualFund.netValue.toFixed(4)} · {manualFund.quoteDate}</em>
        </div>
      )}
      {manualError && <p className="yb-empty-copy yb-manual-holding-error">{manualError}</p>}
    </section>
  );

  return (
    <Card id="portfolio" className="lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>我的持仓分析</CardTitle>
        </div>
      </CardHeader>
      <div className="yb-hero-grid">
        <button
          type="button"
          className={`yb-metric yb-metric-primary yb-metric-card ${activeInsight === 'holdings' ? 'is-active' : ''}`}
          aria-pressed={activeInsight === 'holdings'}
          onClick={() => setActiveInsight('holdings')}
        >
          <span>持仓</span>
          <strong>{money.format(summary.totalMarketValue)}</strong>
          <small>实时覆盖 {summary.liveQuoteRatio.toFixed(0)}%</small>
        </button>
        <div className="yb-metric yb-metric-daily">
          <button
            type="button"
            className="yb-metric-trigger"
            aria-pressed={activeInsight === 'daily'}
            aria-controls="portfolio-insight-detail"
            onClick={() => setActiveInsight('daily')}
          >
            <span>{dailyProfitTitle(summary)}</span>
            <strong className={dailyProfitClass(summary.estimatedDailyProfit, summary.dailyProfitAvailable)}>{dailyProfitText(summary.estimatedDailyProfit, summary.dailyProfitAvailable)}</strong>
            <small>{dailyMeta}</small>
          </button>
          <div className="yb-metric-refresh">
            <small>{quoteRefreshLabel} · 每 1 分钟自动刷新</small>
            <button type="button" onClick={() => void onRefreshQuotes?.()} disabled={quotesRefreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${quotesRefreshing ? 'animate-spin' : ''}`} />
              {quotesRefreshing ? '刷新中' : '手动刷新'}
            </button>
          </div>
        </div>
        <button
          type="button"
          className={`yb-metric yb-metric-card ${activeInsight === 'profit' ? 'is-active' : ''}`}
          aria-pressed={activeInsight === 'profit'}
          aria-controls="portfolio-insight-detail"
          onClick={() => setActiveInsight('profit')}
        >
          <span>累计盈亏</span>
          <strong className={positive ? 'profit-up' : 'profit-down'}>{money.format(summary.totalProfit)}</strong>
          <small>{summary.totalReturnRate.toFixed(2)}% · 投入 {money.format(summary.totalCost)}</small>
        </button>
      </div>
      {activeInsight !== 'holdings' && (
      <section className="yb-daily-profit-detail" id="portfolio-insight-detail" data-testid="portfolio-insight-detail">
        {activeInsight === 'daily' && (
          <>
          <div className="yb-holding-toolbar yb-insight-toolbar">
            <div>
              <strong>{summary.dailyProfitIsCurrent ? '今日收益拆解' : '最近收益拆解'}</strong>
              <span>{summary.dailyProfitAvailable ? `${dailyMeta} · 亏损 ${dailyLosers.length} 只 · 盈利 ${dailyGainers.length} 只 · 待更新 ${staleDailyItems} 只 · ${quoteRefreshLabel}` : `暂无可用日涨跌行情 · ${quoteRefreshLabel}`}</span>
            </div>
            <div className="yb-sort-group" role="group" aria-label="今日收益排序">
              {dailySortOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={option.key === dailySort.key ? 'yb-sort-chip is-active' : 'yb-sort-chip'}
                  aria-label={sortButtonLabel(option.label, option.key === dailySort.key, dailySort.direction, option.defaultDirection)}
                  aria-pressed={option.key === dailySort.key}
                  onClick={() => setDailySort((current) => nextSortState(current, option.key, option.defaultDirection))}
                >
                  <span>{option.label}</span>
                  {sortArrows(option.key === dailySort.key, dailySort.direction)}
                </button>
              ))}
            </div>
          </div>
          {dailyProfitItems.length === 0 ? (
            <p className="yb-empty-copy">暂无可用日涨跌行情。刷新行情或补齐基金代码后，将按最近行情日展示单只持仓收益贡献。</p>
          ) : (
            <>
            <div className="yb-daily-profit-list">
              {dailyProfitItems.map((item) => {
                const includedInDailyTotal = item.dailyProfitAvailable && item.dailyProfitDate === summary.dailyProfitDate;
                return (
                <div key={item.id} className={includedInDailyTotal ? 'yb-daily-profit-item' : 'yb-daily-profit-item is-stale'}>
                  <article
                    className={intradayCode === item.fundCode ? 'yb-daily-profit-row is-active' : 'yb-daily-profit-row'}
                    role="button"
                    tabIndex={0}
                    aria-expanded={intradayCode === item.fundCode}
                    onClick={() => setIntradayCode((current) => (current === item.fundCode ? undefined : item.fundCode))}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setIntradayCode((current) => (current === item.fundCode ? undefined : item.fundCode));
                    }}
                  >
                    <div>
                      <strong>{item.fundName}</strong>
                      <span className="yb-value-line">
                        <em>{item.fundCode}</em>
                        <em className={includedInDailyTotal ? toneClass(item.quote?.dailyChangePercent) : 'yb-tone-muted'}>
                          {includedInDailyTotal && item.quote?.dailyChangePercent !== undefined
                            ? `${item.dailyProfitDate} 涨跌 ${item.quote.dailyChangePercent >= 0 ? '+' : ''}${item.quote.dailyChangePercent.toFixed(2)}%`
                            : item.dailyProfitDate ? `${item.dailyProfitDate} 旧行情 · 不计入合计` : '今日行情待更新'}
                        </em>
                        <em>市值 {money.format(item.marketValue)}</em>
                      </span>
                    </div>
                    <strong className={`yb-daily-profit-amount ${dailyProfitClass(item.estimatedDailyProfit, includedInDailyTotal)}`}>
                      {dailyProfitText(item.estimatedDailyProfit, includedInDailyTotal)}
                    </strong>
                  </article>
                  {intradayCode === item.fundCode && (
                    <IntradayTrendChart
                      points={intradayMap[item.fundCode] ?? []}
                      title={`${item.fundName} 当日行情走势`}
                      dailyChangePercent={item.quote?.dailyChangePercent}
                      estimateTime={item.quote?.estimateTime}
                      loading={intradayMap[item.fundCode] === undefined}
                    />
                  )}
                </div>
                );
              })}
            </div>
            </>
          )}
          </>
        )}
        {activeInsight === 'profit' && (
          <>
          <div className="yb-holding-toolbar yb-insight-toolbar">
            <div>
              <strong>累计盈亏拆解</strong>
              <span className="yb-value-line">
                <em>投入 {money.format(summary.totalCost)}</em>
                <em className={toneClass(summary.totalProfit)}>盈亏 {signedMoney(summary.totalProfit)}</em>
                <em className={toneClass(summary.totalReturnRate)}>收益率 {summary.totalReturnRate.toFixed(2)}%</em>
              </span>
            </div>
            <div className="yb-sort-group" role="group" aria-label="累计盈亏排序">
              {profitSortOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={option.key === profitSort.key ? 'yb-sort-chip is-active' : 'yb-sort-chip'}
                  aria-label={sortButtonLabel(option.label, option.key === profitSort.key, profitSort.direction, option.defaultDirection)}
                  aria-pressed={option.key === profitSort.key}
                  onClick={() => setProfitSort((current) => nextSortState(current, option.key, option.defaultDirection))}
                >
                  <span>{option.label}</span>
                  {sortArrows(option.key === profitSort.key, profitSort.direction)}
                </button>
              ))}
            </div>
          </div>
          {cumulativeProfitItems.length === 0 ? (
            <p className="yb-empty-copy">暂无可拆解的累计盈亏，添加持仓后会按单只基金展示成本、当前市值和累计收益。</p>
          ) : (
            <div className="yb-daily-profit-list">
              {cumulativeProfitItems.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.fundName}</strong>
                    <span className="yb-value-line">
                      <em>成本 {money.format(item.costAmount)}</em>
                      <em>当前 {money.format(item.marketValue)}</em>
                      <em className={toneClass(item.returnRate)}>收益率 {item.returnRate.toFixed(2)}%</em>
                    </span>
                  </div>
                  <strong className={item.profit >= 0 ? 'profit-up' : 'profit-down'}>
                    {signedMoney(item.profit)}
                  </strong>
                </article>
              ))}
            </div>
          )}
          </>
        )}
      </section>
      )}
      {activeInsight === 'holdings' && (summary.items.length === 0 ? (
        <section className="yb-daily-profit-detail yb-holdings-panel" data-testid="portfolio-holdings-detail">
          <div className="yb-holding-toolbar">
            <span>持仓明细</span>
            {manualToggle}
          </div>
          {manualHoldingPanel}
          <div className="mt-3 rounded-[1.7rem] border border-dashed border-white/15 p-8 text-center font-semibold text-white/55">还没有持仓。搜索基金后点击“加入持仓”即可开始分析。也可以点击“增加”手动录入。</div>
        </section>
      ) : (
        <section className="yb-daily-profit-detail yb-holdings-panel" data-testid="portfolio-holdings-detail">
          <div className="yb-holding-toolbar">
            <span>持仓明细</span>
            <div className="yb-holding-toolbar-actions">
              <div className="yb-sort-group" role="group" aria-label="持仓排序">
                {sortOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={option.key === holdingSort.key ? 'yb-sort-chip is-active' : 'yb-sort-chip'}
                    aria-label={sortButtonLabel(option.label, option.key === holdingSort.key, holdingSort.direction, option.defaultDirection)}
                    aria-pressed={option.key === holdingSort.key}
                    onClick={() => setHoldingSort((current) => nextSortState(current, option.key, option.defaultDirection))}
                  >
                    <span>{option.label}</span>
                    {sortArrows(option.key === holdingSort.key, holdingSort.direction)}
                  </button>
                ))}
              </div>
              {manualToggle}
            </div>
          </div>
          {manualHoldingPanel}
          <div className="mt-3 grid gap-3">
            {sortedItems.map((item) => {
              const hasCode = /^\d{6}$/.test(item.fundCode);
              const isExpanded = expandedId === item.id;
              const isDetail = detailId === item.id;
              const detailStocks = detailHoldings?.stocks ?? [];
              const disclosedStockWeight = detailStocks.reduce((sum, stock) => sum + stock.weight, 0);
              const topTenWeight = detailStocks.reduce((sum, stock, index) => sum + ((stock.isTopTen ?? (stock.rank ? stock.rank <= 10 : index < 10)) ? stock.weight : 0), 0);
              const disclosedBeyondTopTenWeight = Math.max(0, disclosedStockWeight - topTenWeight);
              const undisclosedWeight = Math.max(0, 100 - disclosedStockWeight);
              return (
              <div key={item.id} className="yb-holding-wrap">
              <article className="yb-holding-row">
                <div>
                  <strong className="yb-holding-name">{item.fundName}</strong>
                  <small className="yb-holding-meta">
                    {hasCode ? item.fundCode : '自填持仓'}{item.shares ? ` · 份额 ${item.shares}` : ''}
                    {hasCode && item.codeSource === 'auto' && <em className="yb-code-tag yb-code-tag-auto" title="按名称自动补全的代码">自动补全</em>}
                    {!hasCode && <em className="yb-code-tag yb-code-tag-pending" title="未匹配到 6 位代码，编辑可手动补全">待完善</em>}
                  </small>
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
                    <small className="yb-holding-performance">
                      <span className={toneClass(item.profit)}>{signedMoney(item.profit)}</span>
                      <span className={toneClass(item.returnRate)}>{item.returnRate.toFixed(2)}%</span>
                    </small>
                  </div>
                )}
                <div>
                  <span className="yb-holding-weight"><PieChart className="mr-1 inline h-4 w-4" />{item.weight.toFixed(1)}%</span>
                  <small className="yb-holding-meta yb-value-line">
                    {item.quote && (
                      <>
                        <em>{item.quote.quoteDate}</em>
                        {item.dailyProfitAvailable && <em className={toneClass(item.estimatedDailyProfit)}>{item.dailyProfitIsCurrent ? '今日' : item.dailyProfitDate} {signedMoney(item.estimatedDailyProfit)}</em>}
                      </>
                    )}
                  </small>
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
                      <Button variant="ghost" size="sm" aria-label={`${item.fundName} 智能分析`} onClick={() => void openHoldingAnalysis(item)}>
                        {analysisLoadingCode === item.fundCode ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                        智能分析
                      </Button>
                    )}
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
                  <div><span>基金代码</span><strong>{hasCode ? `${item.fundCode}${item.codeSource === 'auto' ? '（自动补全）' : item.codeSource === 'manual' ? '（手动确认）' : ''}` : '待补全'}</strong></div>
                  <div><span>最新净值</span><strong>{item.quote?.netValue ? item.quote.netValue.toFixed(4) : '自填估值'}</strong></div>
                  <div><span>{item.dailyProfitDate ? `${item.dailyProfitDate} 涨跌` : '日涨跌'}</span><strong className={item.dailyProfitAvailable && (item.quote?.dailyChangePercent ?? 0) < 0 ? 'yb-holding-profit-down' : item.dailyProfitAvailable ? 'yb-holding-profit-up' : 'yb-tone-muted'}>{item.dailyProfitAvailable && item.quote?.dailyChangePercent !== undefined ? `${item.quote.dailyChangePercent >= 0 ? '+' : ''}${item.quote.dailyChangePercent.toFixed(2)}%` : '--'}</strong></div>
                  <div><span>持有市值</span><strong>{money.format(item.marketValue)}</strong></div>
                  <div><span>持仓成本</span><strong>{money.format(item.costAmount)}</strong></div>
                  <div><span>累计盈亏</span><strong className={item.profit >= 0 ? 'yb-holding-profit-up' : 'yb-holding-profit-down'}>{money.format(item.profit)} / {item.returnRate.toFixed(2)}%</strong></div>
                  <div><span>组合权重</span><strong>{item.weight.toFixed(1)}%</strong></div>
                  <div><span>账本来源</span><strong>{item.accountName ?? '默认账本'}</strong></div>
                  {item.holdingDays !== undefined && <div><span>持有天数</span><strong>{item.holdingDays} 天</strong></div>}
                </div>
                {hasCode && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => void openHoldingAnalysis(item)}>
                      {analysisLoadingCode === item.fundCode ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                      智能分析
                    </Button>
                  </div>
                )}
                {hasCode && (
                  <div className="fund-holdings" data-testid="holding-positions">
                    <div className="fund-holdings-head">
                      <span><PieChart className="h-4 w-4" /> 已披露股票持仓 / 占净值比</span>
                      {detailHoldings?.reportDate && <small>报告期 {detailHoldings.reportDate}</small>}
                    </div>
                    {detailHoldingsLoading ? (
                      <p className="yb-empty-copy">正在加载持仓组成…</p>
                    ) : detailStocks.length === 0 ? (
                      <p className="yb-empty-copy">暂无该基金的持仓组成数据（指数/货币型基金或未披露）。</p>
                    ) : (
                      <>
                      <p className="fund-holdings-note">
                        已披露股票合计 {fixedPercent(disclosedStockWeight)}%，其中前十大 {fixedPercent(topTenWeight)}%、前十大以外已披露 {fixedPercent(disclosedBeyondTopTenWeight)}%；未逐项披露或非股票资产约 {fixedPercent(undisclosedWeight)}%。
                      </p>
                      <ul>
                        {detailStocks.map((stock, index) => {
                          const isStockOpen = stockId === stock.code;
                          const stockQuote = stockQuoteMap[stock.code];
                          const stockLoading = isStockOpen && stockQuote === undefined;
                          return (
                          <li key={stock.code} className="fund-holdings-item">
                            <button type="button" aria-expanded={isStockOpen} aria-label={`查看 ${stock.name} 详情`} onClick={() => toggleStock(stock.code)}>
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
                              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isStockOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isStockOpen && (
                              <>
                              <div className="fund-holdings-detail" data-testid="holding-stock-detail">
                                {stockLoading ? (
                                  <p className="yb-empty-copy">正在查找 {stock.name} 行情…</p>
                                ) : !stockQuote ? (
                                  <div className="fund-holdings-retry">
                                    <p className="yb-empty-copy">多次查找仍未获取到 {stock.name} 的行情。</p>
                                    <Button variant="secondary" size="sm" onClick={() => retryStock(stock.code)}><Repeat2 className="h-4 w-4" />重新查找</Button>
                                  </div>
                                ) : (
                                  <>
                                    <div><span>类型</span><strong>{assetTypeLabel(stockQuote)}{stockQuote.market ? ` · ${stockQuote.market}` : ''}</strong></div>
                                    <div><span>{stockQuote.assetType === 'stock' ? '最新价' : '净值'}</span><strong>{stockQuote.netValue?.toFixed(stockQuote.assetType === 'stock' ? 2 : 4) ?? '--'}</strong></div>
                                    <div><span>日涨跌</span><strong className={(stockQuote.dailyChangePercent ?? 0) >= 0 ? 'yb-holding-profit-up' : 'yb-holding-profit-down'}>{stockQuote.dailyChangePercent !== undefined ? `${stockQuote.dailyChangePercent >= 0 ? '+' : ''}${stockQuote.dailyChangePercent.toFixed(2)}%` : '--'}</strong></div>
                                    {stockQuote.open !== undefined && <div><span>今开</span><strong>{stockQuote.open.toFixed(2)}</strong></div>}
                                    {stockQuote.previousClose !== undefined && <div><span>昨收</span><strong>{stockQuote.previousClose.toFixed(2)}</strong></div>}
                                    {stockQuote.high !== undefined && stockQuote.low !== undefined && <div><span>最高 / 最低</span><strong>{stockQuote.high.toFixed(2)} / {stockQuote.low.toFixed(2)}</strong></div>}
                                    <div><span>占基金净值</span><strong>{stock.weight.toFixed(2)}%</strong></div>
                                    <div><span>数据来源</span><strong>{stockQuote.source}</strong></div>
                                  </>
                                )}
                              </div>
                              {stockQuote && /^\d{6}$/.test(stock.code) && (
                                <FundTrendChart
                                  history={stockHistoryMap[stock.code] ?? []}
                                  benchmarkHistory={benchmarkHistory}
                                  loading={stockHistoryMap[stock.code] === undefined}
                                  testId="holding-stock-chart"
                                  height={320}
                                  kicker="Equity Signal Matrix"
                                  title={`${stock.name} 价格走势`}
                                  valueName="收盘价"
                                  valueAxisName="价格"
                                  emptyHint="暂无该标的的历史行情，稍后重试。"
                                />
                              )}
                              </>
                            )}
                          </li>
                          );
                        })}
                      </ul>
                      </>
                    )}
                  </div>
                )}
                </>
              )}
              {isExpanded && hasCode && (
                <FundTrendChart
                  history={expandedHistory}
                  benchmarkHistory={benchmarkHistory}
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
        </section>
      ))}
      <div className="mt-6 flex flex-wrap gap-2">
        <h3 className="mr-2 w-full text-lg font-black text-ink">自选基金</h3>
        {watchlist.length === 0 ? <p className="text-sm font-semibold text-ink/50">暂无自选基金。</p> : watchlist.map((item) => <Badge tone="slate" key={item.fundCode}>{item.fundName} {item.fundCode}</Badge>)}
      </div>
      <div className="yb-bottom-modules" data-testid="portfolio-bottom-modules">
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
      </div>
      {analysisTarget && (
        <FundAnalysisPanel
          target={analysisTarget}
          analysis={selectedAnalysis}
          loadingCode={analysisLoadingCode}
          streamingStatus={analysisTarget ? analysisStatusMap[analysisTarget.code] : undefined}
          streamingDraft={analysisTarget ? analysisDraftMap[analysisTarget.code] : undefined}
          error={analysisError}
          onClose={() => setAnalysisTarget(undefined)}
        />
      )}
    </Card>
  );
}

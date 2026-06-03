'use client';

import { Activity } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { FundHistoryPoint, IndexQuote } from '../types';
import { Badge } from './ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FundTrendChart } from './FundTrendChart';

export function MarketOverview({ indices, loading, error }: { indices: IndexQuote[]; loading: boolean; error?: string }) {
  const leadIndex = indices.find((index) => index.code === '000001.SH') ?? indices[0];
  const [activeCode, setActiveCode] = useState<string>();
  const [historyMap, setHistoryMap] = useState<Record<string, FundHistoryPoint[]>>({});

  const activeIndex = useMemo(
    () => indices.find((index) => index.code === activeCode) ?? leadIndex,
    [indices, activeCode, leadIndex],
  );
  const activeHistoryCode = activeIndex?.code;
  const history = activeHistoryCode ? historyMap[activeHistoryCode] ?? [] : [];
  const historyLoading = Boolean(activeHistoryCode) && historyMap[activeHistoryCode ?? ''] === undefined;

  useEffect(() => {
    if (!activeHistoryCode || historyMap[activeHistoryCode] !== undefined) return;
    let cancelled = false;
    api.getIndexHistory(activeHistoryCode, 'all')
      .then((points) => {
        if (!cancelled) setHistoryMap((current) => ({ ...current, [activeHistoryCode]: points }));
      })
      .catch(() => {
        if (!cancelled) setHistoryMap((current) => ({ ...current, [activeHistoryCode]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [activeHistoryCode, historyMap]);

  return (
    <Card id="markets" className="market-overview-card overflow-hidden">
      <CardHeader className="market-overview-head">
        <div>
          <Badge tone="blue" className="mb-2"><Activity className="h-3 w-3" /> Market</Badge>
          <CardTitle>四大指数行情</CardTitle>
          <CardDescription>默认显示上证指数，点击指数卡片切换下方走势图。</CardDescription>
        </div>
        <Badge tone="slate">{indices.length > 4 ? '多市场数据' : '公开数据'}</Badge>
      </CardHeader>
      {loading && <p className="text-sm font-semibold text-ink/50">正在加载市场数据…</p>}
      {error && <p className="rounded-3xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="index-switch-grid" data-testid="market-chart">
        {indices.map((index) => {
          const positive = index.changePercent >= 0;
          const isActive = activeIndex?.code === index.code;
          return (
            <button
              type="button"
              className={`index-switch-card ${isActive ? 'is-active' : ''}`}
              key={index.code}
              aria-pressed={isActive}
              onClick={() => setActiveCode(index.code)}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-extrabold text-[var(--text-strong)]">{index.name}</span>
                <span className={positive ? 'text-[var(--bull)]' : 'text-[var(--bear)]'}>{positive ? '▲' : '▼'}</span>
              </div>
              <strong className="block text-3xl font-black tracking-tight text-[var(--text-strong)]">{index.value.toFixed(2)}</strong>
              <em className={positive ? 'not-italic font-black text-[var(--bull)]' : 'not-italic font-black text-[var(--bear)]'}>
                {positive ? '+' : ''}{index.change.toFixed(2)} / {positive ? '+' : ''}{index.changePercent.toFixed(2)}%
              </em>
              <small className="mt-3 block text-xs font-semibold text-[var(--text-muted)]">{index.quoteTime}</small>
            </button>
          );
        })}
      </div>
      {activeIndex && (
        <FundTrendChart
          history={history}
          loading={historyLoading}
          testId="index-chart"
          kicker="Index Signal Matrix"
          title={`${activeIndex.name} 走势`}
          valueName="点位"
          valueAxisName="点位"
          emptyHint="暂无该指数的历史数据，稍后重试或选择其他指数。"
        />
      )}
    </Card>
  );
}

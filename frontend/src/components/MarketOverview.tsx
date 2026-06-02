'use client';

import { Activity } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import type { FundHistoryPoint, IndexQuote } from '../types';
import { Badge } from './ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FundTrendChart } from './FundTrendChart';

const BULL = '#ff5d52';
const BEAR = '#3fd6a0';

export function MarketOverview({ indices, loading, error }: { indices: IndexQuote[]; loading: boolean; error?: string }) {
  const leadIndex = indices[0];
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
    <Card id="markets" className="overflow-hidden">
      <CardHeader>
        <div>
          <Badge tone="blue" className="mb-2"><Activity className="h-3 w-3" /> Market</Badge>
          <CardTitle>全球市场雷达</CardTitle>
          <CardDescription>A股、港股、美股核心指数多源聚合，点击任意指数查看历史走势。</CardDescription>
        </div>
        <Badge tone="slate">{indices.length > 4 ? '多市场数据' : '公开数据'}</Badge>
      </CardHeader>
      {leadIndex && (
        <div className="mb-4 rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-[#0c2a22] to-[#0a1c2e] p-4 text-white">
          <small className="text-xs font-black uppercase tracking-[0.2em] text-[var(--mint)]">Market Pulse</small>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <strong className="block text-2xl font-black">{leadIndex.name}</strong>
              <span className="text-sm font-bold text-white/70">{leadIndex.quoteTime}</span>
            </div>
            <div className={leadIndex.changePercent >= 0 ? 'text-right text-[var(--bull)]' : 'text-right text-[var(--bear)]'}>
              <strong className="block text-3xl font-black tabular-nums">{leadIndex.value.toFixed(2)}</strong>
              <span className="font-black">{leadIndex.changePercent >= 0 ? '+' : ''}{leadIndex.change.toFixed(2)} / {leadIndex.changePercent >= 0 ? '+' : ''}{leadIndex.changePercent.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      )}
      {loading && <p className="text-sm font-semibold text-ink/50">正在加载市场数据…</p>}
      {error && <p className="rounded-3xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-3">
        <div className="h-56 min-h-56 min-w-0 overflow-x-auto" data-testid="market-chart">
          <BarChart width={640} height={220} data={indices} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.12)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#c8d6e8' }} />
            <YAxis tick={{ fontSize: 12, fill: '#c8d6e8' }} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,.06)' }} contentStyle={{ background: '#0a1c2e', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, color: '#f8fbff' }} />
            <Bar dataKey="changePercent" name="涨跌幅%" radius={[10, 10, 0, 0]}>
              {indices.map((index) => (
                <Cell key={index.code} fill={index.changePercent >= 0 ? BULL : BEAR} />
              ))}
            </Bar>
          </BarChart>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {indices.map((index) => {
          const positive = index.changePercent >= 0;
          const isActive = activeIndex?.code === index.code;
          return (
            <button
              type="button"
              className={`rounded-[1.4rem] border p-4 text-left shadow-sm transition ${isActive ? 'border-[var(--gold)]/55 bg-white/[0.12]' : 'border-white/10 bg-white/[0.06] hover:bg-white/[0.1]'}`}
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

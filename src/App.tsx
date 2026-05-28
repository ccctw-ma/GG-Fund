import { Database, Globe2, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { Header } from './components/Header';
import { FundSearch } from './components/FundSearch';
import { MarketOverview } from './components/MarketOverview';
import { PortfolioPanel } from './components/PortfolioPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Badge } from './components/ui/badge';
import { calculatePortfolioSummary } from './portfolio';
import { exportLocalData, loadHoldings, loadWatchlist, parseImportedData, saveHoldings, saveWatchlist } from './storage';
import type { FundHistoryPoint, FundQuote, Holding, IndexQuote, WatchItem } from './types';

const nowIso = () => new Date().toISOString();

export default function App() {
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string>();
  const [query, setQuery] = useState('000001');
  const [results, setResults] = useState<FundQuote[]>([]);
  const [selectedFund, setSelectedFund] = useState<FundQuote>();
  const [history, setHistory] = useState<FundHistoryPoint[]>([]);
  const [fundLoading, setFundLoading] = useState(false);
  const [fundError, setFundError] = useState<string>();
  const [holdings, setHoldings] = useState<Holding[]>(() => loadHoldings());
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => loadWatchlist());
  const [quotes, setQuotes] = useState<Record<string, FundQuote>>({});
  const [importError, setImportError] = useState<string>();

  useEffect(() => {
    api.getIndices()
      .then(setIndices)
      .catch((error: Error) => setMarketError(error.message))
      .finally(() => setMarketLoading(false));
    api.getTrendingFunds().then(setResults).catch(() => undefined);
  }, []);

  useEffect(() => {
    saveHoldings(holdings);
    const codes = Array.from(new Set(holdings.map((holding) => holding.fundCode)));
    codes.forEach((code) => {
      api.getFund(code).then((quote) => setQuotes((current) => ({ ...current, [code]: quote }))).catch(() => undefined);
    });
  }, [holdings]);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  const summary = useMemo(() => calculatePortfolioSummary(holdings, quotes), [holdings, quotes]);
  const exportText = useMemo(() => exportLocalData({ holdings, watchlist }), [holdings, watchlist]);

  async function searchFunds() {
    setFundLoading(true);
    setFundError(undefined);
    try {
      const funds = await api.searchFunds(query);
      setResults(funds);
      if (funds[0]) await selectFund(funds[0].code);
    } catch (error) {
      setFundError(error instanceof Error ? error.message : '基金查询失败');
    } finally {
      setFundLoading(false);
    }
  }

  async function selectFund(code: string) {
    setFundLoading(true);
    setFundError(undefined);
    try {
      const [fund, nextHistory] = await Promise.all([api.getFund(code), api.getFundHistory(code)]);
      setSelectedFund(fund);
      setQuotes((current) => ({ ...current, [fund.code]: fund }));
      setHistory(nextHistory);
    } catch (error) {
      setFundError(error instanceof Error ? error.message : '基金详情加载失败');
    } finally {
      setFundLoading(false);
    }
  }

  function addHolding(fund: FundQuote) {
    const createdAt = nowIso();
    setHoldings((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        fundCode: fund.code,
        fundName: fund.name,
        shares: 1000,
        costAmount: Number((fund.netValue * 1000).toFixed(2)),
        createdAt,
        updatedAt: createdAt,
      },
    ]);
  }

  function toggleWatch(fund: FundQuote) {
    setWatchlist((current) => {
      if (current.some((item) => item.fundCode === fund.code)) return current.filter((item) => item.fundCode !== fund.code);
      return [...current, { fundCode: fund.code, fundName: fund.name, createdAt: nowIso() }];
    });
  }

  function importData(raw: string) {
    const result = parseImportedData(raw);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setImportError(undefined);
    setHoldings(result.data.holdings);
    setWatchlist(result.data.watchlist);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_28rem),radial-gradient(circle_at_top_right,#dcfce7,transparent_26rem),#f8fafc] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Header />
        <main>
          <section className="mb-6 overflow-hidden rounded-[2.5rem] border border-white/70 bg-slate-950 p-8 text-white shadow-2xl shadow-slate-900/20 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
              <div>
                <div className="mb-5 flex flex-wrap gap-2">
                  <Badge tone="blue"><Sparkles className="h-3 w-3" /> Online-like MVP</Badge>
                  <Badge tone="green"><Globe2 className="h-3 w-3" /> 真实公开行情</Badge>
                  <Badge tone="slate"><Database className="h-3 w-3" /> 免费 SQLite</Badge>
                </div>
                <h2 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">一站查看中国基金行情，分析自己的基金状态</h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">输入基金代码或名称，添加到持仓后即可看到市值、盈亏、收益率和组合占比。服务端接入公开行情接口并使用数据库缓存。</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
                <span className="flex items-center gap-2 text-sm text-slate-300"><TrendingUp className="h-4 w-4" />组合盈亏</span>
                <strong className={summary.totalProfit >= 0 ? 'mt-3 block text-5xl font-black text-red-300' : 'mt-3 block text-5xl font-black text-emerald-300'}>{summary.totalProfit.toFixed(2)}</strong>
                <p className="mt-3 text-sm text-slate-400">当前持仓 {summary.items.length} 只，自选 {watchlist.length} 只。</p>
              </div>
            </div>
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <MarketOverview indices={indices} loading={marketLoading} error={marketError} />
            <FundSearch
              query={query}
              setQuery={setQuery}
              results={results}
              selectedFund={selectedFund}
              history={history}
              loading={fundLoading}
              error={fundError}
              onSearch={searchFunds}
              onSelect={selectFund}
              onAddHolding={addHolding}
              onToggleWatch={toggleWatch}
              watchlist={watchlist}
            />
            <PortfolioPanel summary={summary} watchlist={watchlist} onRemoveHolding={(id) => setHoldings((current) => current.filter((holding) => holding.id !== id))} />
            <SettingsPanel exportText={exportText} importError={importError} onImport={importData} />
          </div>
        </main>
      </div>
    </div>
  );
}

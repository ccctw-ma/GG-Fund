import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { AnalysisPanel } from './components/AnalysisPanel';
import { AuthPanel } from './components/AuthPanel';
import { Header } from './components/Header';
import { FundSearch } from './components/FundSearch';
import { MarketOverview } from './components/MarketOverview';
import { PortfolioPanel } from './components/PortfolioPanel';
import { SettingsPanel } from './components/SettingsPanel';
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
    <div className="newspaper-shell text-ink">
      <div className="newspaper-page">
        <Header />
        <main>
          <section className="market-tape mb-6 grid gap-4 px-4 py-4 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="section-kicker">Morning / Afternoon fund intelligence</div>
              <h2 className="font-display mt-2 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">把基金行情做成一份能读的市场报纸</h2>
            </div>
            <div className="border-l border-ink/20 pl-4">
              <div className="section-kicker">Portfolio P/L</div>
              <strong className={summary.totalProfit >= 0 ? 'mt-2 block text-5xl text-[var(--bull)]' : 'mt-2 block text-5xl text-[var(--bear)]'}>{summary.totalProfit.toFixed(2)}</strong>
              <p className="mt-2 text-sm text-ink/65">持仓 {summary.items.length} 只 · 自选 {watchlist.length} 只 · Cloudflare D1/KV 后端</p>
            </div>
          </section>
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
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
            <AuthPanel />
            <AnalysisPanel selectedFund={selectedFund} />
            <PortfolioPanel summary={summary} watchlist={watchlist} onRemoveHolding={(id) => setHoldings((current) => current.filter((holding) => holding.id !== id))} />
            <SettingsPanel exportText={exportText} importError={importError} onImport={importData} />
          </div>
        </main>
      </div>
    </div>
  );
}

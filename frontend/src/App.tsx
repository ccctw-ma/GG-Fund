import { ArrowUpRight, DatabaseZap, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react';
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
const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 });

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
  const positive = summary.totalProfit >= 0;
  const leadingIndex = indices[0];

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
    <div className="banking-shell text-ink">
      <div className="banking-page">
        <Header />
        <main className="grid gap-8">
          <section className="banking-hero" aria-label="数字私人银行驾驶舱">
            <div className="hero-copy">
              <div className="section-kicker text-mint">GG Fund Private Banking</div>
              <h2 className="font-display mt-4 max-w-4xl text-5xl font-black leading-[0.94] tracking-[-0.06em] text-cream sm:text-7xl">
                数字私人银行驾驶舱
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-cream/72">
                把实时指数、基金估算、AI 研究和本地组合管理整合成一张财富卡片，像数字银行一样快速审阅风险、收益与下一步动作。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="bank-cta" href="#funds">搜索基金 <ArrowUpRight className="h-4 w-4" /></a>
                <a className="bank-cta bank-cta-secondary" href="#portfolio">查看组合</a>
              </div>
            </div>

            <div className="hero-card-stack" data-testid="banking-hero-card">
              <article className="wealth-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-[0.24em] text-cream/55">Total Wealth</span>
                    <strong className="mt-3 block text-4xl font-black tracking-[-0.05em] text-cream">{money.format(summary.totalMarketValue)}</strong>
                  </div>
                  <span className={positive ? 'profit-chip profit-chip-up' : 'profit-chip profit-chip-down'}>{positive ? '+' : ''}{summary.totalReturnRate.toFixed(2)}%</span>
                </div>
                <div className="mt-9 grid grid-cols-3 gap-3">
                  <div className="mini-metric"><span>持仓</span><strong>{summary.items.length}</strong></div>
                  <div className="mini-metric"><span>自选</span><strong>{watchlist.length}</strong></div>
                  <div className="mini-metric"><span>盈亏</span><strong>{money.format(summary.totalProfit)}</strong></div>
                </div>
                <div className="card-number">GG •••• 2026 •••• FUND</div>
              </article>

              <article className="transaction-card">
                <div className="flex items-center justify-between">
                  <span className="section-kicker text-ink/45">Market Pulse</span>
                  <ShieldCheck className="h-5 w-5 text-mint-dark" />
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="transaction-row"><span>{leadingIndex?.name ?? '上证指数'}</span><strong>{leadingIndex ? leadingIndex.value.toFixed(2) : '--'}</strong></div>
                  <div className="transaction-row"><span>AI 研究</span><strong>DeepSeek Agent</strong></div>
                  <div className="transaction-row"><span>行情缓存</span><strong>D1 / KV Ready</strong></div>
                </div>
              </article>
            </div>
          </section>

          <section className="trust-rail" data-testid="trust-rail" aria-label="安全与基础设施">
            <div><LockKeyhole className="h-5 w-5" /><span>OTP / OAuth 登录</span></div>
            <div><DatabaseZap className="h-5 w-5" /><span>Cloudflare D1/KV 数据层</span></div>
            <div><WalletCards className="h-5 w-5" /><span>本地组合隐私优先</span></div>
            <div><ShieldCheck className="h-5 w-5" /><span>仅参考，不构成投资建议</span></div>
          </section>

          <div className="banking-grid">
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

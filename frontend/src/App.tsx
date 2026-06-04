'use client';

import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  ChevronRight,
  Database,
  LineChart,
  ShieldCheck,
  WalletCards,
  Wifi,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type AuthSessionResponse } from './api';
import { Header } from './components/Header';
import { FundSearch } from './components/FundSearch';
import { MarketOverview } from './components/MarketOverview';
import { PortfolioPanel } from './components/PortfolioPanel';
import { SettingsPanel } from './components/SettingsPanel';
import type { WorkspacePage } from './components/Header';
import { calculatePortfolioSummary } from './portfolio';
import { backfillHoldingCodes } from './holdingCodes';
import { exportLocalData, loadHoldings, loadWatchlist, parseImportedData, saveHoldings, saveWatchlist } from './storage';
import type { FundHistoryPoint, FundHoldings, FundQuote, Holding, IndexQuote, WatchItem } from './types';

const nowIso = () => new Date().toISOString();
const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 });

const heroStats = [
  { label: '实时行情', value: '指数 + 基金 + 股票', detail: '东方财富 / 腾讯 / 天天基金' },
  { label: '养基账本', value: '报告 + 提醒', detail: '盈亏 / 风险 / 定投 / 止盈' },
  { label: '多平台导入', value: '文字识别', detail: '支付宝 / 理财通 / 天天 / 雪球' },
];

const transactionFeatures = [
  { title: '多源行情搜索', description: '输入基金、股票代码或名称，自动聚合基金净值、A股实时价格和公开数据备用源。', icon: LineChart },
  { title: '养基宝式账本', description: '多平台持仓汇总、今日估算收益、周/月报摘要、7 天赎回提醒和组合风险诊断。', icon: WalletCards },
  { title: '筛选、对比与诊断', description: '把好买式筛选、对比、诊断抽象为 GG Fund 的基金研究工具层。', icon: BarChart3 },
  { title: '公告、资讯与开源研究', description: '把东方财富、雪球、同花顺、交易所披露和 AKShare/Qlib 能力纳入路线图。', icon: Database },
];

const hashPageMap: Record<string, WorkspacePage> = {
  overview: 'overview',
  features: 'overview',
  workspace: 'workspace',
  funds: 'workspace',
  portfolio: 'portfolio',
  account: 'portfolio',
  auth: 'portfolio',
  settings: 'portfolio',
};

export type AppInitialData = {
  indices?: IndexQuote[];
  trendingFunds?: FundQuote[];
  benchmarkHistory?: FundHistoryPoint[];
};

function pageFromHash(hash: string): WorkspacePage {
  const key = hash.replace(/^#/, '');
  return hashPageMap[key] ?? 'overview';
}

export default function App({ initialData }: { initialData?: AppInitialData }) {
  const [indices, setIndices] = useState<IndexQuote[]>(() => initialData?.indices ?? []);
  const [marketLoading, setMarketLoading] = useState(() => !initialData?.indices?.length);
  const [marketError, setMarketError] = useState<string>();
  const [query, setQuery] = useState('000001');
  const [results, setResults] = useState<FundQuote[]>(() => initialData?.trendingFunds ?? []);
  const [selectedFund, setSelectedFund] = useState<FundQuote>();
  const [history, setHistory] = useState<FundHistoryPoint[]>([]);
  const [benchmarkHistory, setBenchmarkHistory] = useState<FundHistoryPoint[]>(() => initialData?.benchmarkHistory ?? []);
  const [fundHoldings, setFundHoldings] = useState<FundHoldings>({ stocks: [] });
  const [fundLoading, setFundLoading] = useState(false);
  const [fundError, setFundError] = useState<string>();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, FundQuote>>({});
  const [holdingHistories, setHoldingHistories] = useState<Record<string, FundHistoryPoint[]>>({});
  const [quotesRefreshing, setQuotesRefreshing] = useState(false);
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const [session, setSession] = useState<AuthSessionResponse>();
  const [authPending, setAuthPending] = useState<'idle' | 'logout'>('idle');
  const [storageReady, setStorageReady] = useState(false);
  const [activePage, setActivePage] = useState<WorkspacePage>('overview');

  useEffect(() => {
    queueMicrotask(() => {
      const cachedIndices = api.getCachedIndices();
      if (cachedIndices?.length) {
        setIndices(cachedIndices);
        setMarketLoading(false);
      }
      const cachedTrending = api.getCachedTrendingFunds();
      if (cachedTrending?.length) setResults(cachedTrending);
      const cachedBenchmark = api.getCachedIndexHistory('000300.SH', 'all');
      if (cachedBenchmark?.length) setBenchmarkHistory(cachedBenchmark);
    });
    api.getIndices()
      .then(setIndices)
      .catch((error: Error) => setMarketError(error.message))
      .finally(() => setMarketLoading(false));
    api.getTrendingFunds().then(setResults).catch(() => undefined);
    api.getIndexHistory('000300.SH', 'all').then(setBenchmarkHistory).catch(() => undefined);
    api.getCurrentUser().then(setSession).catch(() => setSession(undefined));
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setHoldings(loadHoldings());
      setWatchlist(loadWatchlist());
      setStorageReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncPageFromHash = () => setActivePage(pageFromHash(window.location.hash));
    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  const holdingCodes = useMemo(() => Array.from(new Set(holdings.map((holding) => holding.fundCode))).filter((code) => /^\d{6}$/.test(code)), [holdings]);
  const amountOnlyHoldingCodes = useMemo(
    () => new Set(holdings.filter((holding) => /^\d{6}$/.test(holding.fundCode) && !holding.shares && holding.recordedMarketValue).map((holding) => holding.fundCode)),
    [holdings],
  );

  const refreshHoldingQuotes = useCallback(async () => {
    if (!storageReady || holdingCodes.length === 0) return;
    setQuotesRefreshing(true);
    try {
      await Promise.all(holdingCodes.map(async (code) => {
        const quote = await api.getFund(code);
        setQuotes((current) => ({ ...current, [code]: quote }));
        const officialName = quote.name?.trim();
        if (officialName) {
          setHoldings((current) => {
            let changed = false;
            const next = current.map((holding) => {
              if (holding.fundCode !== code || holding.fundName === officialName) return holding;
              changed = true;
              return { ...holding, fundName: officialName, updatedAt: nowIso() };
            });
            return changed ? next : current;
          });
        }
        if (!amountOnlyHoldingCodes.has(code)) return;
        const cachedHistory = api.getCachedFundHistory(code, 'all') ?? api.getCachedFundHistory(code, '1m');
        if (cachedHistory?.length) setHoldingHistories((current) => (current[code]?.length ? current : { ...current, [code]: cachedHistory }));
        const points = await api.getFundHistory(code, 'all');
        if (points.length > 0) setHoldingHistories((current) => ({ ...current, [code]: points }));
      }));
      setQuotesUpdatedAt(nowIso());
    } catch {
      // 单只基金行情失败时不阻断页面，保留上一次可用估值。
    } finally {
      setQuotesRefreshing(false);
    }
  }, [amountOnlyHoldingCodes, holdingCodes, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    saveHoldings(holdings);
    queueMicrotask(() => {
      void refreshHoldingQuotes();
    });
  }, [holdings, refreshHoldingQuotes, storageReady]);

  useEffect(() => {
    if (!storageReady || holdingCodes.length === 0) return;
    const handle = window.setInterval(() => {
      void refreshHoldingQuotes();
    }, 60_000);
    return () => window.clearInterval(handle);
  }, [holdingCodes.length, refreshHoldingQuotes, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    saveWatchlist(watchlist);
  }, [watchlist, storageReady]);

  useEffect(() => {
    if (!storageReady || !session) return;
    const handle = setTimeout(() => {
      api.syncPortfolio(holdings, watchlist).catch(() => undefined);
    }, 600);
    return () => clearTimeout(handle);
  }, [holdings, watchlist, storageReady, session]);

  const summary = useMemo(() => calculatePortfolioSummary(holdings, quotes, holdingHistories), [holdings, quotes, holdingHistories]);
  const exportText = useMemo(() => exportLocalData({ holdings, watchlist }), [holdings, watchlist]);
  const positive = summary.totalProfit >= 0;
  const leadingIndex = indices[0];

  async function searchFunds() {
    setFundLoading(true);
    setFundError(undefined);
    const normalizedQuery = query.trim();
    const cached = api.getCachedSearchFunds(normalizedQuery);
    if (cached?.length) {
      setResults(cached);
      void selectFund(cached[0].code, { preferCached: true });
    }
    try {
      const funds = await api.searchFunds(normalizedQuery);
      setResults(funds);
      if (funds[0]) await selectFund(funds[0].code, { preferCached: false });
    } catch (error) {
      setFundError(error instanceof Error ? error.message : '基金查询失败');
    } finally {
      setFundLoading(false);
    }
  }

  async function selectFund(code: string, options: { preferCached?: boolean } = {}) {
    setFundLoading(true);
    setFundError(undefined);
    const cachedFund = api.getCachedFund(code);
    const cachedHistory = api.getCachedFundHistory(code, 'all') ?? api.getCachedFundHistory(code, '1m');
    const cachedHoldings = api.getCachedFundHoldings(code);
    if (cachedFund) {
      setSelectedFund(cachedFund);
      setQuotes((current) => ({ ...current, [cachedFund.code]: cachedFund }));
      if (cachedFund.name) setQuery(cachedFund.name);
    }
    if (cachedHistory?.length) setHistory(cachedHistory);
    if (cachedHoldings) setFundHoldings(cachedHoldings);
    if (options.preferCached && cachedFund && cachedHistory?.length) setFundLoading(false);
    try {
      // 渐进式加载：先用 1 个月历史快速出图，再后台补全全量历史，避免首屏一次拉太多数据。
      const [fund, nextHistory] = await Promise.all([api.getFund(code), api.getFundHistory(code, '1m')]);
      setSelectedFund(fund);
      setQuotes((current) => ({ ...current, [fund.code]: fund }));
      setHistory(nextHistory);
      // 用接口返回的真实基金名称回填搜索框，纠正用户可能输错的名称。
      if (fund.name) setQuery(fund.name);
      if (fund.assetType === 'fund') {
        api.getFundHoldings(fund.code).then(setFundHoldings).catch(() => setFundHoldings((current) => (current.stocks.length ? current : { stocks: [] })));
        api.getFundHistory(code, 'all')
          .then((full) => { if (full.length > 0) setHistory((current) => (current.length >= full.length ? current : full)); })
          .catch(() => undefined);
      } else {
        setFundHoldings({ stocks: [] });
      }
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
        accountName: '默认账本',
        platform: 'manual',
        targetWeight: 25,
        alertPercent: 12,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
  }

  function updateHolding(id: string, patch: { recordedMarketValue: number; costAmount: number }) {
    setHoldings((current) =>
      current.map((holding) =>
        holding.id === id
          ? {
              ...holding,
              recordedMarketValue: patch.recordedMarketValue,
              costAmount: patch.costAmount,
              updatedAt: nowIso(),
            }
          : holding,
      ),
    );
    // 手动填写的市值优先于行情估值，清除该基金缓存的行情，让汇总使用录入金额。
    setQuotes((current) => {
      const target = holdings.find((holding) => holding.id === id);
      if (!target) return current;
      const next = { ...current };
      delete next[target.fundCode];
      return next;
    });
  }

  function editHoldingIdentity(id: string, patch: { fundCode: string; fundName: string }) {
    const fundCode = patch.fundCode.trim();
    const fundName = patch.fundName.trim();
    const manualCode = /^\d{6}$/.test(fundCode);
    setHoldings((current) =>
      current.map((holding) =>
        holding.id === id
          ? {
              ...holding,
              fundCode: fundCode || holding.fundCode,
              fundName: fundName || holding.fundName,
              codeSource: manualCode ? 'manual' : holding.codeSource,
              updatedAt: nowIso(),
            }
          : holding,
      ),
    );
    // 填的是有效 6 位代码：行情/详情由 holdings 变更的 effect 自动拉取。
    // 只改了名称、没给有效代码：按名称搜索自动补全真实代码与走势。
    if (!manualCode && fundName) {
      const base = holdings.find((holding) => holding.id === id);
      if (!base) return;
      backfillHoldingCodes([{ ...base, fundCode: 'PENDING', fundName }], api.searchFunds, nowIso)
        .then(([resolved]) => {
          if (!resolved || resolved.fundCode === 'PENDING') return;
          setHoldings((current) =>
            current.map((holding) =>
              holding.id === id ? { ...holding, fundCode: resolved.fundCode, fundName: resolved.fundName, codeSource: 'auto', updatedAt: nowIso() } : holding,
            ),
          );
        })
        .catch(() => undefined);
    }
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
    // 截图导入的持仓没有真实基金代码，按名称自动补全 6 位代码，让持仓明细可看走势。
    backfillHoldingCodes(result.data.holdings, api.searchFunds, nowIso)
      .then((resolved) => {
        setHoldings((current) =>
          current.map((holding) => resolved.find((item) => item.id === holding.id) ?? holding),
        );
      })
      .catch(() => undefined);
  }

  async function logout() {
    setAuthPending('logout');
    try {
      await api.logout();
      api.clearSessionToken();
      setSession(undefined);
    } finally {
      setAuthPending('idle');
    }
  }

  function changePage(page: WorkspacePage) {
    setActivePage(page);
    window.history.replaceState(null, '', `#${page}`);
  }

  return (
    <div className="fund-shell text-ink" id="top">
      <div className="fund-orb fund-orb-gold" />
      <div className="fund-orb fund-orb-mint" />
      <div className="fund-page">
        <Header
          session={session}
          onLogout={logout}
          logoutPending={authPending === 'logout'}
          activePage={activePage}
          onPageChange={changePage}
        />
        <main className="landing-flow">
          {activePage === 'overview' && (
            <>
              <section className="landing-hero" aria-labelledby="hero-title">
                <div className="hero-copy">
                  <div className="trust-pill"><ShieldCheck className="h-4 w-4" /> Cloudflare-first · Local-first · AI-ready</div>
                  <h2 className="hero-title" id="hero-title">基金研究操作系统，把行情、工具、公告、组合与 AI 装进一张专业工作台。</h2>
                  <p className="hero-subtitle">
                    GG Fund 重构为面向中国基金投资者的全景工具站：实时基金净值、ETF/LOF/REITs/转债路线图、官方披露、资讯社区、开源量化底座和本地组合分析在同一个可信界面里串起来。
                  </p>
                  <div className="hero-actions">
                    <button type="button" className="gold-cta" onClick={() => changePage('workspace')}>立即体验 <ArrowUpRight className="h-4 w-4" /></button>
                  </div>
                  <div className="hero-stat-grid">
                    {heroStats.map((item) => (
                      <article className="hero-stat" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <small>{item.detail}</small>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="hero-device" data-testid="banking-hero-card">
                  <div className="phone-frame" aria-label="账户卡片预览">
                    <div className="phone-speaker" />
                    <div className="phone-topline">
                      <span>GG Fund · 研究工作台</span>
                      <BadgeCheck className="h-4 w-4 text-[var(--mint)]" />
                    </div>
                    <div className="balance-card">
                      <span>智能基金账户 · 研究工作台</span>
                      <strong>{money.format(summary.totalMarketValue)}</strong>
                      <small className={positive ? 'profit-up' : 'profit-down'}>{positive ? '+' : ''}{summary.totalReturnRate.toFixed(2)}% · {money.format(summary.totalProfit)}</small>
                    </div>
                    <div className="phone-list">
                      <div><span>持仓基金</span><strong>{summary.items.length}</strong></div>
                      <div><span>自选观察</span><strong>{watchlist.length}</strong></div>
                      <div><span>市场脉冲</span><strong>{leadingIndex ? leadingIndex.value.toFixed(0) : '--'}</strong></div>
                    </div>
                  </div>
                  <article className="floating-ticket">
                    <Wifi className="h-5 w-5 text-[var(--mint)]" />
                    <div><strong>Market Pulse</strong><span>{leadingIndex?.name ?? '上证指数'} · {leadingIndex ? `${leadingIndex.changePercent.toFixed(2)}%` : '同步中'}</span></div>
                  </article>
                </div>
              </section>

              <section className="glass-section" id="overview" aria-labelledby="overview-title">
                <div className="section-heading">
                  <span className="section-kicker">Account Overview</span>
                  <h2 id="overview-title">账户总览</h2>
                  <p>用真实组合数据驱动的账户预览，帮助用户第一眼确认资产、收益、风险和下一步动作。</p>
                </div>
                <div className="overview-grid">
                  <article className="overview-primary-card">
                    <span>总资产估值</span>
                    <strong>{money.format(summary.totalMarketValue)}</strong>
                    <p className={positive ? 'profit-up' : 'profit-down'}>{positive ? '累计收益为正' : '组合处于回撤'} · {money.format(summary.totalProfit)} / {summary.totalReturnRate.toFixed(2)}%</p>
                  </article>
                  <article><span>投入成本</span><strong>{money.format(summary.totalCost)}</strong><small>由本地持仓计算</small></article>
                  <article><span>基金持仓</span><strong>{summary.items.length}</strong><small>默认样例可一键添加</small></article>
                  <article><span>自选列表</span><strong>{watchlist.length}</strong><small>关注净值与估算变化</small></article>
                </div>
              </section>

              <section className="glass-section" id="features" aria-labelledby="features-title">
                <div className="section-heading">
                  <span className="section-kicker">Transaction Features</span>
                  <h2 id="features-title">交易与基金工具</h2>
                  <p>把“查、看、管、研、备份”的核心路径拆成可理解的功能卡片，降低首次使用成本。</p>
                </div>
                <div className="feature-grid">
                  {transactionFeatures.map((item) => {
                    const Icon = item.icon;
                    return (
                      <article className="feature-card" key={item.title}>
                        <span className="feature-icon"><Icon className="h-5 w-5" /></span>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                        <button type="button" onClick={() => changePage('workspace')}>进入功能 <ChevronRight className="h-4 w-4" /></button>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {activePage === 'workspace' && (
            <section className="workspace-section" id="workspace" aria-labelledby="workspace-title">
              <h2 id="workspace-title" className="sr-only">中国基金行情</h2>
              <div className="banking-grid">
                <MarketOverview indices={indices} loading={marketLoading} error={marketError} />
                <FundSearch
                  query={query}
                  setQuery={setQuery}
                  results={results}
                  selectedFund={selectedFund}
                  history={history}
                  benchmarkHistory={benchmarkHistory}
                  holdings={fundHoldings}
                  loading={fundLoading}
                  error={fundError}
                  onSearch={searchFunds}
                  onSelect={selectFund}
                  onAddHolding={addHolding}
                  onToggleWatch={toggleWatch}
                  watchlist={watchlist}
                />
              </div>
            </section>
          )}

          {activePage === 'portfolio' && (
            <section className="workspace-section" id="portfolio-page" aria-labelledby="portfolio-page-title">
              <div className="workspace-heading workspace-heading-compact">
                <h2 id="portfolio-page-title" className="sr-only">组合账户</h2>
                <button type="button" className="ghost-cta" onClick={() => changePage('workspace')}><BarChart3 className="h-4 w-4" /> 返回行情</button>
              </div>
              <div className="banking-grid single-page-grid">
                <PortfolioPanel
                  summary={summary}
                  watchlist={watchlist}
                  benchmarkHistory={benchmarkHistory}
                  quotesRefreshing={quotesRefreshing}
                  quotesUpdatedAt={quotesUpdatedAt}
                  onRefreshQuotes={refreshHoldingQuotes}
                  onRemoveHolding={(id) => setHoldings((current) => current.filter((holding) => holding.id !== id))}
                  onUpdateHolding={updateHolding}
                  onEditIdentity={editHoldingIdentity}
                />
                <SettingsPanel exportText={exportText} importError={importError} onImport={importData} />
              </div>
            </section>
          )}

          <section className="disclaimer-card" aria-label="投资风险提示">
            <BellRing className="h-5 w-5" />
            <p>基金有风险，投资需谨慎。页面展示数据仅用于学习与参考，不构成投资建议、收益承诺或交易依据。</p>
          </section>
        </main>
      </div>
    </div>
  );
}

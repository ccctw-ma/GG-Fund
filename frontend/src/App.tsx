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
import { useEffect, useMemo, useState } from 'react';
import { api, type AuthSessionResponse } from './api';
import { BeginnerGuide } from './components/BeginnerGuide';
import { Header } from './components/Header';
import { FundSearch } from './components/FundSearch';
import { MarketOverview } from './components/MarketOverview';
import { PortfolioPanel } from './components/PortfolioPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ToolUniverse } from './components/ToolUniverse';
import type { WorkspacePage } from './components/Header';
import { calculatePortfolioSummary } from './portfolio';
import { exportLocalData, loadHoldings, loadWatchlist, parseImportedData, saveHoldings, saveWatchlist } from './storage';
import type { FundHistoryPoint, FundQuote, Holding, IndexQuote, WatchItem } from './types';

const nowIso = () => new Date().toISOString();
const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 });

const heroStats = [
  { label: '实时行情', value: '指数 + 基金 + 股票', detail: '东方财富 / 腾讯 / 天天基金' },
  { label: '研究工具', value: '8 类能力', detail: '筛选 / 对比 / 诊断 / 公告' },
  { label: '开源底座', value: 'AKShare · Qlib', detail: '数据与量化路线图' },
];

const transactionFeatures = [
  { title: '多源行情搜索', description: '输入基金、股票代码或名称，自动聚合基金净值、A股实时价格和公开数据备用源。', icon: LineChart },
  { title: '筛选、对比与诊断', description: '把好买式筛选、对比、诊断抽象为 GG Fund 的基金研究工具层。', icon: BarChart3 },
  { title: '持仓与分批行动', description: '用本地持仓、收益、权重和新手路径承接定投、止盈、减仓等教育决策。', icon: WalletCards },
  { title: '公告、资讯与开源研究', description: '把东方财富、雪球、同花顺、交易所披露和 AKShare/Qlib 能力纳入路线图。', icon: Database },
];

const hashPageMap: Record<string, WorkspacePage> = {
  overview: 'overview',
  features: 'overview',
  'tool-universe': 'tools',
  tools: 'tools',
  workspace: 'workspace',
  funds: 'workspace',
  portfolio: 'portfolio',
  account: 'portfolio',
  auth: 'portfolio',
  settings: 'portfolio',
};

function pageFromHash(hash: string): WorkspacePage {
  const key = hash.replace(/^#/, '');
  return hashPageMap[key] ?? 'overview';
}

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
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, FundQuote>>({});
  const [importError, setImportError] = useState<string>();
  const [session, setSession] = useState<AuthSessionResponse>();
  const [authPending, setAuthPending] = useState<'idle' | 'logout'>('idle');
  const [storageReady, setStorageReady] = useState(false);
  const [activePage, setActivePage] = useState<WorkspacePage>('overview');

  useEffect(() => {
    api.getIndices()
      .then(setIndices)
      .catch((error: Error) => setMarketError(error.message))
      .finally(() => setMarketLoading(false));
    api.getTrendingFunds().then(setResults).catch(() => undefined);
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

  useEffect(() => {
    if (!storageReady) return;
    saveHoldings(holdings);
    const codes = Array.from(new Set(holdings.map((holding) => holding.fundCode)));
    codes.forEach((code) => {
      api.getFund(code).then((quote) => setQuotes((current) => ({ ...current, [code]: quote }))).catch(() => undefined);
    });
  }, [holdings, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    saveWatchlist(watchlist);
  }, [watchlist, storageReady]);

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

          {activePage === 'tools' && <ToolUniverse onOpenWorkspace={() => changePage('workspace')} />}

          {activePage === 'workspace' && (
            <section className="workspace-section" id="workspace" aria-labelledby="workspace-title">
              <div className="workspace-heading">
                <div>
                  <span className="section-kicker">Live Workspace</span>
                  <h2 id="workspace-title">中国基金行情</h2>
                  <p>实时查看全球核心指数、搜索基金或A股股票、添加自选或持仓，并用新手决策地图快速判断下一步动作。</p>
                </div>
                <button type="button" className="ghost-cta" onClick={() => changePage('portfolio')}><BarChart3 className="h-4 w-4" /> 查看组合</button>
              </div>
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
                <BeginnerGuide selectedFund={selectedFund} leadingIndex={leadingIndex} summary={summary} />
              </div>
            </section>
          )}

          {activePage === 'portfolio' && (
            <section className="workspace-section" id="portfolio-page" aria-labelledby="portfolio-page-title">
              <div className="workspace-heading">
                <div>
                  <span className="section-kicker">Portfolio</span>
                  <h2 id="portfolio-page-title">组合账户</h2>
                  <p>把持仓、市值、盈亏和自选列表集中到独立页面，避免在长页面里来回查找。</p>
                </div>
                <button type="button" className="ghost-cta" onClick={() => changePage('workspace')}><BarChart3 className="h-4 w-4" /> 返回行情</button>
              </div>
              <div className="banking-grid single-page-grid">
                <PortfolioPanel summary={summary} watchlist={watchlist} onRemoveHolding={(id) => setHoldings((current) => current.filter((holding) => holding.id !== id))} />
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

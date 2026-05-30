'use client';

import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Fingerprint,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WalletCards,
  Wifi,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { getInitialAuthSession, onAuthSessionChange, signOutSupabase, type UiAuthSession } from './supabaseAuth';
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

const heroStats = [
  { label: '实时行情 API', value: 'Cloudflare', detail: 'D1 / KV 缓存' },
  { label: '本地持仓', value: 'Local-first', detail: '浏览器私有存储' },
  { label: 'AI 投研', value: 'Agent', detail: '多步骤分析报告' },
];

const transactionFeatures = [
  { title: '基金搜索与估值', description: '输入基金代码或名称，快速查看盘中估算、官方净值与历史走势。', icon: LineChart },
  { title: '自选与持仓管理', description: '把关注基金加入自选，或一键加入持仓形成账户级收益视图。', icon: WalletCards },
  { title: 'AI 研究报告', description: '整合净值历史、动量、回撤和情景推演，生成结构化投研摘要。', icon: Sparkles },
  { title: '导入导出备份', description: '本地组合数据可导出 JSON，迁移设备或回滚数据更可控。', icon: Database },
];

const securityHighlights = [
  { title: 'Local-first 数据边界', description: '持仓与自选默认留在当前浏览器，减少不必要的服务端暴露。', icon: Fingerprint },
  { title: 'Cloudflare API 隔离', description: '行情、登录和 AI 请求通过 Functions 统一代理，Secret 不进入前端。', icon: ShieldCheck },
  { title: '可撤回的账户入口', description: 'OTP 与 OAuth 入口保留清晰退出路径，避免不可控的假会话。', icon: LockKeyhole },
];

const appChannels = [
  { label: 'iOS App', detail: 'TestFlight 即将开放' },
  { label: 'Android', detail: 'PWA 安装体验' },
  { label: '桌面 Web', detail: '当前版本可直接使用' },
];

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
  const [session, setSession] = useState<UiAuthSession>();
  const [authPending, setAuthPending] = useState<'idle' | 'logout'>('idle');

  useEffect(() => {
    api.getIndices()
      .then(setIndices)
      .catch((error: Error) => setMarketError(error.message))
      .finally(() => setMarketLoading(false));
    api.getTrendingFunds().then(setResults).catch(() => undefined);
    getInitialAuthSession().then(setSession).catch(() => setSession(undefined));
    const unsubscribe = onAuthSessionChange(setSession);
    return unsubscribe;
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

  function handleAuthChange(nextSession?: UiAuthSession) {
    setSession(nextSession);
  }

  async function logout() {
    setAuthPending('logout');
    try {
      await signOutSupabase();
    } finally {
      setSession(undefined);
      setAuthPending('idle');
    }
  }

  return (
    <div className="fund-shell text-ink" id="top">
      <div className="fund-orb fund-orb-gold" />
      <div className="fund-orb fund-orb-mint" />
      <div className="fund-page">
        <Header session={session} onLogout={logout} logoutPending={authPending === 'logout'} />
        <main className="landing-flow">
          <section className="landing-hero" aria-label="智能基金账户">
            <div className="hero-copy">
              <div className="trust-pill"><ShieldCheck className="h-4 w-4" /> Cloudflare-first · Local-first · AI-ready</div>
              <h2 className="hero-title">智能基金账户，把持仓、交易与投研装进一张安全玻璃卡。</h2>
              <p className="hero-subtitle">
                GG Fund 重新设计为面向个人投资者的基金账户中枢：实时行情、组合盈亏、AI 研究、身份登录和备份迁移在同一个可信界面里完成。
              </p>
              <div className="hero-actions">
                <a className="gold-cta" href="#workspace">立即体验 <ArrowUpRight className="h-4 w-4" /></a>
                <a className="ghost-cta" href="#download">下载移动端 <Download className="h-4 w-4" /></a>
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
              <div className="phone-frame" aria-label="移动端账户预览">
                <div className="phone-speaker" />
                <div className="phone-topline">
                  <span>GG Fund</span>
                  <BadgeCheck className="h-4 w-4 text-[var(--mint)]" />
                </div>
                <div className="balance-card">
                  <span>智能基金账户</span>
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
                    <a href="#workspace">进入功能 <ChevronRight className="h-4 w-4" /></a>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="security-band" id="security" aria-labelledby="security-title">
            <div className="section-heading compact-heading">
              <span className="section-kicker">Security Highlights</span>
              <h2 id="security-title">安全与隐私</h2>
              <p>用明确的数据边界和透明提示建立信任，而不是只展示空泛徽章。</p>
            </div>
            <div className="security-grid">
              {securityHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <article className="security-card" key={item.title}>
                    <Icon className="h-6 w-6" />
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="download-section" id="download" aria-labelledby="download-title">
            <div>
              <span className="section-kicker">Mobile App</span>
              <h2 id="download-title">下载移动端</h2>
              <p>当前 Web 版已经可用，移动端入口以 PWA / TestFlight / Android 安装包的产品路径呈现，方便后续接入真实下载链接。</p>
              <div className="download-actions">
                <a href="#workspace"><Smartphone className="h-5 w-5" /> iOS 预约</a>
                <a href="#workspace"><Zap className="h-5 w-5" /> Android 体验</a>
              </div>
            </div>
            <div className="qr-panel" aria-label="移动端下载二维码占位">
              <div className="qr-code"><Download className="h-10 w-10" /></div>
              {appChannels.map((item) => <p key={item.label}><CheckCircle2 className="h-4 w-4" /><strong>{item.label}</strong><span>{item.detail}</span></p>)}
            </div>
          </section>

          <section className="workspace-section" id="workspace" aria-labelledby="workspace-title">
            <div className="workspace-heading">
              <div>
                <span className="section-kicker">Live Workspace</span>
                <h2 id="workspace-title">中国基金行情</h2>
                <p>保留现有实时数据、基金搜索、AI 分析、账户登录和本地备份能力，并统一为新的玻璃拟态工作台。</p>
              </div>
              <a className="ghost-cta" href="#funds"><BarChart3 className="h-4 w-4" /> 查看基金工具</a>
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
              <AuthPanel session={session} onSessionChange={handleAuthChange} />
              <AnalysisPanel selectedFund={selectedFund} />
              <PortfolioPanel summary={summary} watchlist={watchlist} onRemoveHolding={(id) => setHoldings((current) => current.filter((holding) => holding.id !== id))} />
              <SettingsPanel exportText={exportText} importError={importError} onImport={importData} />
            </div>
          </section>

          <section className="disclaimer-card" aria-label="投资风险提示">
            <BellRing className="h-5 w-5" />
            <p>基金有风险，投资需谨慎。页面展示数据仅用于学习与参考，不构成投资建议、收益承诺或交易依据。</p>
          </section>
        </main>
      </div>
    </div>
  );
}

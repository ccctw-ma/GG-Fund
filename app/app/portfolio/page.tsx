import Link from 'next/link';

export default function PortfolioPage() {
  return (
    <main className="fund-shell text-ink" style={{ minHeight: '100vh' }}>
      <div className="fund-page" style={{ maxWidth: '960px', paddingTop: '72px', paddingBottom: '72px' }}>
        <section className="glass-section" aria-labelledby="portfolio-page-title">
          <span className="section-kicker">Portfolio</span>
          <h1 id="portfolio-page-title" className="hero-title" style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)' }}>组合与持仓入口</h1>
          <p className="hero-subtitle">
            本地持仓、自选观察、收益率、组合权重和导入导出仍在 `/app` 基金研究工作台中实时可用；独立组合页后续会承接登录后的云端组合管理。
          </p>
          <div className="hero-actions">
            <Link className="gold-cta" href="/app#portfolio">查看工作台持仓</Link>
            <Link className="ghost-cta" href="/app">进入基金研究工作台</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from 'next/link';

export default function SettingsPage() {
  return (
    <main className="fund-shell text-ink" style={{ minHeight: '100vh' }}>
      <div className="fund-page" style={{ maxWidth: '960px', paddingTop: '72px', paddingBottom: '72px' }}>
        <section className="glass-section" aria-labelledby="settings-page-title">
          <span className="section-kicker">Settings</span>
          <h1 id="settings-page-title" className="hero-title" style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)' }}>账户设置说明</h1>
          <p className="hero-subtitle">
            当前登录、持仓、导入导出和部署说明集中在 `/app` 工作台内完成；本页作为设置入口说明，后续会承接通知偏好、云端组合同步和账户安全配置。
          </p>
          <div className="hero-actions">
            <Link className="gold-cta" href="/app#settings">返回工作台设置</Link>
            <Link className="ghost-cta" href="/app">进入基金研究工作台</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

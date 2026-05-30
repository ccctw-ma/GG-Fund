import Link from 'next/link';

export default function PortfolioPage() {
  return (
    <main className="shell" style={{ maxWidth: '960px', margin: '0 auto', padding: '96px 24px' }}>
      <p style={{ marginBottom: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.72 }}>Portfolio</p>
      <h1 style={{ margin: '0 0 16px' }}>组合与持仓</h1>
      <p style={{ margin: '0 0 24px', lineHeight: 1.7 }}>
        The portfolio route is reserved for the authenticated workspace. Current local-first holdings
        and watchlist remain available from the main workspace page.
      </p>
      <Link href="/app" style={{ fontWeight: 700 }}>返回工作台</Link>
    </main>
  );
}

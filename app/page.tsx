import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="shell" style={{ maxWidth: '960px', margin: '0 auto', padding: '96px 24px' }}>
      <p style={{ marginBottom: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.72 }}>GG Fund</p>
      <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>Cloudflare-first Next.js app shell</h1>
      <p style={{ margin: '0 0 28px', maxWidth: '640px', lineHeight: 1.7 }}>
        The public landing page now lives in the Next.js App Router. Open the workspace to access
        live market data, local-first portfolio tools, and AI fund analysis.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Link href="/app" style={{ padding: '12px 18px', borderRadius: '999px', background: '#10251f', color: '#fbf1df', fontWeight: 700 }}>
          Open workspace
        </Link>
        <Link href="/pricing" style={{ padding: '12px 18px', borderRadius: '999px', border: '1px solid rgba(16,37,31,0.14)', fontWeight: 700 }}>
          View pricing
        </Link>
      </div>
    </main>
  );
}

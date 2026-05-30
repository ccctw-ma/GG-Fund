import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="shell" style={{ maxWidth: '960px', margin: '0 auto', padding: '96px 24px' }}>
      <p style={{ marginBottom: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.72 }}>GG Fund</p>
      <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>GG Fund 中国基金行情</h1>
      <p style={{ margin: '0 0 28px', maxWidth: '640px', lineHeight: 1.7 }}>
        Cloudflare-first Next.js App Router 工作台，聚合中国基金行情、组合视图、AI 研究和面向 Cloudflare Worker 的部署能力。
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Link href="/app" style={{ padding: '12px 18px', borderRadius: '999px', background: '#10251f', color: '#fbf1df', fontWeight: 700 }}>
          进入工作台
        </Link>
      </div>
    </main>
  );
}

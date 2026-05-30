import Link from 'next/link';

export default async function FundDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    <main className="shell" style={{ maxWidth: '960px', margin: '0 auto', padding: '96px 24px' }}>
      <p style={{ marginBottom: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.72 }}>Fund detail</p>
      <h1 style={{ margin: '0 0 16px' }}>基金 {code}</h1>
      <p style={{ margin: '0 0 24px', lineHeight: 1.7 }}>
        Use the workspace search and analysis panels to inspect this fund. Dedicated route wiring is
        now in place for the App Router migration.
      </p>
      <Link href="/app" style={{ fontWeight: 700 }}>返回工作台</Link>
    </main>
  );
}

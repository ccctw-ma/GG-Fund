export default function SettingsPage() {
  return (
    <main className="shell" style={{ maxWidth: '960px', margin: '0 auto', padding: '96px 24px' }}>
      <p style={{ marginBottom: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.72 }}>Settings</p>
      <h1 style={{ margin: '0 0 16px' }}>账户设置</h1>
      <p style={{ lineHeight: 1.7 }}>
        Account settings, Supabase migration prompts, and future notification preferences will live
        here as the architecture refactor continues.
      </p>
    </main>
  );
}

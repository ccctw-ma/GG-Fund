export default function PricingPage() {
  return (
    <main className="shell" style={{ maxWidth: '960px', margin: '0 auto', padding: '96px 24px' }}>
      <p style={{ marginBottom: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.72 }}>Pricing</p>
      <h1 style={{ margin: '0 0 16px' }}>定价基础</h1>
      <p style={{ lineHeight: 1.7 }}>
        Subscription scaffolding is reserved for a later task. This route provides the expected App
        Router surface without pulling Stripe work into the current scope.
      </p>
    </main>
  );
}

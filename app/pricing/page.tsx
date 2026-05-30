import { getCheckoutPriceId, isConfiguredCheckoutPriceId } from '../../features/billing/stripe';

export default function PricingPage() {
  const priceId = getCheckoutPriceId();
  const configured = isConfiguredCheckoutPriceId(priceId);

  return (
    <main className="shell" style={{ maxWidth: '960px', margin: '0 auto', padding: '96px 24px' }}>
      <section
        style={{
          border: '1px solid rgba(16,37,31,0.12)',
          borderRadius: '24px',
          background: 'rgba(255,255,255,0.78)',
          padding: '32px',
          boxShadow: '0 24px 60px rgba(16,37,31,0.08)',
        }}
      >
        <p style={{ marginBottom: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.72 }}>Stripe Billing</p>
        <h1 style={{ margin: '0 0 16px' }}>订阅方案</h1>
        <p style={{ lineHeight: 1.7, margin: '0 0 24px' }}>
          为 AI 投研、组合同步和未来高级提醒预留最小可用订阅入口。当前实现保持安全默认值，只有在配置了真实 Stripe Price 后才会创建 checkout。
        </p>

        <div
          style={{
            border: '1px solid rgba(16,37,31,0.1)',
            borderRadius: '20px',
            padding: '24px',
            background: 'rgba(251,241,223,0.45)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>GG Fund Pro</h2>
          <p style={{ margin: '12px 0 16px', lineHeight: 1.7, opacity: 0.82 }}>订阅入口已接入 API 路由、Stripe checkout 元数据与 webhook 状态同步基础设施。</p>
          <form action="/api/billing/checkout" method="post" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input name="priceId" type="hidden" value={priceId} />
            <button
              type="submit"
              disabled={!configured}
              style={{
                padding: '12px 18px',
                borderRadius: '999px',
                border: 'none',
                fontWeight: 700,
                cursor: configured ? 'pointer' : 'not-allowed',
                background: configured ? '#10251f' : 'rgba(16,37,31,0.18)',
                color: configured ? '#fbf1df' : '#10251f',
              }}
            >
              开始订阅
            </button>
            <span style={{ fontSize: '0.95rem', opacity: 0.75 }}>
              {configured ? '已配置 Stripe 价格，可进入 checkout。' : '尚未配置真实 Stripe 价格，按钮已安全禁用。'}
            </span>
          </form>
        </div>
      </section>
    </main>
  );
}

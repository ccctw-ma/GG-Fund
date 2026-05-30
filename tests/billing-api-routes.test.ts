import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createStripeClientMock,
  buildCheckoutMetadataMock,
  isConfiguredCheckoutPriceIdMock,
  subscriptionStatusFromStripeMock,
  createSupabaseServerClientMock,
  createSupabaseServiceClientMock,
  cookiesMock,
} = vi.hoisted(() => ({
  createStripeClientMock: vi.fn(),
  buildCheckoutMetadataMock: vi.fn((userId: string) => ({ supabaseUserId: userId })),
  isConfiguredCheckoutPriceIdMock: vi.fn(() => true),
  subscriptionStatusFromStripeMock: vi.fn(() => ({ status: 'active', priceId: 'price_123' })),
  createSupabaseServerClientMock: vi.fn(),
  createSupabaseServiceClientMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock('../features/billing/stripe', () => ({
  createStripeClient: createStripeClientMock,
  buildCheckoutMetadata: buildCheckoutMetadataMock,
  isConfiguredCheckoutPriceId: isConfiguredCheckoutPriceIdMock,
  subscriptionStatusFromStripe: subscriptionStatusFromStripeMock,
}));

vi.mock('../lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

import { POST as checkout } from '../app/api/billing/checkout/route';
import { POST as webhook } from '../app/api/billing/webhook/route';

describe('billing api routes', () => {
  const checkoutCreate = vi.fn();
  const constructEventAsync = vi.fn();
  const upsert = vi.fn();
  let previousStripeWebhookSecret: string | undefined;

  beforeEach(() => {
    previousStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    checkoutCreate.mockReset();
    constructEventAsync.mockReset();
    upsert.mockReset().mockResolvedValue({ data: null, error: null });
    buildCheckoutMetadataMock.mockClear();
    isConfiguredCheckoutPriceIdMock.mockReset().mockReturnValue(true);
    subscriptionStatusFromStripeMock.mockClear();
    cookiesMock.mockReset().mockResolvedValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
      remove: vi.fn(),
    });

    createStripeClientMock.mockReset().mockReturnValue({
      checkout: {
        sessions: {
          create: checkoutCreate,
        },
      },
      webhooks: {
        constructEventAsync,
      },
    });

    createSupabaseServerClientMock.mockReset().mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1', email: 'demo@example.com' } },
          error: null,
        })),
      },
    });

    createSupabaseServiceClientMock.mockReset().mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });
  });

  afterEach(() => {
    if (previousStripeWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = previousStripeWebhookSecret;
    }
  });

  it('returns a structured 400 when checkout price is missing', async () => {
    const response = await checkout(
      new Request('https://example.com/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'PRICE_REQUIRED', message: '缺少订阅价格' },
    });
  });

  it('returns a structured 401 when checkout requires login', async () => {
    createSupabaseServerClientMock.mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    });

    const form = new FormData();
    form.set('priceId', 'price_123');

    const response = await checkout(
      new Request('https://example.com/api/billing/checkout', {
        method: 'POST',
        body: form,
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTH_REQUIRED', message: '请先登录' },
    });
  });

  it('creates a checkout session for an authenticated user and redirects form posts', async () => {
    checkoutCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.test/session_123' });
    const form = new FormData();
    form.set('priceId', 'price_123');

    const response = await checkout(
      new Request('https://example.com/api/billing/checkout', {
        method: 'POST',
        body: form,
      }),
    );

    expect(buildCheckoutMetadataMock).toHaveBeenCalledWith('user-1');
    expect(checkoutCreate).toHaveBeenCalledWith({
      mode: 'subscription',
      line_items: [{ price: 'price_123', quantity: 1 }],
      success_url: 'https://example.com/settings?checkout=success',
      cancel_url: 'https://example.com/pricing?checkout=cancelled',
      client_reference_id: 'user-1',
      customer_email: 'demo@example.com',
      metadata: { supabaseUserId: 'user-1' },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://checkout.stripe.test/session_123');
  });

  it('creates a checkout session JSON response when the request prefers JSON', async () => {
    checkoutCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.test/session_json' });

    const response = await checkout(
      new Request('https://example.com/api/billing/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ priceId: 'price_123' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: 'https://checkout.stripe.test/session_json' });
  });

  it('returns a structured 400 when the Stripe signature is missing', async () => {
    const response = await webhook(
      new Request('https://example.com/api/billing/webhook', {
        method: 'POST',
        body: '{}',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'STRIPE_SIGNATURE_REQUIRED', message: '缺少 Stripe 签名' },
    });
  });

  it('returns a structured 400 when the Stripe signature is invalid', async () => {
    constructEventAsync.mockRejectedValueOnce(new Error('invalid signature'));

    const response = await webhook(
      new Request('https://example.com/api/billing/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig_test' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'STRIPE_SIGNATURE_INVALID', message: 'Stripe 签名验证失败' },
    });
  });

  it('upserts normalized subscription data for subscription events', async () => {
    constructEventAsync.mockResolvedValueOnce({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          metadata: { supabaseUserId: 'user-1' },
          status: 'active',
          items: { data: [{ price: { id: 'price_123' } }] },
        },
      },
    });

    const response = await webhook(
      new Request('https://example.com/api/billing/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig_test' },
        body: JSON.stringify({ id: 'evt_123' }),
      }),
    );

    expect(subscriptionStatusFromStripeMock).toHaveBeenCalledWith({
      customer: 'cus_123',
      metadata: { supabaseUserId: 'user-1' },
      status: 'active',
      items: { data: [{ price: { id: 'price_123' } }] },
    });
    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      stripe_customer_id: 'cus_123',
      status: 'active',
      price_id: 'price_123',
      updated_at: expect.any(String),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });
});

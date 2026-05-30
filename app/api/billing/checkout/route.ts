import { cookies } from 'next/headers';
import { buildCheckoutMetadata, createStripeClient, isConfiguredCheckoutPriceId } from '../../../../features/billing/stripe';
import { json, jsonError } from '../../../../lib/http';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'edge';

type CheckoutPayload = {
  priceId?: string;
};

async function readCheckoutPayload(request: Request): Promise<CheckoutPayload | undefined> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json().catch(() => undefined)) as CheckoutPayload | undefined;
  }

  const formData = await request.formData().catch(() => undefined);
  const priceId = formData?.get('priceId');
  return typeof priceId === 'string' ? { priceId } : undefined;
}

function prefersJsonResponse(request: Request) {
  const accept = request.headers.get('accept') ?? '';
  const contentType = request.headers.get('content-type') ?? '';
  return contentType.includes('application/json') || accept.includes('application/json');
}

export async function POST(request: Request) {
  try {
    const payload = await readCheckoutPayload(request);
    const priceId = payload?.priceId?.trim();

    if (!priceId) {
      return jsonError('PRICE_REQUIRED', '缺少订阅价格', 400);
    }

    if (!isConfiguredCheckoutPriceId(priceId)) {
      return jsonError('PRICE_NOT_CONFIGURED', 'Stripe 订阅价格尚未配置', 400);
    }

    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(process.env, {
      get: (name) => cookieStore.get(name)?.value,
      set: () => undefined,
      remove: () => undefined,
    });

    if (!supabase) {
      return jsonError('AUTH_UNAVAILABLE', 'Supabase 登录配置不可用', 500);
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return jsonError('AUTH_LOOKUP_FAILED', error.message, 500);
    }
    if (!data.user) {
      return jsonError('AUTH_REQUIRED', '请先登录', 401);
    }

    const url = new URL(request.url);
    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${url.origin}/settings?checkout=success`,
      cancel_url: `${url.origin}/pricing?checkout=cancelled`,
      client_reference_id: data.user.id,
      customer_email: data.user.email ?? undefined,
      metadata: buildCheckoutMetadata(data.user.id),
    });

    if (!session.url) {
      return jsonError('STRIPE_CHECKOUT_URL_MISSING', 'Stripe checkout 会话未返回跳转地址', 502);
    }

    return prefersJsonResponse(request) ? json({ url: session.url }) : Response.redirect(session.url, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create Stripe checkout session';
    return jsonError('BILLING_CHECKOUT_ERROR', message, 500);
  }
}

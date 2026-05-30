import type Stripe from 'stripe';
import { createStripeClient, subscriptionStatusFromStripe } from '../../../../features/billing/stripe';
import { readRequiredEnv } from '../../../../lib/env';
import { json, jsonError } from '../../../../lib/http';
import { createSupabaseServiceClient } from '../../../../lib/supabase/server';

export const runtime = 'edge';

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

type BillingSubscription = Stripe.Subscription & {
  metadata?: Record<string, string | undefined>;
};

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return jsonError('STRIPE_SIGNATURE_REQUIRED', '缺少 Stripe 签名', 400);
    }

    const payload = await request.text();
    const stripe = createStripeClient();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        payload,
        signature,
        readRequiredEnv('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      return jsonError('STRIPE_SIGNATURE_INVALID', 'Stripe 签名验证失败', 400);
    }

    if (!SUBSCRIPTION_EVENTS.has(event.type)) {
      return json({ received: true });
    }

    const subscription = event.data.object as BillingSubscription;
    const userId = subscription.metadata?.supabaseUserId;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

    if (!userId || !customerId) {
      return json({ received: true });
    }

    const normalized = subscriptionStatusFromStripe(subscription);
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from('billing_customers').upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      status: normalized.status,
      price_id: normalized.priceId,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return jsonError('BILLING_SYNC_FAILED', error.message, 500);
    }

    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process Stripe webhook';
    return jsonError('BILLING_WEBHOOK_ERROR', message, 500);
  }
}

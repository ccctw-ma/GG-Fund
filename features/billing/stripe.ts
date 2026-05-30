import Stripe from 'stripe';
import { readOptionalEnv, readRequiredEnv } from '../../lib/env';

export const STRIPE_PLACEHOLDER_PRICE_ID = 'price_configure_in_stripe';

export type StripeSubscriptionLike = {
  status?: string | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }> | null;
  } | null;
};

export function createStripeClient() {
  return new Stripe(readRequiredEnv('STRIPE_SECRET_KEY'), {
    apiVersion: Stripe.API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function buildCheckoutMetadata(userId: string) {
  return { supabaseUserId: userId };
}

export function getCheckoutPriceId(source: Record<string, string | undefined> = process.env) {
  return (
    readOptionalEnv('STRIPE_PRICE_PRO_MONTHLY', source) ??
    readOptionalEnv('STRIPE_PRICE_ID', source) ??
    STRIPE_PLACEHOLDER_PRICE_ID
  );
}

export function isConfiguredCheckoutPriceId(priceId: string) {
  return Boolean(priceId) && priceId !== STRIPE_PLACEHOLDER_PRICE_ID;
}

export function subscriptionStatusFromStripe(subscription: StripeSubscriptionLike) {
  return {
    status: subscription.status ?? 'inactive',
    priceId: subscription.items?.data?.[0]?.price?.id ?? null,
  };
}

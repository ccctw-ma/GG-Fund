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

function normalizeCheckoutPriceId(priceId: string | undefined) {
  const normalized = priceId?.trim();
  if (!normalized || normalized === STRIPE_PLACEHOLDER_PRICE_ID) {
    return undefined;
  }
  return normalized;
}

function getConfiguredCheckoutPriceIds(source: Record<string, string | undefined> = process.env) {
  const configured = new Set<string>();

  const add = (priceId: string | undefined) => {
    const normalized = normalizeCheckoutPriceId(priceId);
    if (normalized) {
      configured.add(normalized);
    }
  };

  add(readOptionalEnv('STRIPE_PRICE_PRO_MONTHLY', source));
  add(readOptionalEnv('STRIPE_PRICE_ID', source));

  const allowlist = readOptionalEnv('STRIPE_ALLOWED_PRICE_IDS', source);
  if (allowlist) {
    for (const entry of allowlist.split(',')) {
      add(entry);
    }
  }

  return configured;
}

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

export function isConfiguredCheckoutPriceId(priceId: string, source: Record<string, string | undefined> = process.env) {
  const requestedPriceId = normalizeCheckoutPriceId(priceId);
  if (!requestedPriceId) {
    return false;
  }

  return getConfiguredCheckoutPriceIds(source).has(requestedPriceId);
}

export function subscriptionStatusFromStripe(subscription: StripeSubscriptionLike) {
  return {
    status: subscription.status ?? 'inactive',
    priceId: subscription.items?.data?.[0]?.price?.id ?? null,
  };
}

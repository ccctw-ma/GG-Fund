import { describe, expect, it } from 'vitest';
import {
  STRIPE_PLACEHOLDER_PRICE_ID,
  buildCheckoutMetadata,
  getCheckoutPriceId,
  isConfiguredCheckoutPriceId,
  subscriptionStatusFromStripe,
} from '../../features/billing/stripe';

describe('stripe helpers', () => {
  it('adds user id metadata to checkout sessions', () => {
    expect(buildCheckoutMetadata('user-1')).toEqual({ supabaseUserId: 'user-1' });
  });

  it('normalizes active subscription status', () => {
    expect(
      subscriptionStatusFromStripe({
        status: 'active',
        items: { data: [{ price: { id: 'price_123' } }] },
      }),
    ).toEqual({ status: 'active', priceId: 'price_123' });
  });

  it('falls back to the configured checkout placeholder price when none is provided', () => {
    expect(getCheckoutPriceId({})).toBe(STRIPE_PLACEHOLDER_PRICE_ID);
  });

  it('accepts the configured fallback price id as a valid checkout target', () => {
    expect(isConfiguredCheckoutPriceId('price_monthly', { STRIPE_PRICE_ID: 'price_monthly' })).toBe(true);
    expect(isConfiguredCheckoutPriceId('price_monthly', { STRIPE_PRICE_PRO_MONTHLY: 'price_monthly' })).toBe(true);
  });

  it('accepts explicitly allowlisted checkout prices and rejects arbitrary ones', () => {
    const env = {
      STRIPE_PRICE_ID: 'price_default',
      STRIPE_ALLOWED_PRICE_IDS: 'price_default, price_annual',
    };

    expect(isConfiguredCheckoutPriceId('price_default', env)).toBe(true);
    expect(isConfiguredCheckoutPriceId('price_annual', env)).toBe(true);
    expect(isConfiguredCheckoutPriceId('price_untrusted', env)).toBe(false);
  });

  it('rejects placeholder and empty checkout prices', () => {
    expect(isConfiguredCheckoutPriceId('', { STRIPE_PRICE_ID: 'price_default' })).toBe(false);
    expect(isConfiguredCheckoutPriceId(STRIPE_PLACEHOLDER_PRICE_ID, { STRIPE_PRICE_ID: STRIPE_PLACEHOLDER_PRICE_ID })).toBe(false);
  });
});

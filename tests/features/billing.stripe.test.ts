import { describe, expect, it } from 'vitest';
import { buildCheckoutMetadata, getCheckoutPriceId, subscriptionStatusFromStripe } from '../../features/billing/stripe';

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
    expect(getCheckoutPriceId()).toBe('price_configure_in_stripe');
  });
});

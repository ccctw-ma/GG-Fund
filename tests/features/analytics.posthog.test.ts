import { describe, expect, it, vi } from 'vitest';
import { createServerPostHog, initBrowserPostHog, safeAnalyticsProperties } from '../../features/analytics/posthog';

const initMock = vi.fn();
const serverFactory = vi.fn((key: string, options: unknown) => ({ key, options }));

describe('posthog analytics helpers', () => {
  it('keeps only safe event properties', () => {
    expect(
      safeAnalyticsProperties({
        fundCode: '000001',
        shares: 1000,
        query: '消费',
        token: 'secret',
        plan: 'pro',
      }),
    ).toEqual({ fundCode: '000001', query: '消费', plan: 'pro' });
  });

  it('initializes browser posthog only when a public key exists', () => {
    expect(
      initBrowserPostHog(
        { posthogKey: undefined, posthogHost: 'https://us.i.posthog.com' },
        { init: initMock },
      ),
    ).toBe(false);
    expect(initMock).not.toHaveBeenCalled();

    expect(
      initBrowserPostHog(
        { posthogKey: 'phc_test', posthogHost: 'https://eu.i.posthog.com' },
        { init: initMock },
      ),
    ).toBe(true);
    expect(initMock).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://eu.i.posthog.com',
      capture_pageview: true,
      persistence: 'localStorage+cookie',
    });
  });

  it('creates a server posthog client from private or public configuration', () => {
    expect(
      createServerPostHog(
        { apiKey: undefined, publicKey: undefined, host: 'https://us.i.posthog.com' },
        serverFactory,
      ),
    ).toBeUndefined();

    expect(
      createServerPostHog(
        { apiKey: 'phx_private', publicKey: 'phc_public', host: 'https://eu.i.posthog.com' },
        serverFactory,
      ),
    ).toEqual({ key: 'phx_private', options: { host: 'https://eu.i.posthog.com' } });

    expect(
      createServerPostHog(
        { apiKey: undefined, publicKey: 'phc_public', host: undefined },
        serverFactory,
      ),
    ).toEqual({ key: 'phc_public', options: { host: 'https://us.i.posthog.com' } });
  });
});

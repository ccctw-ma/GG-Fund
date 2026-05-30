import posthog from 'posthog-js';
import { PostHog } from 'posthog-node';
import { getPublicEnv, readOptionalEnv } from '../../lib/env';

const SAFE_KEYS = new Set(['fundCode', 'query', 'route', 'source', 'status', 'plan']);
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

type SafeAnalyticsValue = string | number | boolean | null;

type BrowserPostHogClient = {
  init: (apiKey: string, options: {
    api_host: string;
    capture_pageview: boolean;
    persistence: 'localStorage+cookie';
  }) => void;
};

type BrowserPostHogEnv = {
  posthogKey?: string;
  posthogHost?: string;
};

type ServerPostHogConfig = {
  apiKey?: string;
  publicKey?: string;
  host?: string;
};

type ServerPostHogFactory<TClient> = (apiKey: string, options: { host: string }) => TClient;

function isSafeAnalyticsValue(value: unknown): value is SafeAnalyticsValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

export function safeAnalyticsProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => SAFE_KEYS.has(key) && isSafeAnalyticsValue(value)),
  );
}

export function initBrowserPostHog(
  env: BrowserPostHogEnv = getPublicEnv(),
  client: BrowserPostHogClient = posthog,
) {
  if (typeof window === 'undefined' || !env.posthogKey) {
    return false;
  }

  client.init(env.posthogKey, {
    api_host: env.posthogHost ?? DEFAULT_POSTHOG_HOST,
    capture_pageview: true,
    persistence: 'localStorage+cookie',
  });

  return true;
}

export function createServerPostHog<TClient = PostHog>(
  config: ServerPostHogConfig = {
    apiKey: readOptionalEnv('POSTHOG_API_KEY'),
    publicKey: getPublicEnv().posthogKey || undefined,
    host: getPublicEnv().posthogHost || undefined,
  },
  factory: ServerPostHogFactory<TClient> = (apiKey, options) => new PostHog(apiKey, options) as TClient,
) {
  const apiKey = config.apiKey ?? config.publicKey;
  if (!apiKey) {
    return undefined;
  }

  return factory(apiKey, {
    host: config.host ?? DEFAULT_POSTHOG_HOST,
  });
}

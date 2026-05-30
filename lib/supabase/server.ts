import { createServerClient } from '@supabase/ssr';
import { getOptionalEnv, getRequiredEnv } from '../env';

export type SupabaseServerConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export type SupabaseServerAuthConfig = {
  url: string;
  anonKey: string;
};

export type CookieAdapter = {
  get(name: string): string | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  remove(name: string, options?: Record<string, unknown>): void;
};

export function getSupabaseServerConfig(source: Record<string, string | undefined> = process.env): SupabaseServerConfig {
  return {
    url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', source),
    anonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', source),
    serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', source),
  };
}

export function getSupabaseServerAuthConfig(
  source: Record<string, string | undefined> = process.env,
): SupabaseServerAuthConfig | undefined {
  const url = getOptionalEnv('NEXT_PUBLIC_SUPABASE_URL', source);
  const anonKey = getOptionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', source);

  return url && anonKey ? { url, anonKey } : undefined;
}

export function createSupabaseServerClient(
  source: Record<string, string | undefined> = process.env,
  cookies?: CookieAdapter,
) {
  const config = getSupabaseServerAuthConfig(source);
  if (!config) return undefined;

  const cookieAdapter = cookies ?? {
    get: () => undefined,
    set: () => undefined,
    remove: () => undefined,
  };

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      get: (name: string) => cookieAdapter.get(name),
      set: (name: string, value: string, options?: Record<string, unknown>) => cookieAdapter.set(name, value, options),
      remove: (name: string, options?: Record<string, unknown>) => cookieAdapter.remove(name, options),
    },
  });
}

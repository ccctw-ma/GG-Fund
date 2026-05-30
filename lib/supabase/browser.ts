import { createBrowserClient } from '@supabase/ssr';
import { getOptionalEnv } from '../env';

export type SupabaseBrowserConfig = {
  url: string;
  anonKey: string;
};

export function getSupabaseBrowserConfig(source: Record<string, string | undefined> = process.env): SupabaseBrowserConfig | undefined {
  const url = getOptionalEnv('NEXT_PUBLIC_SUPABASE_URL', source);
  const anonKey = getOptionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', source);
  return url && anonKey ? { url, anonKey } : undefined;
}

export function createSupabaseBrowserClient(source: Record<string, string | undefined> = process.env) {
  const config = getSupabaseBrowserConfig(source);
  if (!config) return undefined;
  return createBrowserClient(config.url, config.anonKey);
}

export type EnvSource = Record<string, string | undefined>;

export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  posthogKey: string;
  posthogHost: string;
};

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function getOptionalEnv(name: string, source: EnvSource = process.env) {
  return normalizeEnvValue(source[name]);
}

export function readOptionalEnv(name: string, source: EnvSource = process.env) {
  return getOptionalEnv(name, source);
}

export function getRequiredEnv(name: string, source: EnvSource = process.env) {
  const value = getOptionalEnv(name, source);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function readRequiredEnv(name: string, source: EnvSource = process.env) {
  return getRequiredEnv(name, source);
}

export function hasEnv(name: string, source: EnvSource = process.env) {
  return Boolean(getOptionalEnv(name, source));
}

export function getPublicEnv(source: EnvSource = process.env): PublicEnv {
  return {
    supabaseUrl: getOptionalEnv('NEXT_PUBLIC_SUPABASE_URL', source) ?? '',
    supabaseAnonKey: getOptionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', source) ?? '',
    posthogKey: getOptionalEnv('NEXT_PUBLIC_POSTHOG_KEY', source) ?? '',
    posthogHost: getOptionalEnv('NEXT_PUBLIC_POSTHOG_HOST', source) ?? 'https://us.i.posthog.com',
  };
}

export function createEnv(source: EnvSource = process.env) {
  return {
    optional: (name: string) => getOptionalEnv(name, source),
    required: (name: string) => getRequiredEnv(name, source),
    has: (name: string) => hasEnv(name, source),
  };
}

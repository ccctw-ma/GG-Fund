import { describe, expect, it } from 'vitest';
import { createEnv, getOptionalEnv, getPublicEnv, getRequiredEnv, hasEnv, readOptionalEnv, readRequiredEnv } from './env';

describe('env helpers', () => {
  it('reads optional values and treats blank strings as missing', () => {
    const source = { NEXT_PUBLIC_SITE_URL: 'https://gg-fund.test', EMPTY_VALUE: '   ' };

    expect(getOptionalEnv('NEXT_PUBLIC_SITE_URL', source)).toBe('https://gg-fund.test');
    expect(getOptionalEnv('EMPTY_VALUE', source)).toBeUndefined();
    expect(hasEnv('NEXT_PUBLIC_SITE_URL', source)).toBe(true);
    expect(hasEnv('EMPTY_VALUE', source)).toBe(false);
    expect(readOptionalEnv('NEXT_PUBLIC_SITE_URL', source)).toBe('https://gg-fund.test');
  });

  it('throws for required missing values', () => {
    expect(() => getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', {})).toThrow(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(() => readRequiredEnv('DEEPSEEK_API_KEY', {})).toThrow(
      'Missing required environment variable: DEEPSEEK_API_KEY',
    );
  });

  it('returns browser-safe public env values', () => {
    expect(
      getPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
    });
  });

  it('creates a reusable env reader', () => {
    const env = createEnv({ API_KEY: 'secret', OPTIONAL: undefined });

    expect(env.required('API_KEY')).toBe('secret');
    expect(env.optional('OPTIONAL')).toBeUndefined();
    expect(env.has('API_KEY')).toBe(true);
  });
});

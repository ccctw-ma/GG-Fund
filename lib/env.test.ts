import { describe, expect, it } from 'vitest';
import { createEnv, getOptionalEnv, getRequiredEnv, hasEnv } from './env';

describe('env helpers', () => {
  it('reads optional values and treats blank strings as missing', () => {
    const source = { NEXT_PUBLIC_SITE_URL: 'https://gg-fund.test', EMPTY_VALUE: '   ' };

    expect(getOptionalEnv('NEXT_PUBLIC_SITE_URL', source)).toBe('https://gg-fund.test');
    expect(getOptionalEnv('EMPTY_VALUE', source)).toBeUndefined();
    expect(hasEnv('NEXT_PUBLIC_SITE_URL', source)).toBe(true);
    expect(hasEnv('EMPTY_VALUE', source)).toBe(false);
  });

  it('throws for required missing values', () => {
    expect(() => getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', {})).toThrow(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY',
    );
  });

  it('creates a reusable env reader', () => {
    const env = createEnv({ API_KEY: 'secret', OPTIONAL: undefined });

    expect(env.required('API_KEY')).toBe('secret');
    expect(env.optional('OPTIONAL')).toBeUndefined();
    expect(env.has('API_KEY')).toBe(true);
  });
});

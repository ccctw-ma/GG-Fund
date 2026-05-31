import { describe, expect, it } from 'vitest';
import { createEnv, getOptionalEnv, getRequiredEnv, hasEnv, readOptionalEnv, readRequiredEnv } from './env';

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
    expect(() => getRequiredEnv('RESEND_API_KEY', {})).toThrow(
      'Missing required environment variable: RESEND_API_KEY',
    );
    expect(() => readRequiredEnv('AUTH_EMAIL_FROM', {})).toThrow(
      'Missing required environment variable: AUTH_EMAIL_FROM',
    );
  });

  it('creates a reusable env reader', () => {
    const env = createEnv({ API_KEY: 'secret', OPTIONAL: undefined });

    expect(env.required('API_KEY')).toBe('secret');
    expect(env.optional('OPTIONAL')).toBeUndefined();
    expect(env.has('API_KEY')).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServerClient = vi.fn(() => ({ auth: { getUser: vi.fn() } }));
const createClient = vi.fn(() => ({ from: vi.fn() }));

vi.mock('@supabase/ssr', () => ({
  createServerClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

beforeEach(() => {
  createServerClient.mockClear();
  createClient.mockClear();
});

describe('supabase server helpers', () => {
  it('requires both public and service role config for privileged server work', async () => {
    const { getSupabaseServerConfig } = await import('./server');

    expect(getSupabaseServerConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    })).toEqual({
      url: 'https://demo.supabase.co',
      anonKey: 'anon',
      serviceRoleKey: 'service',
    });

    expect(() => getSupabaseServerConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    })).toThrow('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  });

  it('returns request auth config only when the public Supabase env is present', async () => {
    const { getSupabaseServerAuthConfig } = await import('./server');

    expect(getSupabaseServerAuthConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    })).toEqual({
      url: 'https://demo.supabase.co',
      anonKey: 'anon',
    });

    expect(getSupabaseServerAuthConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
    })).toBeUndefined();
  });

  it('creates a cookie-backed request client without requiring a service role key', async () => {
    const { createSupabaseServerClient } = await import('./server');
    const cookieStore = new Map<string, string>();

    const client = createSupabaseServerClient({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    }, {
      get: (name) => cookieStore.get(name),
      set: (name, value) => cookieStore.set(name, value),
      remove: (name) => cookieStore.delete(name),
    });

    expect(client).toEqual({ auth: { getUser: expect.any(Function) } });
    expect(createServerClient).toHaveBeenCalledWith('https://demo.supabase.co', 'anon', expect.objectContaining({
      cookies: expect.objectContaining({
        get: expect.any(Function),
        set: expect.any(Function),
        remove: expect.any(Function),
      }),
    }));
  });

  it('creates a privileged service client with the service role key', async () => {
    const { createSupabaseServiceClient } = await import('./server');

    const client = createSupabaseServiceClient({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    });

    expect(client).toEqual({ from: expect.any(Function) });
    expect(createClient).toHaveBeenCalledWith(
      'https://demo.supabase.co',
      'service',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
        }),
      }),
    );
  });

  it('returns undefined when request client env is incomplete', async () => {
    const { createSupabaseServerClient } = await import('./server');

    expect(createSupabaseServerClient({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
    })).toBeUndefined();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});

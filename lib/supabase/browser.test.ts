import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBrowserClient = vi.fn(() => ({ kind: 'browser-client' }));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient,
}));

beforeEach(() => {
  createBrowserClient.mockClear();
});

describe('supabase browser helpers', () => {
  it('reads NEXT_PUBLIC Supabase config only when both values are present', async () => {
    const { getSupabaseBrowserConfig } = await import('./browser');

    expect(getSupabaseBrowserConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' })).toEqual({
      url: 'https://demo.supabase.co',
      anonKey: 'anon',
    });
    expect(getSupabaseBrowserConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co' })).toBeUndefined();
  });

  it('creates a browser client only when public config exists', async () => {
    const { createSupabaseBrowserClient } = await import('./browser');

    expect(createSupabaseBrowserClient({ NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' })).toEqual({ kind: 'browser-client' });
    expect(createBrowserClient).toHaveBeenCalledWith('https://demo.supabase.co', 'anon');
    expect(createSupabaseBrowserClient({})).toBeUndefined();
  });
});

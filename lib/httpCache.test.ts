import { describe, expect, it } from 'vitest';
import { cacheHeaders, cachedJson } from './httpCache';

describe('http cache helpers', () => {
  it('builds cache-control headers with the default stale window', () => {
    expect(cacheHeaders(120)).toEqual({
      'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=720',
    });
  });

  it('allows overriding the stale-while-revalidate window', () => {
    expect(cacheHeaders(60, 300)).toEqual({
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    });
  });

  it('returns JSON responses with CDN cache headers', async () => {
    const response = cachedJson({ ok: true }, 30, 90);

    expect(response.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=30, stale-while-revalidate=90');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

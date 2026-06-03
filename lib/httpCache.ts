export function cacheHeaders(maxAge: number, staleWhileRevalidate = maxAge * 6) {
  return {
    'Cache-Control': `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  };
}

export function cachedJson<T>(data: T, maxAge: number, staleWhileRevalidate?: number) {
  return Response.json(data, { headers: cacheHeaders(maxAge, staleWhileRevalidate) });
}

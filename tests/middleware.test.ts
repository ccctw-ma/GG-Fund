import { describe, expect, it } from 'vitest';
import { config, middleware } from '../middleware';

describe('next middleware', () => {
  it('keeps public routes as pass-through responses', () => {
    const response = middleware({ nextUrl: { pathname: '/api/health' } } as never);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('keeps matched app and api routes as pass-through responses', () => {
    const appResponse = middleware({ nextUrl: { pathname: '/app/dashboard' } } as never);
    const apiResponse = middleware({ nextUrl: { pathname: '/api/funds/search' } } as never);

    expect(appResponse.headers.get('x-middleware-next')).toBe('1');
    expect(apiResponse.headers.get('x-middleware-next')).toBe('1');
  });

  it('matches app and api route prefixes', () => {
    expect(config).toEqual({
      matcher: ['/app/:path*', '/api/:path*'],
    });
  });
});

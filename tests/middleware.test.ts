import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from '../app/page';
import { config, middleware } from '../middleware';

describe('next middleware', () => {
  it('keeps public routes as pass-through responses', () => {
    const response = middleware({ nextUrl: { pathname: '/api/health' } } as never);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('keeps settings as a public route without exposing the retired pricing page', () => {
    const settingsResponse = middleware({ nextUrl: { pathname: '/settings' } } as never);
    const html = renderToStaticMarkup(HomePage());

    expect(settingsResponse).toBeInstanceOf(Response);
    expect(settingsResponse.headers.get('x-middleware-next')).toBe('1');
    expect(html).not.toContain('href="/pricing"');
  });

  it('keeps matched app and api routes as pass-through responses', () => {
    const appResponse = middleware({ nextUrl: { pathname: '/app/dashboard' } } as never);
    const apiResponse = middleware({ nextUrl: { pathname: '/api/funds/search' } } as never);

    expect(appResponse.headers.get('x-middleware-next')).toBe('1');
    expect(apiResponse.headers.get('x-middleware-next')).toBe('1');
  });

  it('renders only the workspace entry on the landing page', () => {
    const html = renderToStaticMarkup(HomePage());

    expect(html).toContain('href="/app"');
    expect(html).toContain('进入工作台');
    expect(html).not.toContain('href="/pricing"');
    expect(html).not.toContain('查看定价');
  });

  it('matches app and api route prefixes', () => {
    expect(config).toEqual({
      matcher: ['/app/:path*', '/api/:path*'],
    });
  });
});

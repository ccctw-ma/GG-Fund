import { describe, expect, it } from 'vitest';
import { HttpError, isHttpError, json, jsonError, readJson } from './http';

describe('http helpers', () => {
  it('builds json responses with default headers', async () => {
    const response = json({ ok: true }, { status: 201, headers: { 'x-test': '1' } });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-test')).toBe('1');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('returns structured json errors', async () => {
    const response = jsonError('BAD_REQUEST', 'invalid payload', 400);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'BAD_REQUEST', message: 'invalid payload' },
    });
  });

  it('reads request json safely', async () => {
    const request = new Request('https://gg-fund.test/api/demo', {
      method: 'POST',
      body: JSON.stringify({ code: '000001' }),
    });

    await expect(readJson<{ code: string }>(request)).resolves.toEqual({ code: '000001' });
    await expect(readJson(new Request('https://gg-fund.test/api/demo', { method: 'POST', body: '{' }))).resolves.toBeUndefined();
  });

  it('marks HttpError instances', () => {
    const error = new HttpError(401, 'AUTH_REQUIRED', 'login first');

    expect(isHttpError(error)).toBe(true);
    expect(error.status).toBe(401);
    expect(error.code).toBe('AUTH_REQUIRED');
    expect(error.message).toBe('login first');
  });
});

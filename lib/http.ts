type JsonInit = {
  status?: number;
  headers?: HeadersInit;
};

function mergeHeaders(headers?: HeadersInit) {
  return {
    'content-type': 'application/json; charset=utf-8',
    ...Object.fromEntries(new Headers(headers ?? {}).entries()),
  };
}

export function json(body: unknown, init: JsonInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: mergeHeaders(init.headers),
  });
}

export function jsonError(code: string, message: string, status = 400, headers?: HeadersInit) {
  return json({ error: { code, message } }, { status, headers });
}

export async function readJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

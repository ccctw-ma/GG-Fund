'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { normalizeAnalyzeFundRequest, streamAnalyzeFundResponse, type AnalyzeFundStreamCallbacks } from '../../../../../features/ai/service';
import { getDefaultMarketService } from '../../../../../features/market/service';
import { isHttpError, jsonError, readJson } from '../../../../../lib/http';

type StreamEvent =
  | { type: 'status'; message: string }
  | { type: 'delta'; delta: string }
  | { type: 'result'; data: Awaited<ReturnType<typeof streamAnalyzeFundResponse>> }
  | { type: 'error'; code: string; message: string };

async function readDeepSeekApiKey() {
  try {
    const context = await getCloudflareContext({ async: true });
    const cloudflareEnv = (context.env ?? {}) as { DEEPSEEK_API_KEY?: string };
    return cloudflareEnv.DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  } catch {
    return process.env.DEEPSEEK_API_KEY;
  }
}

function encodeEvent(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  try {
    const body = normalizeAnalyzeFundRequest(await readJson(request));
    const apiKey = await readDeepSeekApiKey();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const callbacks: AnalyzeFundStreamCallbacks = {
          onStatus(message) {
            controller.enqueue(encoder.encode(encodeEvent({ type: 'status', message })));
          },
          onDelta(delta) {
            controller.enqueue(encoder.encode(encodeEvent({ type: 'delta', delta })));
          },
        };

        try {
          const result = await streamAnalyzeFundResponse(body, {
            marketService: getDefaultMarketService(),
            deepSeekApiKey: apiKey,
          }, callbacks);
          controller.enqueue(encoder.encode(encodeEvent({ type: 'result', data: result })));
        } catch (error) {
          if (isHttpError(error)) {
            controller.enqueue(encoder.encode(encodeEvent({ type: 'error', code: error.code, message: error.message })));
          } else {
            controller.enqueue(encoder.encode(encodeEvent({ type: 'error', code: 'UPSTREAM_ERROR', message: 'Cloudflare 后端服务暂不可用，请稍后重试' })));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store, no-transform',
      },
    });
  } catch (error) {
    return isHttpError(error)
      ? jsonError(error.code, error.message, error.status)
      : jsonError('UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试', 502);
  }
}

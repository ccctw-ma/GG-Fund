import { getCloudflareContext } from '@opennextjs/cloudflare';
import { normalizeRecognizeHoldingsRequest, recognizeHoldingsFromImage } from '../../../../features/ai/recognizeHoldings';
import { isHttpError, jsonError, readJson } from '../../../../lib/http';

async function readDeepSeekApiKey() {
  try {
    const context = await getCloudflareContext({ async: true });
    const cloudflareEnv = (context.env ?? {}) as { DEEPSEEK_API_KEY?: string };
    return cloudflareEnv.DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  } catch {
    return process.env.DEEPSEEK_API_KEY;
  }
}

export async function POST(request: Request) {
  try {
    const body = normalizeRecognizeHoldingsRequest(await readJson(request));
    return Response.json(
      await recognizeHoldingsFromImage(body, {
        deepSeekApiKey: await readDeepSeekApiKey(),
      }),
    );
  } catch (error) {
    return isHttpError(error)
      ? jsonError(error.code, error.message, error.status)
      : jsonError('UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试', 502);
  }
}

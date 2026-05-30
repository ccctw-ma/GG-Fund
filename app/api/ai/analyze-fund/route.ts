import { buildAnalyzeFundResponse, normalizeAnalyzeFundRequest } from '../../../../features/ai/service';
import { getDefaultMarketService } from '../../../../features/market/service';
import { isHttpError, jsonError, readJson } from '../../../../lib/http';


export async function POST(request: Request) {
  try {
    const body = normalizeAnalyzeFundRequest(await readJson(request));
    return Response.json(
      await buildAnalyzeFundResponse(body, {
        marketService: getDefaultMarketService(),
        deepSeekApiKey: process.env.DEEPSEEK_API_KEY,
      }),
    );
  } catch (error) {
    return isHttpError(error)
      ? jsonError(error.code, error.message, error.status)
      : jsonError('UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试', 502);
  }
}

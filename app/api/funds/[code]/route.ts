import { isHttpError, jsonError } from '../../../../lib/http';
import { getDefaultMarketService } from '../../../../features/market/service';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    return Response.json(await getDefaultMarketService().getFund(code));
  } catch (error) {
    return isHttpError(error)
      ? jsonError(error.code, error.message, error.status)
      : jsonError('UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试', 502);
  }
}

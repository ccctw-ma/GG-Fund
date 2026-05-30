import { isHttpError, jsonError } from '../../../../lib/http';
import { getDefaultMarketService } from '../../../../features/market/service';


export async function GET() {
  try {
    return Response.json(await getDefaultMarketService().getIndices());
  } catch (error) {
    return isHttpError(error)
      ? jsonError(error.code, error.message, error.status)
      : jsonError('UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试', 502);
  }
}

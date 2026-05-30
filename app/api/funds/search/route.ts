import { isHttpError, jsonError } from '../../../../lib/http';
import { getDefaultMarketService } from '../../../../features/market/service';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get('q') ?? '';
    return Response.json(await getDefaultMarketService().searchFunds(query));
  } catch (error) {
    return isHttpError(error)
      ? jsonError(error.code, error.message, error.status)
      : jsonError('UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试', 502);
  }
}

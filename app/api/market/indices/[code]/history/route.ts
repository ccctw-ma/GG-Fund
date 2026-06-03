import { isHttpError, jsonError } from '../../../../../../lib/http';
import { cachedJson } from '../../../../../../lib/httpCache';
import { getDefaultMarketService } from '../../../../../../features/market/service';


export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const range = new URL(request.url).searchParams.get('range') ?? '1m';
    return cachedJson(await getDefaultMarketService().getIndexHistory(code, range), 86_400, 604_800);
  } catch (error) {
    return isHttpError(error)
      ? jsonError(error.code, error.message, error.status)
      : jsonError('UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试', 502);
  }
}

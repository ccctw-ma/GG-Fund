import { isHttpError, jsonError } from '../../../../../lib/http';
import { cachedJson } from '../../../../../lib/httpCache';
import { getDefaultMarketService } from '../../../../../features/market/service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    return cachedJson(await getDefaultMarketService().getFundIntraday(code), 60, 120);
  } catch (error) {
    return isHttpError(error)
      ? jsonError(error.code, error.message, error.status)
      : jsonError('UPSTREAM_ERROR', 'Cloudflare 后端服务暂不可用，请稍后重试', 502);
  }
}

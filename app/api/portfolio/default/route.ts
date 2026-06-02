import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createPortfolioRepository } from '../../../../features/portfolio/repository';
import { jsonError } from '../../../../lib/http';


type PortfolioDatabase = Parameters<typeof createPortfolioRepository>[0];
type CloudflareBindings = {
  GG_FUND_DB?: PortfolioDatabase;
};

function getGlobalDatabase() {
  return (globalThis as { GG_FUND_DB?: PortfolioDatabase }).GG_FUND_DB;
}

async function getRuntimeDatabase(): Promise<PortfolioDatabase | undefined> {
  const globalDatabase = getGlobalDatabase();
  if (globalDatabase) {
    return globalDatabase;
  }

  try {
    const context = await getCloudflareContext({ async: true });
    return (context.env as CloudflareBindings | undefined)?.GG_FUND_DB;
  } catch {
    return undefined;
  }
}

function readSessionToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)gg_fund_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function getRequestUserId(db: PortfolioDatabase, request: Request): Promise<string | undefined> {
  const token = readSessionToken(request);
  if (!token) return undefined;
  const row = await db
    .prepare('select user_id as userId, expires_at as expiresAt from auth_sessions where token = ?')
    .bind(token)
    .first<{ userId: string; expiresAt: string }>();

  if (!row || Date.parse(row.expiresAt) <= Date.now()) return undefined;
  return row.userId;
}

export async function GET(request: Request) {
  try {
    const db = await getRuntimeDatabase();
    if (!db) {
      return jsonError('PORTFOLIO_DB_UNAVAILABLE', 'GG_FUND_DB is not available in the current runtime', 500);
    }

    const repository = createPortfolioRepository(db);
    const userId = await getRequestUserId(db, request);
    const portfolio = await repository.ensureDefaultPortfolio(userId);
    return Response.json(await repository.getSnapshot(portfolio.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load default portfolio';
    return jsonError('PORTFOLIO_ROUTE_ERROR', message, 500);
  }
}

type HoldingPayload = {
  fundCode?: unknown;
  fundName?: unknown;
  shares?: unknown;
  costAmount?: unknown;
  recordedMarketValue?: unknown;
  purchaseDate?: unknown;
  note?: unknown;
};

type SyncPayload = {
  holdings?: HoldingPayload[];
  watchlist?: Array<{ fundCode?: unknown; fundName?: unknown }>;
};

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export async function PUT(request: Request) {
  try {
    const db = await getRuntimeDatabase();
    if (!db) {
      return jsonError('PORTFOLIO_DB_UNAVAILABLE', 'GG_FUND_DB is not available in the current runtime', 500);
    }

    const payload = (await request.json().catch(() => undefined)) as SyncPayload | undefined;
    if (!payload || !Array.isArray(payload.holdings) || !Array.isArray(payload.watchlist)) {
      return jsonError('PORTFOLIO_SYNC_INVALID', 'holdings 与 watchlist 必须为数组', 400);
    }

    const holdings = payload.holdings
      .filter((item) => typeof item.fundCode === 'string' && typeof item.fundName === 'string' && isNonNegative(item.costAmount) && (isPositive(item.shares) || isPositive(item.recordedMarketValue)))
      .map((item) => ({
        fundCode: item.fundCode as string,
        fundName: item.fundName as string,
        shares: isPositive(item.shares) ? (item.shares as number) : undefined,
        costAmount: item.costAmount as number,
        recordedMarketValue: isPositive(item.recordedMarketValue) ? (item.recordedMarketValue as number) : undefined,
        purchaseDate: typeof item.purchaseDate === 'string' ? item.purchaseDate : undefined,
        note: typeof item.note === 'string' ? item.note : undefined,
      }));

    const watchlist = payload.watchlist
      .filter((item) => typeof item.fundCode === 'string' && typeof item.fundName === 'string')
      .map((item) => ({ fundCode: item.fundCode as string, fundName: item.fundName as string }));

    const repository = createPortfolioRepository(db);
    const userId = await getRequestUserId(db, request);
    const portfolio = await repository.ensureDefaultPortfolio(userId);
    await repository.replaceSnapshot(portfolio.id, holdings, watchlist);
    return Response.json(await repository.getSnapshot(portfolio.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to sync default portfolio';
    return jsonError('PORTFOLIO_ROUTE_ERROR', message, 500);
  }
}

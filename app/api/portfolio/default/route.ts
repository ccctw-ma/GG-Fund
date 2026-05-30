import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cookies } from 'next/headers';
import { getRequestSession } from '../../../../features/auth/session';
import { createPortfolioRepository } from '../../../../features/portfolio/repository';
import { jsonError } from '../../../../lib/http';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'edge';

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

async function getRequestUserId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const client = createSupabaseServerClient(process.env, {
    get: (name) => cookieStore.get(name)?.value,
    set: () => undefined,
    remove: () => undefined,
  });

  if (!client) {
    return undefined;
  }

  const session = await getRequestSession(client);
  return session?.user.id;
}

export async function GET() {
  try {
    const db = await getRuntimeDatabase();
    if (!db) {
      return jsonError('PORTFOLIO_DB_UNAVAILABLE', 'GG_FUND_DB is not available in the current runtime', 500);
    }

    const repository = createPortfolioRepository(db);
    const userId = await getRequestUserId();
    const portfolio = await repository.ensureDefaultPortfolio(userId);
    return Response.json(await repository.getSnapshot(portfolio.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load default portfolio';
    return jsonError('PORTFOLIO_ROUTE_ERROR', message, 500);
  }
}

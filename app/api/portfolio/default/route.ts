import { createPortfolioRepository } from '../../../../features/portfolio/repository';

export const runtime = 'edge';

function getDefaultRepository() {
  const db = (globalThis as { GG_FUND_DB?: Parameters<typeof createPortfolioRepository>[0] }).GG_FUND_DB;
  if (!db) {
    throw new Error('GG_FUND_DB is not available in the current runtime');
  }
  return createPortfolioRepository(db);
}

export async function GET() {
  const repository = getDefaultRepository();
  const portfolio = await repository.ensureDefaultPortfolio();
  return Response.json(await repository.getSnapshot(portfolio.id));
}

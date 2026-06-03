import { FundWorkspace } from '../../components/workspace/FundWorkspace';
import { getDefaultMarketService } from '../../features/market/service';
import type { AppInitialData } from '../../frontend/src/App';

export const revalidate = 60;

export default async function WorkspacePage() {
  const market = getDefaultMarketService();
  const [indices, trendingFunds, benchmarkHistory] = await Promise.allSettled([
    market.getIndices(),
    market.getTrendingFunds(),
    market.getIndexHistory('000300.SH', 'all'),
  ]);
  const initialData: AppInitialData = {
    indices: indices.status === 'fulfilled' ? indices.value : undefined,
    trendingFunds: trendingFunds.status === 'fulfilled' ? trendingFunds.value : undefined,
    benchmarkHistory: benchmarkHistory.status === 'fulfilled' ? benchmarkHistory.value : undefined,
  };
  return <FundWorkspace initialData={initialData} />;
}

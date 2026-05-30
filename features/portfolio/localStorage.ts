import type { Holding, WatchItem } from '../../frontend/src/types';

export type PortfolioLocalSnapshot = {
  holdings: Holding[];
  watchlist: WatchItem[];
};

const HOLDINGS_KEY = 'gg-fund:holdings';
const WATCHLIST_KEY = 'gg-fund:watchlist';

function parseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function browserPortfolioStorage(getStorage: () => Storage | undefined = () => globalThis.localStorage) {
  return {
    load(): PortfolioLocalSnapshot {
      const storage = getStorage();
      if (!storage) return { holdings: [], watchlist: [] };
      return {
        holdings: parseArray<Holding>(storage.getItem(HOLDINGS_KEY)),
        watchlist: parseArray<WatchItem>(storage.getItem(WATCHLIST_KEY)),
      };
    },
    save(snapshot: PortfolioLocalSnapshot) {
      const storage = getStorage();
      if (!storage) return;
      storage.setItem(HOLDINGS_KEY, JSON.stringify(snapshot.holdings));
      storage.setItem(WATCHLIST_KEY, JSON.stringify(snapshot.watchlist));
    },
  };
}

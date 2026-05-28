export type Holding = {
  id: string;
  fundCode: string;
  fundName: string;
  shares: number;
  costAmount: number;
  purchaseDate?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type WatchItem = {
  fundCode: string;
  fundName: string;
  createdAt: string;
};

export type FundQuote = {
  code: string;
  name: string;
  netValue: number;
  officialNetValue?: number;
  dailyChangePercent?: number;
  quoteDate: string;
  estimateTime?: string;
  quoteType?: 'official' | 'estimate' | 'fallback';
  source: string;
};

export type IndexQuote = {
  code: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  quoteTime: string;
};

export type FundHistoryPoint = {
  date: string;
  netValue: number;
};

export type PortfolioItem = Holding & {
  quote?: FundQuote;
  marketValue: number;
  profit: number;
  returnRate: number;
  weight: number;
  quoteStatus: 'ok' | 'missing';
};

export type PortfolioSummary = {
  totalCost: number;
  totalMarketValue: number;
  totalProfit: number;
  totalReturnRate: number;
  items: PortfolioItem[];
};

export type ExportedLocalData = {
  holdings: Holding[];
  watchlist: WatchItem[];
};

export type Holding = {
  id: string;
  fundCode: string;
  fundName: string;
  shares: number;
  costAmount: number;
  accountName?: string;
  platform?: 'manual' | 'alipay' | 'wechat' | 'tiantian' | 'xueqiu' | 'other';
  targetWeight?: number;
  alertPercent?: number;
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
  assetType?: 'fund' | 'stock' | 'index';
  market?: 'SH' | 'SZ' | 'BJ' | 'HK' | 'US';
  netValue: number;
  officialNetValue?: number;
  dailyChangePercent?: number;
  change?: number;
  open?: number;
  previousClose?: number;
  high?: number;
  low?: number;
  volume?: number;
  turnover?: number;
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

export type FundAnalysisIndicators = {
  totalReturn: number;
  maxDrawdown: number;
  shortMomentum: number;
  volatility: number;
  trendSlope: number;
  sampleSize: number;
};

export type FundAnalysisReport = {
  summary: string;
  trend: string;
  risk: string;
  beginnerGuide: {
    riskLevel: 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
    riskExplanation: string;
    netValueExplanation: string;
    trendExplanation: string;
    suggestedAction: '继续持有' | '观察等待' | '分批加仓' | '分批减仓' | '避免追涨';
    actionPath: string[];
    suitableFor: string[];
    avoid: string[];
  };
  scenarios: Array<{ name: string; probability: 'low' | 'medium' | 'high'; description: string }>;
  watchPoints: string[];
  disclaimer: string;
};

export type FundAnalysisResponse = {
  fund: FundQuote;
  agent: {
    model: string;
    steps: Array<{ name: string; status: 'done'; summary: string }>;
    indicators: FundAnalysisIndicators;
  };
  report: FundAnalysisReport;
  chartAnnotations: Array<{ date?: string; label: string; description: string; tone: 'positive' | 'negative' | 'neutral' }>;
  analysis: string;
};

export type PortfolioItem = Holding & {
  quote?: FundQuote;
  marketValue: number;
  profit: number;
  returnRate: number;
  weight: number;
  estimatedDailyProfit: number;
  holdingDays?: number;
  quoteStatus: 'ok' | 'missing';
};

export type PortfolioLedger = {
  accountName: string;
  platform: string;
  marketValue: number;
  costAmount: number;
  profit: number;
  holdingCount: number;
};

export type PortfolioSignal = {
  title: string;
  detail: string;
  tone: 'positive' | 'warning' | 'danger' | 'neutral';
};

export type PortfolioPlan = {
  title: string;
  amount: number;
  cadence: string;
  detail: string;
};

export type PortfolioSummary = {
  totalCost: number;
  totalMarketValue: number;
  totalProfit: number;
  totalReturnRate: number;
  estimatedDailyProfit: number;
  liveQuoteRatio: number;
  ledgers: PortfolioLedger[];
  riskSignals: PortfolioSignal[];
  reportSignals: PortfolioSignal[];
  actionSignals: PortfolioSignal[];
  plan: PortfolioPlan;
  items: PortfolioItem[];
};

export type ExportedLocalData = {
  holdings: Holding[];
  watchlist: WatchItem[];
};

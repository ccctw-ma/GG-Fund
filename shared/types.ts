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

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

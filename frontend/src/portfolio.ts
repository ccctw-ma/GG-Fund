import type { FundQuote, Holding, PortfolioSummary } from './types';

const percent = (value: number) => (Number.isFinite(value) ? value * 100 : 0);

export function calculatePortfolioSummary(
  holdings: Holding[],
  quotes: Record<string, FundQuote | undefined>,
): PortfolioSummary {
  const totalMarketValue = holdings.reduce((sum, holding) => {
    const quote = quotes[holding.fundCode];
    return sum + (quote ? holding.shares * quote.netValue : 0);
  }, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costAmount, 0);

  const items = holdings.map((holding) => {
    const quote = quotes[holding.fundCode];
    const marketValue = quote ? holding.shares * quote.netValue : 0;
    const profit = marketValue - holding.costAmount;
    const returnRate = holding.costAmount > 0 ? percent(profit / holding.costAmount) : 0;
    const weight = totalMarketValue > 0 ? percent(marketValue / totalMarketValue) : 0;

    return {
      ...holding,
      quote,
      marketValue,
      profit,
      returnRate,
      weight,
      quoteStatus: quote ? ('ok' as const) : ('missing' as const),
    };
  });

  const totalProfit = totalMarketValue - totalCost;
  const totalReturnRate = totalCost > 0 ? percent(totalProfit / totalCost) : 0;

  return {
    totalCost,
    totalMarketValue,
    totalProfit,
    totalReturnRate,
    items,
  };
}

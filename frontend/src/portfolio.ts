import type { FundHistoryPoint, FundQuote, Holding, PortfolioLedger, PortfolioSignal, PortfolioSummary } from './types';

const percent = (value: number) => (Number.isFinite(value) ? value * 100 : 0);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const platformLabels: Record<NonNullable<Holding['platform']>, string> = {
  manual: '手动录入',
  alipay: '支付宝',
  wechat: '理财通',
  tiantian: '天天基金',
  xueqiu: '雪球',
  other: '其他平台',
};

function holdingDays(purchaseDate?: string) {
  if (!purchaseDate) return undefined;
  const start = Date.parse(purchaseDate);
  if (!Number.isFinite(start)) return undefined;
  return Math.max(1, Math.floor((Date.now() - start) / MS_PER_DAY) + 1);
}

function dateKey(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWeekday(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function quoteDateKey(quote?: FundQuote) {
  if (!quote?.quoteDate) return undefined;
  const direct = quote.quoteDate.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return direct ?? dateKey(quote.quoteDate);
}

function estimateDateKey(quote?: FundQuote) {
  if (!quote?.estimateTime) return undefined;
  const direct = quote.estimateTime.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return direct ?? undefined;
}

function dailyProfitDateKey(quote?: FundQuote) {
  return estimateDateKey(quote) ?? quoteDateKey(quote);
}

function isCurrentTradingDay(date: string | undefined, asOf: Date) {
  return Boolean(date && isWeekday(asOf) && date === localDateKey(asOf));
}

function hasDailyChange(quote: FundQuote | undefined) {
  return Boolean(
    quote?.dailyChangePercent !== undefined
    && quote.dailyChangePercent !== -100
    && dailyProfitDateKey(quote),
  );
}

function baselineNetValue(history: FundHistoryPoint[] | undefined, date?: string) {
  if (!history?.length || !date) return undefined;
  const target = dateKey(date);
  if (!target) return undefined;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  let candidate: FundHistoryPoint | undefined;
  for (const point of sorted) {
    if (point.date <= target) candidate = point;
    else break;
  }
  return (candidate ?? sorted.find((point) => point.date >= target))?.netValue;
}

function latestNetValue(history: FundHistoryPoint[] | undefined, quote?: FundQuote) {
  return quote?.netValue ?? history?.at(-1)?.netValue;
}

function officialHistoryDailyChange(history: FundHistoryPoint[] | undefined) {
  if (!history || history.length < 2) return undefined;
  const sorted = [...history].filter((point) => point.netValue > 0).sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);
  if (!latest || !previous) return undefined;
  return {
    date: latest.date,
    netValue: latest.netValue,
    dailyChangePercent: ((latest.netValue - previous.netValue) / previous.netValue) * 100,
  };
}

function shouldUseConfirmedNavForDailyProfit(holding: Holding, quote?: FundQuote) {
  const name = `${holding.fundName} ${quote?.name ?? ''}`;
  return Boolean(
    quote?.quoteType === 'estimate'
    && /(QDII|纳斯达克|纳指|标普|道琼斯|美国|海外)/i.test(name),
  );
}

function confirmedQuoteForPortfolioDailyProfit(holding: Holding, quote?: FundQuote, history?: FundHistoryPoint[]) {
  if (!quote || !shouldUseConfirmedNavForDailyProfit(holding, quote)) return quote;
  const confirmed = officialHistoryDailyChange(history);
  if (!confirmed) return quote;
  return {
    ...quote,
    netValue: confirmed.netValue,
    dailyChangePercent: confirmed.dailyChangePercent,
    quoteDate: confirmed.date,
    estimateTime: undefined,
    quoteType: 'official' as const,
    source: `${quote.source}（组合收益按最新官方净值确认）`,
  };
}

function recordedDailyProfitDate(holding: Holding) {
  const direct = (holding.updatedAt || holding.createdAt).match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return direct ?? dateKey(holding.updatedAt || holding.createdAt);
}

function hasFreshRecordedDailyProfit(holding: Holding, asOf: Date) {
  return (
    typeof holding.recordedDailyProfit === 'number'
    && Number.isFinite(holding.recordedDailyProfit)
    && recordedDailyProfitDate(holding) === localDateKey(asOf)
  );
}

function estimatedShares(holding: Holding, quote?: FundQuote, history?: FundHistoryPoint[]) {
  if (holding.shares) return holding.shares;
  if (!holding.recordedMarketValue) return undefined;
  const baseline = baselineNetValue(history, holding.purchaseDate ?? holding.createdAt) ?? latestNetValue(history, quote);
  if (!baseline || baseline <= 0) return undefined;
  return holding.recordedMarketValue / baseline;
}

function dailyProfit(holding: Holding, quote?: FundQuote, history?: FundHistoryPoint[], marketValue?: number, dailyProfitAvailable = false) {
  if (dailyProfitAvailable && quote?.dailyChangePercent !== undefined) {
    const value = marketValue ?? holdingMarketValue(holding, quote, history);
    const previousValue = value / (1 + quote.dailyChangePercent / 100);
    return value - previousValue;
  }
  return 0;
}

function holdingMarketValue(holding: Holding, quote?: FundQuote, history?: FundHistoryPoint[]) {
  const shares = estimatedShares(holding, quote, history);
  const currentNetValue = latestNetValue(history, quote);
  if (shares && currentNetValue) return shares * currentNetValue;
  return holding.recordedMarketValue ?? 0;
}

function hasValuation(holding: Holding, quote?: FundQuote, history?: FundHistoryPoint[]) {
  if (holding.shares) return Boolean(latestNetValue(history, quote));
  return Boolean(holding.recordedMarketValue);
}

function canonicalFundName(holding: Holding, quote?: FundQuote) {
  if (/^\d{6}$/.test(holding.fundCode) && quote?.name?.trim()) return quote.name.trim();
  return holding.fundName;
}

function buildLedgers(items: PortfolioSummary['items']): PortfolioLedger[] {
  const ledgers = new Map<string, PortfolioLedger>();
  items.forEach((item) => {
    const accountName = item.accountName?.trim() || '默认账本';
    const platform = platformLabels[item.platform ?? 'manual'];
    const key = `${accountName}:${platform}`;
    const next = ledgers.get(key) ?? {
      accountName,
      platform,
      marketValue: 0,
      costAmount: 0,
      profit: 0,
      holdingCount: 0,
    };
    next.marketValue += item.marketValue;
    next.costAmount += item.costAmount;
    next.profit += item.profit;
    next.holdingCount += 1;
    ledgers.set(key, next);
  });
  return Array.from(ledgers.values()).sort((a, b) => b.marketValue - a.marketValue);
}

function buildRiskSignals(summary: Pick<PortfolioSummary, 'items' | 'totalMarketValue' | 'liveQuoteRatio'>): PortfolioSignal[] {
  if (summary.items.length === 0) {
    return [{ title: '等待建仓', detail: '添加持仓后自动生成集中度、净值缺失和赎回费提醒。', tone: 'neutral' }];
  }

  const signals: PortfolioSignal[] = [];
  const largest = [...summary.items].sort((a, b) => b.weight - a.weight)[0];
  if (largest?.weight >= 45) {
    signals.push({ title: '单只集中度偏高', detail: `${largest.fundName} 权重 ${largest.weight.toFixed(1)}%，建议先降到 35% 以下再追加。`, tone: 'danger' });
  } else if (largest?.weight >= 30) {
    signals.push({ title: '关注集中度', detail: `${largest.fundName} 权重 ${largest.weight.toFixed(1)}%，适合用新资金分散到不同风格。`, tone: 'warning' });
  } else {
    signals.push({ title: '集中度健康', detail: '单只基金权重暂未过高，组合分散度处于可观察状态。', tone: 'positive' });
  }

  const missingCount = summary.items.filter((item) => item.quoteStatus === 'missing').length;
  if (missingCount > 0) {
    signals.push({ title: '净值缺失', detail: `${missingCount} 只持仓暂未拿到实时净值，盈亏报告会低估组合市值。`, tone: 'warning' });
  }

  const shortHold = summary.items.find((item) => item.holdingDays !== undefined && item.holdingDays <= 7);
  if (shortHold) {
    signals.push({ title: '7 天赎回提醒', detail: `${shortHold.fundName} 持有约 ${shortHold.holdingDays} 天，真实费率需以销售平台为准。`, tone: 'warning' });
  }

  if (summary.liveQuoteRatio < 80) {
    signals.push({ title: '实时覆盖不足', detail: `当前实时行情覆盖 ${summary.liveQuoteRatio.toFixed(0)}%，建议刷新或补齐基金代码。`, tone: 'neutral' });
  }

  return signals;
}

function buildReportSignals(summary: Pick<PortfolioSummary, 'totalProfit' | 'totalReturnRate' | 'estimatedDailyProfit' | 'dailyProfitAvailable' | 'dailyProfitDate' | 'dailyProfitIsCurrent' | 'items'>): PortfolioSignal[] {
  const best = [...summary.items].sort((a, b) => b.profit - a.profit)[0];
  const weakest = [...summary.items].sort((a, b) => a.profit - b.profit)[0];
  const dailyLabel = summary.dailyProfitIsCurrent ? '今日估算收益' : `${summary.dailyProfitDate ?? '最近行情日'}估算收益`;
  return [
    {
      title: dailyLabel,
      detail: summary.dailyProfitAvailable
        ? `按 ${summary.dailyProfitDate ?? '最近行情日'} 日涨跌估算为 ${summary.estimatedDailyProfit >= 0 ? '+' : ''}${summary.estimatedDailyProfit.toFixed(2)} 元。`
        : '暂无可用日涨跌行情。',
      tone: summary.dailyProfitAvailable ? (summary.estimatedDailyProfit >= 0 ? 'positive' : 'warning') : 'neutral',
    },
    {
      title: '周/月报摘要',
      detail: `累计盈亏 ${summary.totalProfit >= 0 ? '+' : ''}${summary.totalProfit.toFixed(2)} 元，收益率 ${summary.totalReturnRate.toFixed(2)}%。`,
      tone: summary.totalProfit >= 0 ? 'positive' : 'warning',
    },
    {
      title: '贡献拆解',
      detail: best && weakest ? `贡献最高：${best.fundName}；拖累最大：${weakest.fundName}。` : '添加更多持仓后展示贡献最高和拖累最大的基金。',
      tone: 'neutral',
    },
  ];
}

function buildActionSignals(summary: Pick<PortfolioSummary, 'items' | 'totalReturnRate' | 'estimatedDailyProfit'>): PortfolioSignal[] {
  const currentDailyItems = summary.items.filter((item) => item.dailyProfitAvailable);
  const rising = currentDailyItems.filter((item) => (item.quote?.dailyChangePercent ?? 0) > 0).length;
  const falling = currentDailyItems.filter((item) => (item.quote?.dailyChangePercent ?? 0) < 0).length;
  const targetDrift = summary.items.find((item) => item.targetWeight !== undefined && Math.abs(item.weight - item.targetWeight) >= 8);
  return [
    {
      title: '加减仓观察',
      detail: `本地持仓中 ${rising} 只上涨、${falling} 只下跌；这是组合内观察榜，不代表全网用户行为。`,
      tone: rising >= falling ? 'positive' : 'warning',
    },
    {
      title: '目标止盈',
      detail: summary.totalReturnRate >= 12 ? '组合收益率超过 12%，可考虑分批落袋并保留底仓。' : '组合尚未触发 12% 教育型止盈线，优先按计划复盘。',
      tone: summary.totalReturnRate >= 12 ? 'warning' : 'neutral',
    },
    {
      title: '权重偏离',
      detail: targetDrift ? `${targetDrift.fundName} 偏离目标权重 ${Math.abs(targetDrift.weight - (targetDrift.targetWeight ?? 0)).toFixed(1)}%。` : '暂无明显目标权重偏离，可在导入数据里补 targetWeight。',
      tone: targetDrift ? 'warning' : 'positive',
    },
  ];
}

export function calculatePortfolioSummary(
  holdings: Holding[],
  quotes: Record<string, FundQuote | undefined>,
  histories: Record<string, FundHistoryPoint[] | undefined> = {},
  asOf: Date = new Date(),
): PortfolioSummary {
  const totalMarketValue = holdings.reduce((sum, holding) => {
    const history = histories[holding.fundCode];
    const quote = confirmedQuoteForPortfolioDailyProfit(holding, quotes[holding.fundCode], history);
    return sum + holdingMarketValue(holding, quote, history);
  }, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costAmount, 0);

  const items = holdings.map((holding) => {
    const rawQuote = quotes[holding.fundCode];
    const history = histories[holding.fundCode];
    const quote = confirmedQuoteForPortfolioDailyProfit(holding, rawQuote, history);
    const marketValue = holdingMarketValue(holding, quote, history);
    const profit = marketValue - holding.costAmount;
    const returnRate = holding.costAmount > 0 ? percent(profit / holding.costAmount) : 0;
    const weight = totalMarketValue > 0 ? percent(marketValue / totalMarketValue) : 0;
    const useRecordedDailyProfit = hasFreshRecordedDailyProfit(holding, asOf);
    const dailyProfitDate = useRecordedDailyProfit ? recordedDailyProfitDate(holding) : dailyProfitDateKey(quote);
    const dailyProfitAvailable = useRecordedDailyProfit || hasDailyChange(quote);
    const dailyProfitIsCurrent = isCurrentTradingDay(dailyProfitDate, asOf);
    const estimatedDailyProfit = useRecordedDailyProfit ? holding.recordedDailyProfit! : dailyProfit(holding, quote, history, marketValue, dailyProfitAvailable);

    return {
      ...holding,
      fundName: canonicalFundName(holding, quote),
      quote,
      marketValue,
      profit,
      returnRate,
      weight,
      estimatedDailyProfit,
      dailyProfitAvailable,
      dailyProfitDate,
      dailyProfitIsCurrent,
      holdingDays: holdingDays(holding.purchaseDate),
      quoteStatus: hasValuation(holding, quote, history) ? ('ok' as const) : ('missing' as const),
    };
  });

  const totalProfit = totalMarketValue - totalCost;
  const totalReturnRate = totalCost > 0 ? percent(totalProfit / totalCost) : 0;
  const estimatedDailyProfit = items.reduce((sum, item) => sum + item.estimatedDailyProfit, 0);
  const dailyProfitAvailable = items.some((item) => item.dailyProfitAvailable);
  const dailyProfitDates = items
    .filter((item) => item.dailyProfitAvailable)
    .map((item) => item.dailyProfitDate)
    .filter((date): date is string => Boolean(date));
  const dailyProfitDate = dailyProfitDates.sort((a, b) => b.localeCompare(a))[0];
  const dailyProfitIsCurrent = isCurrentTradingDay(dailyProfitDate, asOf);
  const liveQuoteRatio = holdings.length > 0 ? percent(items.filter((item) => item.quoteStatus === 'ok').length / holdings.length) : 0;
  const ledgers = buildLedgers(items);
  const baseSummary = {
    items,
    totalMarketValue,
    liveQuoteRatio,
    totalProfit,
    totalReturnRate,
    estimatedDailyProfit,
    dailyProfitAvailable,
    dailyProfitDate,
    dailyProfitIsCurrent,
  };

  return {
    totalCost,
    totalMarketValue,
    totalProfit,
    totalReturnRate,
    estimatedDailyProfit,
    dailyProfitAvailable,
    dailyProfitDate,
    dailyProfitIsCurrent,
    liveQuoteRatio,
    ledgers,
    riskSignals: buildRiskSignals(baseSummary),
    reportSignals: buildReportSignals(baseSummary),
    actionSignals: buildActionSignals(baseSummary),
    plan: {
      title: totalProfit >= 0 ? '盈利期定投节奏' : '回撤期补仓节奏',
      amount: Math.max(100, Math.round((totalCost || 1000) * 0.03)),
      cadence: '每周 / 每月分批',
      detail: totalProfit >= 0 ? '盈利时降低单次买入金额，优先检查目标权重和止盈线。' : '回撤时只用闲钱分批，避免一次性补仓放大波动。',
    },
    items,
  };
}

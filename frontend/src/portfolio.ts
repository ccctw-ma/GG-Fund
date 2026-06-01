import type { FundQuote, Holding, PortfolioLedger, PortfolioSignal, PortfolioSummary } from './types';

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

function dailyProfit(holding: Holding, quote?: FundQuote) {
  if (!quote?.dailyChangePercent || quote.dailyChangePercent === -100) return 0;
  const marketValue = holding.shares * quote.netValue;
  const previousValue = marketValue / (1 + quote.dailyChangePercent / 100);
  return marketValue - previousValue;
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

function buildReportSignals(summary: Pick<PortfolioSummary, 'totalProfit' | 'totalReturnRate' | 'estimatedDailyProfit' | 'items'>): PortfolioSignal[] {
  const best = [...summary.items].sort((a, b) => b.profit - a.profit)[0];
  const weakest = [...summary.items].sort((a, b) => a.profit - b.profit)[0];
  return [
    {
      title: '今日估算收益',
      detail: `按已返回日涨跌估算为 ${summary.estimatedDailyProfit >= 0 ? '+' : ''}${summary.estimatedDailyProfit.toFixed(2)} 元。`,
      tone: summary.estimatedDailyProfit >= 0 ? 'positive' : 'warning',
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
  const rising = summary.items.filter((item) => (item.quote?.dailyChangePercent ?? 0) > 0).length;
  const falling = summary.items.filter((item) => (item.quote?.dailyChangePercent ?? 0) < 0).length;
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
    const estimatedDailyProfit = dailyProfit(holding, quote);

    return {
      ...holding,
      quote,
      marketValue,
      profit,
      returnRate,
      weight,
      estimatedDailyProfit,
      holdingDays: holdingDays(holding.purchaseDate),
      quoteStatus: quote ? ('ok' as const) : ('missing' as const),
    };
  });

  const totalProfit = totalMarketValue - totalCost;
  const totalReturnRate = totalCost > 0 ? percent(totalProfit / totalCost) : 0;
  const estimatedDailyProfit = items.reduce((sum, item) => sum + item.estimatedDailyProfit, 0);
  const liveQuoteRatio = holdings.length > 0 ? percent(items.filter((item) => item.quoteStatus === 'ok').length / holdings.length) : 0;
  const ledgers = buildLedgers(items);
  const baseSummary = {
    items,
    totalMarketValue,
    liveQuoteRatio,
    totalProfit,
    totalReturnRate,
    estimatedDailyProfit,
  };

  return {
    totalCost,
    totalMarketValue,
    totalProfit,
    totalReturnRate,
    estimatedDailyProfit,
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

'use client';

import { BookOpen, Compass, ShieldAlert, TrendingUp } from 'lucide-react';
import { researchCatalog } from '../researchCatalog';
import type { FundQuote, IndexQuote, PortfolioSummary } from '../types';

type BeginnerGuideProps = {
  selectedFund?: FundQuote;
  leadingIndex?: IndexQuote;
  summary: PortfolioSummary;
};

function explainMarket(index?: IndexQuote) {
  if (!index) return '大盘数据同步中。先不要急着判断方向，等指数和基金净值都加载完成后再看。';
  const direction = index.changePercent >= 0 ? '偏暖' : '偏冷';
  const action = Math.abs(index.changePercent) > 1.5 ? '波动较大，适合降低单次操作金额。' : '波动可控，适合继续观察基金自身表现。';
  return `${index.name} 当前 ${index.changePercent.toFixed(2)}%，市场情绪${direction}。${action}`;
}

function explainPortfolio(summary: PortfolioSummary) {
  if (!summary.items.length) return '你还没有录入持仓。先搜索基金并加入持仓，系统才能计算盈亏、权重和下一步路径。';
  if (summary.totalReturnRate >= 8) return `组合当前盈利 ${summary.totalReturnRate.toFixed(2)}%，优先考虑分批止盈或继续持有，不建议因为上涨一次性追高。`;
  if (summary.totalReturnRate <= -8) return `组合当前回撤 ${Math.abs(summary.totalReturnRate).toFixed(2)}%，先确认资金期限和基金逻辑，再决定是否分批减仓。`;
  return `组合当前收益 ${summary.totalReturnRate.toFixed(2)}%，处于可复盘区间，重点观察大盘、基金净值和持仓占比。`;
}

export function BeginnerGuide({ selectedFund, leadingIndex, summary }: BeginnerGuideProps) {
  const fundText = selectedFund
    ? `${selectedFund.name} 当前净值 ${selectedFund.netValue}。净值本身不等于“贵”，真正影响你的是买入成本、持有份额和未来净值变化。`
    : '先选择一只基金。系统会把净值、估算涨跌、历史趋势和 AI 报告放到同一条决策线上。';
  const cards = [
    {
      title: '1. 先看基金是什么',
      icon: BookOpen,
      text: fundText,
    },
    {
      title: '2. 再看市场温度',
      icon: TrendingUp,
      text: explainMarket(leadingIndex),
    },
    {
      title: '3. 看自己的持仓状态',
      icon: ShieldAlert,
      text: `${explainPortfolio(summary)} 单只基金权重过高时，先降低集中度，再考虑加仓或止盈。`,
    },
    {
      title: '4. 最后走行动路径',
      icon: Compass,
      text: '风险等级不是收益承诺。一年内要用的钱优先保守；三年以上闲钱可考虑定投或分批持有；遇到大涨大跌都先拆成小步骤执行，并坚持每月复盘。',
    },
  ];

  return (
    <section className="beginner-guide lg:col-span-2" aria-labelledby="beginner-guide-title">
      <div className="beginner-guide-copy">
        <span className="section-kicker">Beginner Decision Map</span>
        <h2 id="beginner-guide-title">基金小白决策地图</h2>
        <p>把“我买的是什么、现在亏赚多少、大盘环境如何、下一步该怎么办”拆成四个问题，避免只凭当天涨跌做决定。</p>
      </div>
      <div className="beginner-guide-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="beginner-guide-card" key={card.title}>
              <span><Icon className="h-4 w-4" /></span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          );
        })}
      </div>
      <div className="decision-ladder" aria-label="基金操作路径">
        <strong>默认路径：</strong>
        {researchCatalog.decisionSteps.map((step) => (
          <span title={step.detail} key={step.title}>
            {step.title}
          </span>
        ))}
      </div>
    </section>
  );
}

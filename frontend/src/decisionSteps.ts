export type DecisionStep = {
  title: string;
  detail: string;
};

export const decisionSteps = [
  { title: '确认资金期限', detail: '一年内要用的钱优先稳健，三年以上闲钱才适合承受权益波动。' },
  { title: '匹配风险等级', detail: '先看 R1-R5 风险，再看基金类型、波动和最大回撤。' },
  { title: '观察市场温度', detail: '把指数涨跌、行业热度和基金估算放在同一张地图里。' },
  { title: '检查持仓权重', detail: '单只基金过高时优先降集中度，不因短期涨跌孤注一掷。' },
  { title: '分批执行与复盘', detail: '把买入、减仓、止盈、观察拆成小步骤，每月复盘一次。' },
] satisfies DecisionStep[];

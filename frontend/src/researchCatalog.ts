import { BarChart3, BellRing, BookOpenCheck, CircleDollarSign, Compass, Database, FileSearch, Landmark, LineChart, Network, PieChart, Scale, ShieldCheck, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type CatalogStatus = 'live' | 'connectable' | 'roadmap';

export type AssetNavigationItem = {
  title: string;
  description: string;
  status: CatalogStatus;
  sourceHint: string;
  icon: LucideIcon;
};

export type ToolCapability = {
  title: string;
  description: string;
  status: CatalogStatus;
};

export type ToolGroup = {
  title: string;
  summary: string;
  icon: LucideIcon;
  capabilities: ToolCapability[];
};

export type SourceGroup = {
  title: string;
  description: string;
  examples: string[];
  status: CatalogStatus;
  icon: LucideIcon;
};

export type OpenSourceCapability = {
  name: string;
  description: string;
  status: CatalogStatus;
  bestFor: string;
};

export type DecisionStep = {
  title: string;
  detail: string;
};

export const statusLabels: Record<CatalogStatus, string> = {
  live: '已接入',
  connectable: '可接入',
  roadmap: '路线图',
};

export const researchCatalog = {
  assetNavigation: [
    { title: '全球核心指数', description: 'A 股、港股、美股核心指数构成实时市场雷达。', status: 'live', sourceHint: '东方财富 push2 / 腾讯行情备用源', icon: BarChart3 },
    { title: '基金与 A 股行情', description: '基金搜索、盘中估算、A 股实时价格、历史净值曲线与自选。', status: 'live', sourceHint: '天天基金 / 东方财富 / 腾讯证券', icon: LineChart },
    { title: 'ETF / LOF', description: '借鉴集思录与基金门户的 ETF、LOF、指数基金专题入口。', status: 'connectable', sourceHint: 'ETF/LOF 专题数据源待产品化', icon: PieChart },
    { title: 'REITs', description: '面向基础设施公募 REITs 的价格、折溢价和公告观察。', status: 'roadmap', sourceHint: '交易所与集思录式专题', icon: Landmark },
    { title: '债券与可转债', description: '转债、新债、债券基金与低波动资产的候选池。', status: 'roadmap', sourceHint: '集思录 / 交易所公开数据', icon: Scale },
    { title: '新债 / 新发基金', description: '新产品日历、申购提醒、发行资料与风险说明。', status: 'roadmap', sourceHint: '投资日历能力路线图', icon: BellRing },
    { title: '港美与全球观察', description: '全球资产表现作为基金配置的宏观观察窗口。', status: 'connectable', sourceHint: '全球指数已接入，ETF 数据后续扩展', icon: Compass },
  ] satisfies AssetNavigationItem[],
  toolGroups: [
    {
      title: '基金筛选、对比与诊断',
      summary: '参考好买基金等站点，把找基金、比基金、诊基金从净值页里独立出来。',
      icon: FileSearch,
      capabilities: [
        { title: '基金发现', description: '用代码、名称和热门列表进入基金详情。', status: 'live' },
        { title: '横向对比', description: '未来按收益、回撤、波动、估算涨跌进行多基金对比。', status: 'connectable' },
        { title: '基金诊断', description: '结合历史净值、回撤、动量和风险等级输出诊断摘要。', status: 'live' },
      ],
    },
    {
      title: '账户、持仓与定投路径',
      summary: '以模拟账户承接交易网站的账户闭环，不提供真实交易执行。',
      icon: WalletCards,
      capabilities: [
        { title: '本地持仓', description: '本地保存份额、成本、市值、收益和组合权重。', status: 'live' },
        { title: '自选观察', description: '关注基金但不计入持仓，适合买前跟踪。', status: 'live' },
        { title: '定投计划', description: '按资金期限和风险等级生成教育型分批行动路线。', status: 'connectable' },
      ],
    },
    {
      title: '资讯、社区与观点流',
      summary: '借鉴东方财富、雪球、同花顺的信息分发形态，先做入口说明与可信边界。',
      icon: Network,
      capabilities: [
        { title: '7x24 与新闻流', description: '重大市场信息、基金经理观点和产品动态的聚合方向。', status: 'roadmap' },
        { title: '社区观点', description: '达人、组合和讨论可作为情绪观察，不作为买卖依据。', status: 'roadmap' },
        { title: '研究摘要', description: 'AI 把行情、回撤、动量和观察点组织成新手可读报告。', status: 'live' },
      ],
    },
  ] satisfies ToolGroup[],
  sourceGroups: [
    { title: '行情与数据门户', description: '覆盖行情中心、数据中心、基金频道与指数入口。', examples: ['东方财富', '同花顺', '天天基金'], status: 'live', icon: Database },
    { title: '基金研究与交易入口', description: '覆盖基金筛选、基金对比、基金诊断、定投和账户管理的产品形态。', examples: ['好买基金', '天天基金', '基金销售平台'], status: 'connectable', icon: CircleDollarSign },
    { title: '社区与组合内容', description: '搜索股票、用户、组合与观点，辅助理解市场情绪。', examples: ['雪球', '投资社区', '达人观点'], status: 'roadmap', icon: BookOpenCheck },
    { title: '官方公告与高信任披露', description: '上市公司公告、基金公告、债券公告和衍生品公告应单列核验。', examples: ['上交所', '深交所', '基金公告'], status: 'roadmap', icon: ShieldCheck },
  ] satisfies SourceGroup[],
  openSourceStack: [
    { name: 'AKShare / AKTools', description: 'Python 财经数据接口与 HTTP API 思路，可作为未来数据接入底座。', status: 'connectable', bestFor: '行情、基金、宏观与另类数据采集' },
    { name: 'Qlib', description: '微软开源量化平台，覆盖数据处理、模型训练、回测和组合优化。', status: 'roadmap', bestFor: '研究工作流与策略实验' },
    { name: 'Tushare', description: '中文金融数据接口生态，适合补充结构化市场数据。', status: 'roadmap', bestFor: '股票、基金、财务与日历数据' },
    { name: 'Backtrader', description: '经典 Python 回测框架，可启发未来策略验证模块。', status: 'roadmap', bestFor: '策略回测与交易规则验证' },
    { name: 'Pyfolio', description: '投资组合绩效与风险归因工具，可启发收益/回撤报告。', status: 'roadmap', bestFor: '组合绩效归因' },
    { name: 'Streamlit', description: '快速构建研究仪表盘的开源框架，可借鉴交互式分析体验。', status: 'roadmap', bestFor: '研究原型与可视化工作台' },
  ] satisfies OpenSourceCapability[],
  decisionSteps: [
    { title: '确认资金期限', detail: '一年内要用的钱优先稳健，三年以上闲钱才适合承受权益波动。' },
    { title: '匹配风险等级', detail: '先看 R1-R5 风险，再看基金类型、波动和最大回撤。' },
    { title: '观察市场温度', detail: '把指数涨跌、行业热度和基金估算放在同一张地图里。' },
    { title: '检查持仓权重', detail: '单只基金过高时优先降集中度，不因短期涨跌孤注一掷。' },
    { title: '分批执行与复盘', detail: '把买入、减仓、止盈、观察拆成小步骤，每月复盘一次。' },
  ] satisfies DecisionStep[],
};

export function getLiveCatalogItems() {
  return researchCatalog.assetNavigation.filter((item) => item.status === 'live');
}

export function getRoadmapCatalogItems() {
  return researchCatalog.assetNavigation.filter((item) => item.status === 'roadmap');
}

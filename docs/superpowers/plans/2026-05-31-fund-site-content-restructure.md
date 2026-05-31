# Fund Site Content Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild GG Fund into a complete China-focused fund/ETF/market research workstation with a polished content architecture, tests, and README coverage.

**Architecture:** Add a typed static research catalog that models asset navigation, tool categories, research sources, open-source research infrastructure, and risk guidance. Render it through focused React components inside the existing Next `/app` workspace while preserving current API, local portfolio, auth, AI analysis, and Cloudflare-first deployment boundaries.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, lucide-react, Recharts, Vitest, Playwright, Midscene optional E2E.

---

## File Structure

- Create `frontend/src/researchCatalog.ts`: typed content catalog and helper functions for statuses, assets, tool groups, source groups, open-source capabilities, and action ladder.
- Create `frontend/src/components/ToolUniverse.tsx`: visual catalog section for multi-asset navigation, tool matrix, trusted sources, and open-source research stack.
- Modify `frontend/src/components/BeginnerGuide.tsx`: expand beginner decision guidance with risk profile and monthly review framing without changing external props.
- Modify `frontend/src/App.tsx`: import and render `ToolUniverse`; update hero/features copy to reflect the new full-site positioning.
- Modify `frontend/src/styles.css`: add responsive, polished classes for the new catalog section while matching the existing glassmorphism style.
- Modify `frontend/src/App.test.tsx`: assert the new site-wide content architecture renders and legacy capabilities remain.
- Modify `frontend/src/components/components.test.tsx`: add component-level coverage for `ToolUniverse` and enhanced beginner guide branches.
- Modify `tests/fund-flow.spec.ts` and `tests/e2e/next-core.spec.ts`: verify the new content architecture through browser E2E while preserving fund search, auth, AI, portfolio, import/export, and error flows.
- Modify `README.md` and `README.en.md`: document the reconstructed site, capability map, source inspiration, roadmap-vs-live status, and test commands.

## Task 1: Add the Typed Research Catalog

**Files:**
- Create: `frontend/src/researchCatalog.ts`
- Test: `frontend/src/components/components.test.tsx`

- [ ] **Step 1: Write the failing component test import and assertions**

Append the following import near the top of `frontend/src/components/components.test.tsx`:

```ts
import { researchCatalog, getLiveCatalogItems, getRoadmapCatalogItems } from '../researchCatalog';
```

Append this test inside `describe('dashboard components', () => { ... })`:

```ts
  it('exposes a complete typed research catalog with live and roadmap capabilities', () => {
    expect(researchCatalog.assetNavigation.map((item) => item.title)).toEqual([
      'A 股指数',
      '基金净值',
      'ETF / LOF',
      'REITs',
      '债券与可转债',
      '新债 / 新发基金',
      '港美与全球观察',
    ]);
    expect(researchCatalog.toolGroups.map((group) => group.title)).toContain('基金筛选、对比与诊断');
    expect(researchCatalog.sourceGroups.map((group) => group.title)).toContain('官方公告与高信任披露');
    expect(researchCatalog.openSourceStack.map((item) => item.name)).toEqual(['AKShare / AKTools', 'Qlib', 'Tushare', 'Backtrader', 'Pyfolio', 'Streamlit']);
    expect(getLiveCatalogItems().some((item) => item.title === '基金净值')).toBe(true);
    expect(getRoadmapCatalogItems().some((item) => item.title === '港美与全球观察')).toBe(true);
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
bun run test -- frontend/src/components/components.test.tsx
```

Expected: FAIL with a module resolution error for `../researchCatalog`.

- [ ] **Step 3: Create the catalog implementation**

Create `frontend/src/researchCatalog.ts` with this exact content:

```ts
import { BadgeCheck, BarChart3, BellRing, BookOpenCheck, CandlestickChart, CircleDollarSign, Compass, Database, FileSearch, Landmark, LineChart, Network, PieChart, Repeat, Scale, ShieldCheck, Sparkles, TrendingUp, WalletCards } from 'lucide-react';
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
    { title: 'A 股指数', description: '上证指数、深证成指、创业板指、沪深 300 的实时市场温度。', status: 'live', sourceHint: '东方财富 push2 / 腾讯行情备用源', icon: BarChart3 },
    { title: '基金净值', description: '基金搜索、盘中估算、官方净值、历史净值曲线与自选。', status: 'live', sourceHint: '天天基金 / 东方财富公开接口', icon: LineChart },
    { title: 'ETF / LOF', description: '借鉴集思录与基金门户的 ETF、LOF、指数基金专题入口。', status: 'connectable', sourceHint: 'ETF/LOF 专题数据源待产品化', icon: PieChart },
    { title: 'REITs', description: '面向基础设施公募 REITs 的价格、折溢价和公告观察。', status: 'roadmap', sourceHint: '交易所与集思录式专题', icon: Landmark },
    { title: '债券与可转债', description: '转债、新债、债券基金与低波动资产的候选池。', status: 'roadmap', sourceHint: '集思录 / 交易所公开数据', icon: Scale },
    { title: '新债 / 新发基金', description: '新产品日历、申购提醒、发行资料与风险说明。', status: 'roadmap', sourceHint: '投资日历能力路线图', icon: BellRing },
    { title: '港美与全球观察', description: '全球资产表现作为基金配置的宏观观察窗口。', status: 'roadmap', sourceHint: '全球指数与 ETF 数据后续接入', icon: Compass },
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
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
bun run test -- frontend/src/components/components.test.tsx
```

Expected: PASS for the new catalog test and existing component tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/researchCatalog.ts frontend/src/components/components.test.tsx
git commit -m "feat: add fund research catalog"
```

## Task 2: Render the Tool Universe Component

**Files:**
- Create: `frontend/src/components/ToolUniverse.tsx`
- Modify: `frontend/src/components/components.test.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing component render test**

Add this import to `frontend/src/components/components.test.tsx`:

```ts
import { ToolUniverse } from './ToolUniverse';
```

Append this test inside the existing describe block:

```ts
  it('renders the complete tool universe with live, connectable, and roadmap labels', () => {
    const universe = render(<ToolUniverse />);
    roots.push(universe.root);

    expect(universe.container.textContent).toContain('全景工具宇宙');
    expect(universe.container.textContent).toContain('A 股指数');
    expect(universe.container.textContent).toContain('基金筛选、对比与诊断');
    expect(universe.container.textContent).toContain('官方公告与高信任披露');
    expect(universe.container.textContent).toContain('AKShare / AKTools');
    expect(universe.container.textContent).toContain('已接入');
    expect(universe.container.textContent).toContain('可接入');
    expect(universe.container.textContent).toContain('路线图');
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
bun run test -- frontend/src/components/components.test.tsx
```

Expected: FAIL with a module resolution error for `./ToolUniverse`.

- [ ] **Step 3: Create `ToolUniverse`**

Create `frontend/src/components/ToolUniverse.tsx` with this exact content:

```tsx
'use client';

import { ArrowUpRight, Layers3 } from 'lucide-react';
import { researchCatalog, statusLabels, type CatalogStatus } from '../researchCatalog';

const statusTone: Record<CatalogStatus, string> = {
  live: 'catalog-status-live',
  connectable: 'catalog-status-connectable',
  roadmap: 'catalog-status-roadmap',
};

function StatusPill({ status }: { status: CatalogStatus }) {
  return <span className={`catalog-status ${statusTone[status]}`}>{statusLabels[status]}</span>;
}

export function ToolUniverse() {
  return (
    <section className="tool-universe glass-section" id="tool-universe" aria-labelledby="tool-universe-title">
      <div className="section-heading tool-universe-heading">
        <span className="section-kicker">Market Tool Universe</span>
        <h2 id="tool-universe-title">全景工具宇宙</h2>
        <p>
          把知乎工具清单常见的“行情、筛选、对比、交易入口、资讯、公告、量化研究”重组为 GG Fund 的一站式能力地图；
          已上线能力直接进入工作台，未接入能力明确标注为可接入或路线图。
        </p>
      </div>

      <div className="asset-rail" aria-label="多资产行情导航">
        {researchCatalog.assetNavigation.map((asset) => {
          const Icon = asset.icon;
          return (
            <article className="asset-card" key={asset.title}>
              <div className="asset-card-topline">
                <span className="asset-icon"><Icon className="h-5 w-5" /></span>
                <StatusPill status={asset.status} />
              </div>
              <h3>{asset.title}</h3>
              <p>{asset.description}</p>
              <small>{asset.sourceHint}</small>
            </article>
          );
        })}
      </div>

      <div className="tool-matrix" aria-label="基金研究工具矩阵">
        {researchCatalog.toolGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article className="tool-group-card" key={group.title}>
              <div className="tool-group-heading">
                <span className="feature-icon"><Icon className="h-5 w-5" /></span>
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.summary}</p>
                </div>
              </div>
              <div className="capability-list">
                {group.capabilities.map((capability) => (
                  <div className="capability-row" key={capability.title}>
                    <div>
                      <strong>{capability.title}</strong>
                      <span>{capability.description}</span>
                    </div>
                    <StatusPill status={capability.status} />
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="source-grid" aria-label="研究来源与披露中心">
        {researchCatalog.sourceGroups.map((source) => {
          const Icon = source.icon;
          return (
            <article className="source-card" key={source.title}>
              <div className="source-card-head">
                <Icon className="h-5 w-5" />
                <StatusPill status={source.status} />
              </div>
              <h3>{source.title}</h3>
              <p>{source.description}</p>
              <div className="source-tags">
                {source.examples.map((example) => <span key={example}>{example}</span>)}
              </div>
            </article>
          );
        })}
      </div>

      <div className="open-source-lab" aria-label="开源研究底座">
        <div>
          <span className="section-kicker">Open Research Stack</span>
          <h3><Layers3 className="h-5 w-5" /> 开源研究底座</h3>
          <p>这些能力来自开源社区与量化研究生态，当前作为产品路线图呈现，不代表已在 Cloudflare Worker 内运行 Python 量化服务。</p>
        </div>
        <div className="open-source-grid">
          {researchCatalog.openSourceStack.map((item) => (
            <article key={item.name}>
              <div className="open-source-card-head">
                <strong>{item.name}</strong>
                <StatusPill status={item.status} />
              </div>
              <p>{item.description}</p>
              <small>{item.bestFor}</small>
            </article>
          ))}
        </div>
      </div>

      <a className="ghost-cta tool-universe-cta" href="#workspace">进入实时基金工作台 <ArrowUpRight className="h-4 w-4" /></a>
    </section>
  );
}
```

- [ ] **Step 4: Add component styles**

Append this CSS to `frontend/src/styles.css` after the `.feature-card a` rule:

```css
.tool-universe { display: grid; gap: 22px; }
.tool-universe-heading { max-width: 980px; }
.asset-rail { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
.asset-card, .tool-group-card, .source-card, .open-source-lab {
  border: 1px solid var(--glass-border);
  background: rgba(255,255,255,.07);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 18px 50px rgba(0,0,0,.15);
  backdrop-filter: blur(18px);
}
.asset-card { border-radius: 26px; padding: 18px; }
.asset-card-topline, .tool-group-heading, .source-card-head, .open-source-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.asset-icon { display: grid; height: 42px; width: 42px; place-items: center; border-radius: 16px; background: rgba(140,200,255,.13); color: var(--blue); }
.asset-card h3, .tool-group-card h3, .source-card h3, .open-source-lab h3 { margin: 14px 0 8px; color: var(--text-strong); font-weight: 950; letter-spacing: -.02em; }
.asset-card p, .tool-group-card p, .source-card p, .open-source-lab p, .open-source-grid p { margin: 0; color: var(--text-muted); line-height: 1.7; font-weight: 700; }
.asset-card small, .open-source-grid small { display: block; margin-top: 12px; color: var(--gold-soft); font-size: .76rem; font-weight: 850; line-height: 1.5; }
.catalog-status { display: inline-flex; flex: none; align-items: center; border-radius: 999px; padding: 6px 9px; font-size: .68rem; font-weight: 950; line-height: 1; }
.catalog-status-live { background: rgba(125,226,184,.14); color: var(--mint); }
.catalog-status-connectable { background: rgba(140,200,255,.14); color: var(--blue); }
.catalog-status-roadmap { background: rgba(244,183,64,.14); color: var(--gold-soft); }
.tool-matrix { display: grid; gap: 14px; }
@media (min-width: 980px) { .tool-matrix { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.tool-group-card { border-radius: 30px; padding: 22px; }
.tool-group-heading { justify-content: flex-start; }
.tool-group-heading h3 { margin-top: 0; }
.capability-list { margin-top: 18px; display: grid; gap: 10px; }
.capability-row { display: grid; gap: 10px; border-radius: 20px; background: rgba(4,17,31,.28); padding: 13px; }
@media (min-width: 560px) { .capability-row { grid-template-columns: minmax(0, 1fr) auto; align-items: start; } }
.capability-row strong, .capability-row span { display: block; }
.capability-row strong { color: var(--text-strong); font-weight: 950; }
.capability-row span { margin-top: 4px; color: var(--text-muted); font-size: .84rem; line-height: 1.6; font-weight: 700; }
.source-grid { display: grid; gap: 14px; }
@media (min-width: 820px) { .source-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.source-card { border-radius: 26px; padding: 18px; }
.source-card-head svg { color: var(--gold-soft); }
.source-tags { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 7px; }
.source-tags span { border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: rgba(255,255,255,.07); color: var(--text-main); padding: 6px 9px; font-size: .75rem; font-weight: 850; }
.open-source-lab { display: grid; gap: 18px; border-radius: 32px; padding: clamp(20px, 3vw, 30px); background: linear-gradient(135deg, rgba(4,17,31,.54), rgba(255,255,255,.07)); }
.open-source-lab h3 { display: flex; align-items: center; gap: 8px; font-size: 1.45rem; }
.open-source-grid { display: grid; gap: 10px; }
@media (min-width: 760px) { .open-source-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1160px) { .open-source-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.open-source-grid article { border: 1px solid rgba(255,255,255,.12); border-radius: 22px; background: rgba(255,255,255,.06); padding: 15px; }
.open-source-card-head strong { color: var(--text-strong); }
.tool-universe-cta { width: fit-content; }
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run:

```bash
bun run test -- frontend/src/components/components.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ToolUniverse.tsx frontend/src/components/components.test.tsx frontend/src/styles.css
git commit -m "feat: render investment tool universe"
```

## Task 3: Integrate the New Content Architecture into the App

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `tests/e2e/next-core.spec.ts`

- [ ] **Step 1: Write failing App assertions**

In `frontend/src/App.test.tsx`, update the first test assertions to this block:

```ts
    expect(container.textContent).toContain('基金研究操作系统');
    expect(container.textContent).toContain('账户总览');
    expect(container.textContent).toContain('全景工具宇宙');
    expect(container.textContent).toContain('ETF / LOF');
    expect(container.textContent).toContain('官方公告与高信任披露');
    expect(container.textContent).toContain('开源研究底座');
    expect(container.textContent).not.toContain('安全与隐私');
    expect(container.textContent).not.toContain('下载移动端');
    expect(container.textContent).not.toContain('移动端');
    expect(container.textContent).toContain('个人信息');
    expect(container.textContent).toContain('未登录');
    expect(container.textContent).toContain('Supabase 邮箱登录');
    expect(container.textContent).toContain('发送 Magic Link / OTP');
    expect(container.textContent).toContain('中国基金行情');
    expect(container.textContent).not.toContain('OTP / OAuth 登录');
```

In `tests/e2e/next-core.spec.ts`, update the redirect test expectations to include:

```ts
  await expect(page.getByText('基金研究操作系统').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '全景工具宇宙' })).toBeVisible();
  await expect(page.getByText('ETF / LOF').first()).toBeVisible();
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run:

```bash
bun run test -- frontend/src/App.test.tsx
bun run test:e2e -- tests/e2e/next-core.spec.ts
```

Expected: App test FAIL because new copy is not rendered; E2E may also FAIL on missing text.

- [ ] **Step 3: Import and render `ToolUniverse` in `App.tsx`**

Add this import after `SettingsPanel` in `frontend/src/App.tsx`:

```ts
import { ToolUniverse } from './components/ToolUniverse';
```

Replace `heroStats` with:

```ts
const heroStats = [
  { label: '实时行情', value: '指数 + 基金', detail: '公开数据源 + fallback' },
  { label: '研究工具', value: '8 类能力', detail: '筛选 / 对比 / 诊断 / 公告' },
  { label: '开源底座', value: 'AKShare · Qlib', detail: '数据与量化路线图' },
];
```

Replace `transactionFeatures` with:

```ts
const transactionFeatures = [
  { title: '基金搜索与估值', description: '输入基金代码或名称，查看盘中估算、官方净值、历史走势和自选状态。', icon: LineChart },
  { title: '筛选、对比与诊断', description: '把好买式筛选、对比、诊断抽象为 GG Fund 的基金研究工具层。', icon: BarChart3 },
  { title: '持仓与分批行动', description: '用本地持仓、收益、权重和新手路径承接定投、止盈、减仓等教育决策。', icon: WalletCards },
  { title: '公告、资讯与开源研究', description: '把东方财富、雪球、同花顺、交易所披露和 AKShare/Qlib 能力纳入路线图。', icon: Database },
];
```

Replace the hero title and subtitle with:

```tsx
<h2 className="hero-title">基金研究操作系统，把行情、工具、公告、组合与 AI 装进一张专业工作台。</h2>
<p className="hero-subtitle">
  GG Fund 重构为面向中国基金投资者的全景工具站：实时基金净值、ETF/LOF/REITs/转债路线图、官方披露、资讯社区、开源量化底座和本地组合分析在同一个可信界面里串起来。
</p>
```

Insert `<ToolUniverse />` after the closing `</section>` for the existing `features` section and before `<section className="workspace-section" ...>`:

```tsx
          <ToolUniverse />
```

Update the workspace paragraph to:

```tsx
<p>保留现有实时数据、基金搜索、AI 分析、账户登录和本地备份能力，并接入全新的工具宇宙、研究来源和开源能力路线图。</p>
```

- [ ] **Step 4: Run focused tests to verify they pass**

Run:

```bash
bun run test -- frontend/src/App.test.tsx frontend/src/components/components.test.tsx
bun run test:e2e -- tests/e2e/next-core.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx tests/e2e/next-core.spec.ts
git commit -m "feat: integrate fund tool universe"
```

## Task 4: Expand Beginner Decision Guidance

**Files:**
- Modify: `frontend/src/components/BeginnerGuide.tsx`
- Modify: `frontend/src/components/components.test.tsx`

- [ ] **Step 1: Write failing test assertions**

In the `renders beginner decision guidance for selected funds` test in `frontend/src/components/components.test.tsx`, add:

```ts
    expect(guide.container.textContent).toContain('风险等级不是收益承诺');
    expect(guide.container.textContent).toContain('每月复盘');
    expect(guide.container.textContent).toContain('单只基金权重');
```

- [ ] **Step 2: Run focused test to verify it fails**

Run:

```bash
bun run test -- frontend/src/components/components.test.tsx
```

Expected: FAIL because the new guidance copy is absent.

- [ ] **Step 3: Implement the enhanced beginner guide**

In `frontend/src/components/BeginnerGuide.tsx`, add this import below the lucide import:

```ts
import { researchCatalog } from '../researchCatalog';
```

Replace the `cards` array with:

```ts
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
      text: '风险等级不是收益承诺。一年内要用的钱优先保守；三年以上闲钱可考虑定投或分批持有；遇到大涨大跌都先拆成小步骤执行。',
    },
  ];
```

Replace the `decision-ladder` block with:

```tsx
      <div className="decision-ladder" aria-label="基金操作路径">
        <strong>默认路径：</strong>
        {researchCatalog.decisionSteps.map((step) => <span title={step.detail} key={step.title}>{step.title}</span>)}
      </div>
```

- [ ] **Step 4: Run focused test to verify it passes**

Run:

```bash
bun run test -- frontend/src/components/components.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BeginnerGuide.tsx frontend/src/components/components.test.tsx
git commit -m "feat: expand beginner fund guidance"
```

## Task 5: Update Full E2E Coverage for Reconstructed Content

**Files:**
- Modify: `tests/fund-flow.spec.ts`

- [ ] **Step 1: Write failing E2E assertions for the new architecture**

In the first test in `tests/fund-flow.spec.ts`, replace this assertion:

```ts
  await expect(page.getByText('智能基金账户，把持仓、交易与投研装进一张安全玻璃卡。')).toBeVisible();
```

with:

```ts
  await expect(page.getByText('基金研究操作系统').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '全景工具宇宙' })).toBeVisible();
  await expect(page.getByText('基金筛选、对比与诊断')).toBeVisible();
  await expect(page.getByText('官方公告与高信任披露')).toBeVisible();
  await expect(page.getByText('AKShare / AKTools')).toBeVisible();
```

After the AI assertions in the same test, add:

```ts
  await expect(page.getByText('风险等级不是收益承诺')).toBeVisible();
  await expect(page.getByText('单只基金权重')).toBeVisible();
```

- [ ] **Step 2: Run E2E to verify it fails before implementation if Task 3/4 were skipped**

Run:

```bash
bun run test:e2e -- tests/fund-flow.spec.ts
```

Expected if Task 3 and Task 4 are complete: PASS. Expected if skipped: FAIL on missing reconstructed content. If it passes, continue; that means prior tasks already implemented the UI.

- [ ] **Step 3: Commit the E2E update**

```bash
git add tests/fund-flow.spec.ts
git commit -m "test: cover reconstructed fund workspace"
```

## Task 6: Update README Documentation in Chinese and English

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Write documentation coverage test**

Create a new test file `tests/readme-content.test.ts` with:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const readmeEn = readFileSync('README.en.md', 'utf8');

describe('README content reconstruction', () => {
  it('documents the reconstructed Chinese fund tool universe', () => {
    expect(readme).toContain('全景工具宇宙');
    expect(readme).toContain('ETF / LOF');
    expect(readme).toContain('REITs');
    expect(readme).toContain('官方公告与高信任披露');
    expect(readme).toContain('AKShare / AKTools');
    expect(readme).toContain('Qlib');
    expect(readme).toContain('不构成投资建议');
  });

  it('keeps the English README aligned with user-facing capabilities', () => {
    expect(readmeEn).toContain('Tool Universe');
    expect(readmeEn).toContain('ETF / LOF');
    expect(readmeEn).toContain('REITs');
    expect(readmeEn).toContain('official disclosures');
    expect(readmeEn).toContain('AKShare / AKTools');
    expect(readmeEn).toContain('Qlib');
    expect(readmeEn).toContain('not investment advice');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test -- tests/readme-content.test.ts
```

Expected: FAIL because README files do not yet document the reconstructed tool universe.

- [ ] **Step 3: Update `README.md`**

In `README.md`, replace the current `## 功能` bullet list with:

```md
## 功能

- Next.js App Router 页面：根路径直接进入 `/app` 工作台，并保留基金详情路由、组合页和设置页。
- 全景工具宇宙：参考公开基金/股票工具网站能力，把行情、筛选、对比、诊断、账户、资讯、公告、开源量化能力组织成一张可浏览的能力地图。
- 多资产导航：当前已接入 A 股指数与基金净值；ETF / LOF、REITs、债券与可转债、新债 / 新发基金、港美与全球观察作为可接入或路线图能力明确标注。
- 基金研究工具：基金发现、横向对比、基金诊断、本地持仓、自选观察、定投/分批行动路径、AI 研究摘要。
- 研究来源与披露中心：把东方财富/同花顺/天天基金式行情数据、好买式基金筛选诊断、雪球式社区观点、交易所官方公告与高信任披露拆成独立内容层。
- 开源研究底座路线图：展示 AKShare / AKTools、Qlib、Tushare、Backtrader、Pyfolio、Streamlit 可启发的数据接入、量化研究、回测、组合归因和仪表盘能力。
- 大盘概览：通过东方财富 push2 / 腾讯行情备用源读取上证指数、深证成指、创业板指、沪深 300。
- 真实基金搜索：按代码或名称查询公开基金数据，接口失败时自动回退内置示例行情。
- 基金详情：优先展示天天基金盘中估算净值、估算涨跌和估算时间，同时保留上一交易日官方净值。
- 基金小白决策地图：把基金类型、净值理解、大盘温度、持仓状态、风险等级、单只基金权重和每月复盘路径放在同一视图，帮助普通投资者避免只看单日涨跌。
- 本地持仓：添加基金后计算市值、成本、盈亏、收益率和组合占比。
- 自选基金：关注基金但不计入持仓。
- Supabase 基础：浏览器端/服务端 helper、请求会话归一化、Next middleware，以及 `supabase/migrations/202605300001_core_schema.sql` 基础 schema 迁移；`/api/portfolio/default` 会优先读取登录用户组合。
- DeepSeek 分析：服务端先计算收益、回撤、动量和波动等确定性指标，再调用 `deepseek-v4-flash` 输出小白解释、风险等级、继续持有/观察/分批加减仓路径；当 `DEEPSEEK_API_KEY` 缺失时自动回退为本地确定性报告。
- Cloudflare Worker 部署：Next Route Handlers 由 OpenNext 输出到 Worker 默认运行时，`wrangler.jsonc` 提供 `GG_FUND_DB`、`GG_FUND_CACHE` 等 binding。
```

After `## 数据来源`, add:

```md
## 能力状态说明

GG Fund 明确区分三种状态：

- `已接入`：当前页面已调用真实接口或本地能力，例如 A 股指数、基金净值、基金搜索、历史净值、本地持仓、自选、AI 分析、导入导出。
- `可接入`：产品形态已在工具宇宙中定义，可在后续接入真实数据或增强算法，例如 ETF / LOF 专题、基金横向对比、定投计划、AKShare / AKTools 数据底座。
- `路线图`：作为内容重构后的方向展示，不声称已提供实时生产能力，例如 REITs、可转债、新发产品日历、官方公告聚合、社区观点、Qlib 回测和组合优化。
```

- [ ] **Step 4: Update `README.en.md`**

Ensure `README.en.md` contains equivalent English user-facing bullets. Add or update a `## Features` section with:

```md
## Features

- Next.js App Router workspace: `/` redirects to `/app`, with fund detail, portfolio, and settings pages kept available.
- Tool Universe: reorganizes common stock/fund website capabilities into a browsable map for quotes, screening, comparison, diagnostics, accounts, news, disclosures, and open-source quant research.
- Multi-asset navigation: A-share indices and fund NAVs are live; ETF / LOF, REITs, bonds and convertible bonds, new bonds / newly issued funds, and global market watch are labeled as connectable or roadmap capabilities.
- Fund research tools: fund discovery, comparison, diagnostics, local holdings, watchlist, staged action paths, and AI research summaries.
- Research sources and disclosures: separates Eastmoney/10jqka/Tiantian-style market data, Howbuy-style fund screening and diagnostics, Snowball-style community opinions, and exchange official disclosures into explicit content layers.
- Open research stack roadmap: AKShare / AKTools, Qlib, Tushare, Backtrader, Pyfolio, and Streamlit are documented as inspiration for data ingestion, quant research, backtesting, portfolio attribution, and dashboards.
- Market overview: reads SSE Composite, SZSE Component, ChiNext, and CSI 300 from Eastmoney push2 with Tencent quote fallback.
- Real fund search: searches public fund data by code or name, with built-in fallback samples when upstream APIs fail.
- Fund details: prefers Tiantian intraday estimated NAV, estimated change, and estimate time while keeping the previous official NAV.
- Beginner decision map: explains fund type, NAV, market temperature, holding status, risk level, single-fund concentration, and monthly review paths.
- Local portfolio: calculates market value, cost, profit/loss, return rate, and weights after adding funds.
- Watchlist: follows funds without counting them as holdings.
- Supabase foundation: browser/server helpers, normalized request sessions, Next middleware, and the core Supabase schema migration; `/api/portfolio/default` prefers the signed-in user's portfolio.
- DeepSeek analysis: computes deterministic return, drawdown, momentum, and volatility indicators before calling `deepseek-v4-flash`; falls back to a local deterministic report when `DEEPSEEK_API_KEY` is missing.
- Cloudflare Worker deployment: Next Route Handlers are built by OpenNext into the Worker runtime with `GG_FUND_DB` and `GG_FUND_CACHE` bindings.
```

Add this status section:

```md
## Capability Status

GG Fund uses three explicit status labels:

- `Live`: real API or local product capability is available today, such as A-share indices, fund NAVs, search, history, local holdings, watchlist, AI analysis, import, and export.
- `Connectable`: the product shape is defined and can be wired to real data or stronger algorithms later, such as ETF / LOF topics, fund comparison, recurring investment plans, and AKShare / AKTools data infrastructure.
- `Roadmap`: shown as the reconstructed product direction, not as a live production claim, such as REITs, convertible bonds, issuance calendars, official disclosure aggregation, community opinions, Qlib backtesting, and portfolio optimization.

All displayed data and AI analysis are for learning and reference only and are not investment advice.
```

- [ ] **Step 5: Run documentation test**

Run:

```bash
bun run test -- tests/readme-content.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add README.md README.en.md tests/readme-content.test.ts
git commit -m "docs: describe reconstructed fund workspace"
```

## Task 7: Run Full Verification and Fix Regressions

**Files:**
- Modify only files necessary to fix test, lint, typecheck, build, or E2E failures.

- [ ] **Step 1: Run lint**

Run:

```bash
bun run lint
```

Expected: PASS. If it fails, fix the exact reported file and rerun until PASS.

- [ ] **Step 2: Run unit and API tests**

Run:

```bash
bun run test
```

Expected: PASS with all non-skipped tests passing.

- [ ] **Step 3: Run coverage**

Run:

```bash
bun run coverage
```

Expected: PASS and coverage report generated.

- [ ] **Step 4: Run production build**

Run:

```bash
bun run build
```

Expected: PASS for `tsc --noEmit` and `next build`.

- [ ] **Step 5: Run browser E2E**

Run:

```bash
bun run test:e2e
```

Expected: PASS.

- [ ] **Step 6: Run Midscene if behavior changed**

Run:

```bash
bun run test:midscene
```

Expected: PASS or documented skip if required Midscene credentials/runtime are unavailable locally.

- [ ] **Step 7: Commit verification fixes if any**

If any fixes were made:

```bash
git add <changed-files>
git commit -m "fix: stabilize fund workspace verification"
```

If no fixes were made, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks cover typed catalog, UI rendering, app integration, beginner guidance, E2E coverage, README/README.en synchronization, and full verification. Out-of-scope items from the spec remain out of scope: real trading, Python quant service, new cloud portfolio editor, and data licensing promises.
- Placeholder scan: No TBD/TODO/later placeholders remain. Roadmap is product copy, not an implementation placeholder.
- Type consistency: `CatalogStatus`, `AssetNavigationItem`, `ToolGroup`, `SourceGroup`, `OpenSourceCapability`, `DecisionStep`, `researchCatalog`, `statusLabels`, `getLiveCatalogItems`, and `getRoadmapCatalogItems` are defined before use and referenced consistently.

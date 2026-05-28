# 中国基金行情网站设计

日期：2026-05-28

## 目标

在当前文件夹构建一个中国基金行情网站。第一版 MVP 采用“个人持仓分析 + 大盘行情浏览均衡”的范围：既能让用户录入并分析自己的基金状态，也能查看主要市场和基金行情。前端使用 React，服务端使用 Bun，测试使用 Vitest、Playwright 和 Midscene。基础设施优先选择免费层，并尽量保证中国大陆和海外网络都能正常访问。

## 范围

### 第一版包含

- 中文首页，展示市场概览、主要指数和入口卡片。
- 基金搜索，支持按基金代码或名称查询。
- 基金详情页，展示基金基础信息、最新净值、涨跌、历史净值趋势。
- 本地持仓管理，支持手动添加、编辑、删除基金持仓。
- 持仓分析，展示当前市值、成本、盈亏、收益率、组合占比和风险提示。
- 自选基金列表，方便用户关注但不计入持仓。
- 数据导入导出，使用 JSON 文件备份本地持仓和自选数据。
- 后端行情代理，统一第三方公开数据源返回格式，并做短期缓存。
- 单元测试、API 测试和端到端 UI 测试。

### 第一版不包含

- 用户账号、登录、多设备云同步。
- 真实交易、申赎、支付或券商/基金平台开户能力。
- 投资建议、收益承诺或自动调仓。
- 付费数据库、付费行情源或依赖必须翻墙的核心服务。

## 推荐方案

采用本地优先架构：用户持仓和自选数据默认保存在浏览器本地，Bun 服务只负责行情数据代理、缓存、清洗和统一错误响应。

相比云端同步方案，本地优先能减少账号、认证、隐私、数据库和跨境访问问题；相比纯前端直连公开数据源，Bun 代理能规避 CORS、限流和数据格式不稳定问题。第一版先保证端到端产品可用，之后再按需要增加账号和同步。

## 技术架构

### 前端

- React + Vite + TypeScript。
- React Router 管理页面路由。
- TanStack Query 或轻量自定义 hooks 管理远程行情请求、缓存状态和错误状态。
- IndexedDB 保存本地持仓、自选和用户设置；如实现复杂度需要控制，可先用 localStorage，接口层保持可替换。
- ECharts 或 Recharts 绘制净值曲线、组合占比和盈亏图。
- CSS Modules 或 Tailwind CSS 实现响应式中文界面。

页面结构：

- `/` 首页：市场概览、主要指数、组合摘要、搜索入口。
- `/markets` 大盘页：指数涨跌、市场温度、热门基金列表。
- `/funds` 基金搜索页：代码/名称搜索、结果列表。
- `/funds/:code` 基金详情页：基金信息、净值走势、自选/加入持仓操作。
- `/portfolio` 持仓页：持仓列表、总资产、总盈亏、组合分析。
- `/settings` 设置页：数据导入导出、缓存说明、免责声明。

### 服务端

- Bun + TypeScript。
- 使用 Bun 原生 HTTP server 或 Elysia。若追求最小依赖，优先 Bun 原生 HTTP server。
- 提供统一 `/api/*` 路由。
- 行情数据来自公开免费接口，服务端封装为稳定内部 DTO。
- 服务端内存缓存：指数和基金最新净值缓存 1-5 分钟，历史净值缓存 12-24 小时。
- 不保存用户持仓，不记录敏感个人投资数据。

API 草案：

- `GET /api/health`：服务健康检查。
- `GET /api/market/indices`：主要指数概览。
- `GET /api/funds/search?q=`：基金搜索。
- `GET /api/funds/:code`：基金基础信息和最新净值。
- `GET /api/funds/:code/history?range=`：历史净值序列。
- `GET /api/funds/trending`：热门或示例基金列表，数据源不足时返回固定示例和明确标识。

### 数据模型

前端本地模型：

```ts
type Holding = {
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

type WatchItem = {
  fundCode: string;
  fundName: string;
  createdAt: string;
};
```

服务端行情模型：

```ts
type FundQuote = {
  code: string;
  name: string;
  netValue: number;
  dailyChangePercent?: number;
  quoteDate: string;
  source: string;
};

type IndexQuote = {
  code: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  quoteTime: string;
};
```

## 数据流

1. 用户打开网站，前端请求 `/api/market/indices` 和本地持仓数据。
2. 本地持仓只在浏览器内读取，前端提取基金代码批量请求最新净值。
3. Bun 服务从缓存读取行情；缓存未命中时请求公开数据源，清洗为统一格式后返回。
4. 前端用最新净值和本地成本计算市值、盈亏、收益率和组合占比。
5. 用户新增或编辑持仓时，前端写入本地存储，并重新计算分析结果。
6. 用户导出数据时，前端生成 JSON 文件；导入时校验字段后覆盖或合并本地数据。

## 错误处理

- 第三方行情源不可用：服务端返回统一错误码和可读中文提示，前端展示“行情暂不可用”。
- 单只基金查询失败：不影响其他持仓计算，失败项显示未知净值。
- 本地数据格式异常：导入时阻止写入并提示具体字段错误。
- 网络超时：前端提供重试按钮，服务端对上游请求设置超时。
- 数据延迟：页面明确显示行情日期和来源，避免误认为实时交易数据。

## 测试策略

- Vitest 单元测试：收益率、盈亏、组合占比、导入校验、API DTO 清洗函数。
- Bun 服务测试：`/api/health`、基金搜索、基金详情、上游失败时的错误响应。第三方请求用可控 mock，避免测试依赖真实网络。
- Playwright E2E：打开首页、搜索基金、查看详情、添加持仓、查看组合分析、导入导出设置页。
- Midscene + Vitest + Playwright：用自然语言断言关键 UI 流程，例如“搜索一只基金并加入持仓后，持仓页能看到基金名称和盈亏摘要”。
- 每个关键页面至少有一个可执行端到端用例。

## 基础设施

开发环境：

- Bun 管理服务端和脚本。
- 前端 Vite dev server。
- Playwright 浏览器用于 E2E。

免费部署候选：

- 前端：Cloudflare Pages、Netlify 或 Vercel 免费层。优先 Cloudflare Pages，因为全球访问和静态资源分发较稳定。
- 服务端：Render、Fly.io 或 Railway 免费层。若免费层休眠，前端应展示首次加载可能较慢的提示。
- 数据库：第一版不需要云数据库。若后续增加同步，可评估 Supabase、Neon 或 Turso 免费层，但需重新评估中国大陆可访问性。

为了兼顾中国大陆和海外访问，第一版不依赖 Google Fonts、境外验证码、付费 SaaS 数据库或必须登录的海外 API。静态资源全部本地打包。

## UI 设计方向

- 中文优先，信息密度适中，适合桌面和移动端。
- 首页用卡片展示“今日市场”“我的组合”“基金搜索”“风险提示”。
- 持仓页突出总资产、总盈亏、收益率、单只基金占比。
- 所有金额和比例都有空状态、加载态和错误态。
- 设置页包含免责声明：数据仅供参考，不构成投资建议。

## 里程碑

1. 搭建 React + Bun + TypeScript 项目结构。
2. 实现服务端健康检查和行情 API 代理骨架。
3. 实现前端布局、路由和基础页面。
4. 实现本地持仓、自选和组合计算。
5. 接入基金搜索、详情和市场指数数据。
6. 补齐 Vitest、Playwright、Midscene 测试。
7. 完成本地验证和部署说明。

## 验收标准

- 在当前文件夹可以启动前端和 Bun 服务。
- 用户可以搜索基金、查看基金详情、添加持仓并看到组合分析。
- 用户可以查看主要市场指数和大盘概览。
- 用户持仓数据不上传服务端。
- Vitest 单元测试通过。
- Playwright/Midscene 关键 E2E 用例可运行。
- 项目不依赖付费基础设施即可本地运行和部署。

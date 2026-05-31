# GG Fund 中国基金行情

English version: [README.en.md](./README.en.md)

GG Fund 现已以 Cloudflare-first 的 Next.js App Router 架构为主：`app/` 承载页面与 Route Handlers，根路径 `/` 会直接跳转到 `/app` 工作台，`components/workspace/FundWorkspace.tsx` 作为工作台入口复用现有可迁移的 React 模块，部署通过 OpenNext 输出 Cloudflare Worker，服务端能力聚合在 `features/*` 与 `lib/*`。

## 功能

- Next.js App Router 页面：根路径 `/` 会直接跳转到 `/app` 工作台，`/login` 提供独立邮箱验证码登录页，`/settings` 目前提供基础说明入口，`/app/portfolio` 当前作为组合落地页；本地持仓与自选能力继续在工作台内使用。
- 顶部导航工作台：`/app` 内通过固定顶部导航在“总览、工具宇宙、行情工作台、组合账户”之间切换，右上角展示紧凑账户状态卡片；未登录时点击右上角“登录”进入 `/login`。
- 全景工具宇宙：参考公开基金/股票工具网站能力，把行情、筛选、对比、诊断、账户、资讯、公告、开源量化能力组织成一张可浏览的能力地图。
- 多资产导航：当前已接入 A 股/港股/美股核心指数、A 股实时股价与基金净值；ETF / LOF、REITs、债券与可转债、新债 / 新发基金、港美与全球观察作为可接入或路线图能力明确标注。
- 基金与股票研究工具：基金发现、A 股搜索、基金诊断、本地持仓、自选观察为已接入；基金横向对比、ETF / LOF 专题、定投/分批行动路径明确标注为可接入。
- 研究来源与披露中心：把东方财富/同花顺/天天基金式行情数据、好买式基金筛选诊断、雪球式社区观点、交易所官方公告与高信任披露拆成独立内容层。
- 开源研究底座路线图：展示 AKShare / AKTools、Qlib、Tushare、Backtrader、Pyfolio、Streamlit 可启发的数据接入、量化研究、回测、组合归因和仪表盘能力。
- 全球市场雷达：通过东方财富 push2 / 腾讯行情备用源读取上证指数、深证成指、创业板指、沪深 300、科创 50、北证 50、恒生指数和纳斯达克。
- 金融资产搜索：按代码或名称查询公开基金数据和 A 股实时行情，接口失败时自动回退内置示例行情。
- 基金详情：优先展示天天基金盘中估算净值、估算涨跌和估算时间，同时保留上一交易日官方净值。
- 基金分析走势图：基金详情页使用暗色数据雷达风格的 ECharts 图表，同屏展示单位净值、区间收益、回撤、净值区间和时间范围切换。
- 基金小白决策地图：把基金类型、净值理解、大盘温度、持仓状态、风险等级、单只基金权重和每月复盘路径放在同一视图，帮助普通投资者避免只看单日涨跌。
- 本地持仓：添加基金后计算市值、成本、盈亏、收益率和组合占比。
- 自选基金：关注基金但不计入持仓。
- Resend 邮箱登录：`/login` 使用独立极简登录页，`/api/auth/challenge` 发送 6 位邮箱验证码并把 Resend 发信失败原因直接返回给前端，`/api/auth/verify` 创建 GG Fund 自有会话；`/api/portfolio/default` 会优先读取登录用户组合。
- Cloudflare Worker 部署：Next Route Handlers 由 OpenNext 输出到 Worker 默认运行时，`wrangler.jsonc` 提供 `GG_FUND_DB`、`GG_FUND_CACHE` 等 binding。

## 项目结构

- `app/`：Next.js App Router 页面与 `app/api/*` Route Handlers。
- `components/workspace/FundWorkspace.tsx`：Next 工作区入口。
- `features/market`、`features/portfolio`、`features/auth`、`features/ai`、`features/email`：服务层模块。
- `lib/`：环境与 HTTP runtime helper。
- `frontend/src/`：仍被 Next 复用的 React 组件、样式和浏览器端逻辑；不再作为独立 Vite 应用入口。
- `shared/`：前后端共享类型、行情数据适配器和对应测试。
- `migrations/`：Cloudflare D1 migrations。
- `scripts/`：CI 测试、Cloudflare 部署和线上验证脚本。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS v4 + Radix UI + shadcn/ui 风格组件
- Resend 邮箱验证码登录
- OpenNext Cloudflare Workers 部署
- 东方财富/腾讯/天天基金公开接口 + fallback 示例行情
- ESLint + TypeScript 严格检查
- Vitest + Playwright E2E

## 本地开发

```bash
bun install
cp .env.example .env.local
bun run dev
```

打开 `http://127.0.0.1:3000`。

## 环境变量

服务端变量：

```bash
RESEND_API_KEY=re_your_key
AUTH_EMAIL_FROM="GG Fund <onboarding@resend.dev>"
```

## 测试

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

`bun run test:e2e` 会运行 Next 核心 smoke spec 和 `tests/fund-flow.spec.ts` 的基金工作台 E2E。

如需运行 Midscene：

```bash
bun run test:midscene
```

与 CI 对齐的一键检查：

```bash
bun run ci:test
```

## Cloudflare 部署

完成 Cloudflare 登录、binding 与 secret 配置后执行：

```bash
bun run deploy:cloudflare
bun run verify:cloudflare
```

`bun run deploy:cloudflare` 会先执行 `bun run build`、OpenNext Worker 构建、远程 D1 迁移应用，然后通过 `bunx wrangler deploy --config wrangler.jsonc --name "$CF_WORKER_NAME"` 发布 Worker。默认值如下：

- `CF_WORKER_NAME=gg-fund`
- `CF_D1_DATABASE=gg-fund-db`
- `CF_VERIFY_BASE_URL` 未设置时回退为 `https://$CF_WORKER_NAME.workers.dev`

CI 依赖安装通过 `scripts/ci-install.sh` 执行 `npm ci --include=optional --ignore-scripts`，并在根级 `optionalDependencies` 锁定 Linux `workerd`、esbuild、Lightning CSS、Tailwind Oxide 与 ast-grep 平台包，确保 Linux runner 安装 OpenNext / Wrangler / CSS 构建所需的二进制文件。

默认验证接口：

- `GET /api/health`
- `GET /api/market/indices`
- `GET /api/funds/000001`

## Next API

- `GET /api/health`
- `GET /api/market/indices`
- `GET /api/funds/search?q=消费`
- `GET /api/funds/:code`
- `GET /api/funds/:code/history?range=1m|3m|6m|1y|all`
- `GET /api/funds/trending`
- `GET /api/auth/me`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `POST /api/auth/logout`
- `GET /api/portfolio/default`

## 数据来源

金融资产搜索读取东方财富基金搜索、东方财富 A 股行情列表与腾讯证券备用行情，基金结果带上一交易日官方净值，股票结果带实时价格、涨跌幅、开高低、成交量和成交额。基金详情优先读取天天基金 `fundgz` 盘中估算接口，返回 `quoteType: "estimate"`、`estimateTime` 和上一官方净值。全球市场雷达读取东方财富 push2 指数接口，覆盖 A/H/美核心指数，Cloudflare 边缘不可用时切换腾讯行情源。历史净值读取东方财富历史净值接口。服务端负责统一 DTO、缓存结果和失败回退，前端不直接访问第三方接口。

## 能力状态说明

GG Fund 明确区分三种状态：

- `已接入`：当前页面已调用真实接口或本地能力，例如全球核心指数、A 股实时股价、基金净值、基金发现/搜索、基金诊断、历史净值、本地持仓、自选、Resend 邮箱登录、导入导出。
- `可接入`：产品形态已在工具宇宙中定义，可在后续接入真实数据或增强算法，例如 ETF / LOF 专题、基金横向对比、定投/分批行动路径、AKShare / AKTools 数据底座。
- `路线图`：作为内容重构后的方向展示，不声称已提供实时生产能力，例如 REITs、可转债、新发产品日历、官方公告聚合、社区观点、Qlib 回测和组合优化。

## 文档和测试要求

见 `AGENTS.md`。每次功能变更必须同步更新 `README.md` 和必要的英文 README / 部署文档，并运行 lint、单元/API、覆盖率、构建和 E2E 验证后再交付。

## 免责声明

本项目展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。

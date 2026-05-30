# GG Fund 中国基金行情

English version: [README.en.md](./README.en.md)

GG Fund 现已以 Cloudflare-first 的 Next.js App Router 架构为主：`app/` 承载页面与 Route Handlers，根路径 `/` 会直接跳转到 `/app` 工作台，`components/workspace/FundWorkspace.tsx` 作为工作台入口复用现有可迁移的 React 模块，部署通过 OpenNext 输出 Cloudflare Worker，服务端能力聚合在 `features/*` 与 `lib/*`。

## 功能

- Next.js App Router 页面：根路径直接进入 `/app` 工作台，并保留基金详情路由、组合页和设置页。
- 大盘概览：通过东方财富 push2 / 腾讯行情备用源读取上证指数、深证成指、创业板指、沪深 300。
- 真实基金搜索：按代码或名称查询公开基金数据，接口失败时自动回退内置示例行情。
- 基金详情：优先展示天天基金盘中估算净值、估算涨跌和估算时间，同时保留上一交易日官方净值。
- 基金小白决策地图：把基金类型、净值理解、大盘温度、持仓状态和分批行动路径放在同一视图，帮助普通投资者避免只看单日涨跌。
- 本地持仓：添加基金后计算市值、成本、盈亏、收益率和组合占比。
- 自选基金：关注基金但不计入持仓。
- Supabase 基础：浏览器端/服务端 helper、请求会话归一化、Next middleware，以及 `supabase/migrations/202605300001_core_schema.sql` 基础 schema 迁移；`/api/portfolio/default` 会优先读取登录用户组合。
- DeepSeek 分析：服务端先计算收益、回撤、动量和波动等确定性指标，再调用 `deepseek-v4-flash` 输出小白解释、风险等级、继续持有/观察/分批加减仓路径；当 `DEEPSEEK_API_KEY` 缺失时自动回退为本地确定性报告。
- Cloudflare Worker 部署：Next Route Handlers 由 OpenNext 输出到 Worker 默认运行时，`wrangler.jsonc` 提供 `GG_FUND_DB`、`GG_FUND_CACHE` 等 binding。

## 项目结构

- `app/`：Next.js App Router 页面与 `app/api/*` Route Handlers。
- `components/workspace/FundWorkspace.tsx`：Next 工作区入口。
- `features/market`、`features/portfolio`、`features/auth`、`features/ai`、`features/email`：服务层模块。
- `lib/`：环境、HTTP、Supabase runtime helper。
- `frontend/src/`：仍被 Next 复用的 React 组件、样式和浏览器端逻辑；不再作为独立 Vite 应用入口。
- `shared/`：前后端共享类型、行情数据适配器和对应测试。
- `migrations/`：Cloudflare D1 migrations。
- `supabase/migrations/`：Supabase Postgres schema 迁移。
- `scripts/`：CI 测试、Cloudflare 部署和线上验证脚本。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS v4 + Radix UI + shadcn/ui 风格组件
- Supabase Auth + Supabase Postgres + RLS
- Resend 产品邮件
- OpenNext Cloudflare Workers 部署
- 东方财富/腾讯/天天基金公开接口 + fallback 示例行情
- DeepSeek v4 Flash 服务端分析
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

浏览器公开变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

服务端变量：

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=re_your_key
AUTH_EMAIL_FROM="GG Fund <onboarding@resend.dev>"
DEEPSEEK_API_KEY=your-deepseek-api-key
```

## 测试

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

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

GitHub Actions 部署需要在仓库 Variables 中提供以下公开构建变量，确保 OpenNext 构建期注入浏览器端配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

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
- `GET /api/portfolio/default`
- `POST /api/ai/analyze-fund`

## 数据来源

基金搜索读取东方财富当前搜索接口，搜索结果带上一交易日官方净值；基金详情优先读取天天基金 `fundgz` 盘中估算接口，返回 `quoteType: "estimate"`、`estimateTime` 和上一官方净值。大盘指数读取东方财富 push2 指数接口，Cloudflare 边缘不可用时切换腾讯行情源。历史净值读取东方财富历史净值接口。服务端负责统一 DTO、缓存结果和失败回退，前端不直接访问第三方接口。

## 文档和测试要求

见 `AGENTS.md`。每次功能变更必须同步更新 `README.md` 和必要的英文 README / 部署文档，并运行 lint、单元/API、覆盖率、构建和 E2E 验证后再交付。

## 免责声明

本项目展示的数据和 AI 分析仅用于学习和参考，不构成投资建议、收益承诺或交易依据。

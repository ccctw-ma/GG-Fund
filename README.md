# GG Fund 中国基金行情

English version: [README.en.md](./README.en.md)

GG Fund 正在从 React + Vite 逐步迁移到 Cloudflare-first 的 Next.js App Router 架构。当前仓库同时保留：`app/` 下的 Next.js 页面与 Route Handlers 作为新的主应用壳层，`frontend/` 下的既有工作台界面作为复用的基金工作区实现，`backend/` 与 `shared/` 中的现有行情和分析逻辑继续为迁移过程提供稳定能力。

## 功能

- Next.js App Router 页面骨架：公开首页、`/app` 工作台、基金详情路由、组合页、定价页和设置页已经就位。
- 大盘概览：通过东方财富 push2 / 腾讯行情备用源读取上证指数、深证成指、创业板指、沪深 300。
- 真实基金搜索：按代码或名称查询公开基金数据，接口失败时自动回退内置示例行情。
- 基金详情：优先展示天天基金盘中估算净值、估算涨跌和估算时间，同时保留上一交易日官方净值。
- 本地持仓：添加基金后计算市值、成本、盈亏、收益率和组合占比。
- 自选基金：关注基金但不计入持仓。
- Supabase 基础：新增浏览器端/服务端 Supabase helper、请求会话归一化、Next middleware 和首个 `supabase/migrations/202605300001_core_schema.sql` 基础 schema；`/api/portfolio/default` 会在请求会话可用时读取登录用户组合，否则才显式回退到匿名默认组合。
- 登录入口：前端界面已切到 Supabase 邮箱登录文案与客户端流程；旧 Cloudflare OTP 接口仍保留在 `backend/` 中用于兼容现有实现。
- DeepSeek 分析：基金研究 Agent 先采集实时行情/历史净值/指数环境，计算区间收益、回撤、动量、波动等确定性指标，再调用 `deepseek-v4-flash` 生成结构化趋势、风险、情景和观察点；当 `DEEPSEEK_API_KEY` 未配置时自动降级为本地确定性报告（`agent.model: "local-fallback"`），保持相同结构供 UI 展示。
- 数据导入导出：使用 JSON 备份浏览器本地数据。
- Cloudflare 基建：Cloudflare 仍是默认部署目标；Next Route Handlers 采用 edge runtime 约束，并通过 `wrangler.jsonc` / OpenNext Cloudflare context 暴露 `GG_FUND_DB` 等 binding。
- 隐私优先：DeepSeek key、Supabase service role key 等服务端密钥不进入前端 bundle。

## 项目结构

- `app/`：Next.js App Router 页面与 `app/api/*` Route Handlers。
- `components/workspace/FundWorkspace.tsx`：复用现有基金工作台界面作为 Next 工作区入口。
- `features/market`、`features/portfolio`、`features/auth`、`features/ai`：迁移中的服务层模块。
- `lib/`：环境、HTTP、Supabase runtime helper。
- `frontend/src/`：既有 React 工作台、样式、浏览器端持仓逻辑和前端 API client。
- `backend/api.ts`：现有 Cloudflare Pages Functions 业务 API，实现仍可作为兼容参考。
- `shared/`：前后端共享类型、行情数据适配器和对应测试。
- `migrations/`：现有 Cloudflare D1 migrations。
- `supabase/migrations/`：新的 Supabase Postgres schema 迁移。
- `scripts/`：CI 测试、Cloudflare 部署和线上验证脚本。

## 技术栈

- Next.js App Router + React + TypeScript
- 迁移期兼容 React + Vite 工作台
- Tailwind CSS v4 + Radix UI + shadcn/ui 风格组件
- Cloudflare Pages / OpenNext Cloudflare
- Supabase SSR helpers + Supabase Auth / Postgres foundation
- 东方财富/腾讯/天天基金公开接口 + fallback 示例行情
- DeepSeek v4 Flash 服务端分析
- ESLint + TypeScript 严格检查
- Vitest 单元、组件、服务层和行情适配器测试
- Vitest coverage，当前全局阈值：statements 70%、branches 60%、functions 70%、lines 70%
- Apache ECharts 大盘图和基金研究走势图（区间收益、最大回撤、缩放、Tooltip）
- Midscene 测试骨架

## 本地开发

```bash
bun install
bun run dev
```

打开 `http://127.0.0.1:3000` 查看 Next.js App Router 工作台。

如需继续调试旧 Vite/本地 API 组合，也可以使用：

```bash
bun run dev:api
bun run dev:web
```

## 环境变量

浏览器公开变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

服务端变量：

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEEPSEEK_API_KEY=your-deepseek-api-key
```

当前 `.env.example` 仍保留前端 Supabase 说明，后续会统一为 Next 风格变量。

## 测试

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
bun run test:midscene
```

也可以运行与 CI 一致的一键检查：

```bash
bun run ci:test
```

当前新增的 focused tests 覆盖环境变量 helper、HTTP helper、Supabase helper、会话归一化、市场服务、组合仓储、本地存储和 AI 分析服务。

## 提交前检查

安装仓库内 Git hook：

```bash
bun run precommit:install
```

之后每次提交前会运行：

```bash
bun run lint
bun run test
```

完整本地验收使用：

```bash
bun run check
```

## Cloudflare 部署

本地部署前先完成 Cloudflare、Supabase 和 Secret 配置，然后执行：

```bash
bun run deploy:cloudflare
bun run verify:cloudflare
```

当前默认 Cloudflare 验证接口：

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

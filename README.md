# GG Fund 中国基金行情

English version: [README.en.md](./README.en.md)

GG Fund 是一个接近线上网站形态的中国基金行情与持仓分析应用。项目按前后端分层组织：`frontend/` 放 React + Vite 前端，`backend/` 放唯一业务 API 实现，根目录 `functions/` 仅保留 Cloudflare Pages Functions 路由 shim，`shared/` 放前后端共享 DTO 和行情适配器。线上运行在 Cloudflare Pages Functions + D1 + KV，本地开发通过 Bun 运行 `backend/local.ts` 注入内存 D1/KV bindings。

## 功能

- 大盘概览：通过东方财富 push2 / 腾讯行情备用源读取上证指数、深证成指、创业板指、沪深 300。
- 真实基金搜索：按代码或名称查询公开基金数据，接口失败时自动回退内置示例行情。
- 基金详情：优先展示天天基金盘中估算净值、估算涨跌和估算时间，同时保留上一交易日官方净值。
- 本地持仓：添加基金后计算市值、成本、盈亏、收益率和组合占比。
- 自选基金：关注基金但不计入持仓。
- 登录入口：邮箱/电话使用 OTP challenge + verify 流程；GitHub/微信返回 OAuth 跳转元数据，生产环境配置真实 client id/secret 后接入回调。
- DeepSeek 分析：基金研究 Agent 先采集实时行情/历史净值/指数环境，再评估价格动量、构建研究提示，最后调用 `deepseek-v4-flash`。
- 数据导入导出：使用 JSON 备份浏览器本地数据。
- Cloudflare 基建：D1 存组合/登录数据，KV 缓存行情，Pages Functions 提供线上 API。
- 隐私优先：DeepSeek key 只通过 Cloudflare Secret 注入，不进入代码、git 或前端 bundle。

## 项目结构

- `frontend/src/`：React 页面、组件、浏览器本地持仓逻辑和前端 API client。
- `backend/api.ts`：唯一业务 API 实现，本地和线上都复用这里。
- `backend/local.ts`：Bun 本地 Cloudflare bindings 适配器，使用内存 D1/KV。
- `functions/api/[[path]].ts`：Cloudflare Pages Functions 入口，只负责转发到 `backend/api.ts`。
- `shared/`：前后端共享类型、行情数据适配器和对应测试。
- `migrations/`：Cloudflare D1 migrations。
- `scripts/`：CI 测试、Cloudflare 部署和线上验证脚本。

## 技术栈

- React + Vite + TypeScript
- Tailwind CSS v4 + Radix UI + shadcn/ui 风格组件
- Cloudflare Pages Functions + D1 + KV
- Bun 本地 Functions 适配器
- 东方财富/腾讯/天天基金公开接口 + fallback 示例行情
- DeepSeek v4 Flash 服务端分析
- ESLint + TypeScript 严格检查
- Vitest 单元、组件、Cloudflare API 和行情适配器测试
- Vitest coverage，当前全局阈值：statements 70%、branches 60%、functions 70%、lines 70%
- Recharts 大盘图和基金历史净值走势图
- Midscene 测试骨架

## 本地开发

```bash
bun install
bun run dev:api
bun run dev:web
```

打开 `http://127.0.0.1:5173`。

也可以同时启动：

```bash
bun run dev
```

本地 API 使用与线上相同的 `backend/api.ts`，并通过 `backend/local.ts` 内存 D1/KV 适配器模拟 Cloudflare bindings。

## Cloudflare Secret

不要把 DeepSeek API key 写入代码或提交。使用 Cloudflare Secret：

```bash
bunx wrangler@3 pages secret put DEEPSEEK_API_KEY --project-name gg-fund
```

如果 key 出现在聊天、日志或截图里，视为已泄露，先去 DeepSeek 控制台撤销并换新 key。

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

`bun run ci:test` 会依次运行 lint、Vitest、coverage、build 和 E2E。`bun run test` 会运行 Vitest 单元、组件、行情适配器和 Cloudflare API 测试。E2E 覆盖实时指数非 mock、基金搜索/持仓、登录入口和 DeepSeek 分析 UI。`test:midscene` 在没有模型凭证时会运行跳过说明测试。

`bun run test:midscene` 会通过 `scripts/test-midscene.sh` 读取本机 `~/.zshrc` 中的 Midscene 模型配置，自动启动本地 API/Web 服务，并验证 Midscene + Playwright 集成。若要强制执行真实 `aiAct` 模型动作，运行：

```bash
MIDSCENE_RUN_AI=1 bun run test:midscene
```

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

本地部署前先完成登录、D1/KV 绑定和 Pages Secret 配置，然后执行：

```bash
bun run ci:test
bun run deploy:cloudflare
bun run verify:cloudflare
```

`deploy:cloudflare` 会先执行远端 D1 migrations，再把 `dist/` 部署到 Cloudflare Pages 项目 `gg-fund`。可用环境变量覆盖默认值：`CF_PAGES_PROJECT`、`CF_PAGES_BRANCH`、`CF_D1_DATABASE`、`CF_VERIFY_BASE_URL`。

GitHub Actions 已配置为 push/merge 到 `master` 后自动运行测试、构建、D1 迁移、Pages 部署和线上健康检查。仓库 Secrets 需要配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

## API

- `GET /api/health`
- `GET /api/market/indices`
- `GET /api/funds/search?q=消费`
- `GET /api/funds/:code`
- `GET /api/funds/:code/history?range=1m`
- `GET /api/funds/trending`
- `GET /api/portfolio/default`
- `POST /api/portfolio/default/holdings`
- `POST /api/portfolio/default/watchlist`
- `GET /api/auth/oauth-url?provider=github|wechat`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `POST /api/ai/analyze-fund`

## 数据来源

基金搜索读取东方财富当前搜索接口，搜索结果带上一交易日官方净值；基金详情优先读取天天基金 `fundgz` 盘中估算接口，返回 `quoteType: "estimate"`、`estimateTime` 和上一官方净值。大盘指数读取东方财富 push2 指数接口，Cloudflare 边缘不可用时切换腾讯行情源。历史净值读取东方财富历史净值接口。服务端负责统一 DTO、缓存结果和失败回退，前端不直接访问第三方接口。

## 文档和测试要求

见 `AGENTS.md`。每次功能变更必须同步更新 `README.md` 和必要的英文 README / 部署文档，并运行 lint、单元/API、覆盖率、构建和 E2E 验证后再交付。

## 免责声明

本项目展示的数据和 AI 分析仅用于学习和参考，不构成投资建议、收益承诺或交易依据。

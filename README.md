# GG Fund 中国基金行情

GG Fund 是一个接近线上网站形态的中国基金行情与持仓分析应用。前端使用 React、Vite、TypeScript、Tailwind CSS 和 shadcn/ui 风格组件；服务端本地使用 Bun + SQLite，线上使用 Cloudflare Pages Functions + D1 + KV。项目接入天天基金盘中估算、东方财富基金搜索/官方净值/历史净值，并支持 DeepSeek v4 Flash 基金研究摘要。

## 功能

- 大盘概览：通过东方财富 push2 / 腾讯行情备用源读取上证指数、深证成指、创业板指、沪深 300。
- 真实基金搜索：按代码或名称查询公开基金数据，接口失败时自动回退内置示例行情。
- 基金详情：优先展示天天基金盘中估算净值、估算涨跌和估算时间，同时保留上一交易日官方净值。
- 本地持仓：添加基金后计算市值、成本、盈亏、收益率和组合占比。
- 自选基金：关注基金但不计入持仓。
- 登录入口：支持邮箱、GitHub、微信、电话四类 provider 的统一会话入口；当前为 Cloudflare D1 demo session，可替换真实 OAuth/短信服务。
- DeepSeek 分析：服务端拉取基金实时估算、历史净值和指数数据，用 `deepseek-v4-flash` 生成走势分析。
- 数据导入导出：使用 JSON 备份浏览器本地数据。
- Cloudflare 基建：D1 存组合/登录数据，KV 缓存行情，Pages Functions 提供线上 API。
- 隐私优先：DeepSeek key 只通过 Cloudflare Secret 注入，不进入代码、git 或前端 bundle。

## 技术栈

- React + Vite + TypeScript
- Tailwind CSS v4 + Radix UI + shadcn/ui 风格组件
- Bun HTTP server + `bun:sqlite` 本地开发
- Cloudflare Pages Functions + D1 + KV 线上运行
- 东方财富/腾讯/天天基金公开接口 + fallback 示例行情
- DeepSeek v4 Flash 服务端分析
- Vitest 单元/API 适配器测试
- Bun test 数据库/API 运行时测试
- Playwright E2E 测试
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

默认数据库文件为 `./data/gg-fund.sqlite`，可通过环境变量覆盖：

```bash
GG_FUND_DB=./data/prod.sqlite bun run start
```

## Cloudflare Secret

不要把 DeepSeek API key 写入代码或提交。使用 Cloudflare Secret：

```bash
bunx wrangler@3 pages secret put DEEPSEEK_API_KEY --project-name gg-fund
```

如果 key 出现在聊天、日志或截图里，视为已泄露，先去 DeepSeek 控制台撤销并换新 key。

## 测试

```bash
bun run test
bun run build
bun run test:e2e
bun run test:midscene
```

`bun run test` 会同时运行 Vitest 和 Bun 原生测试。E2E 覆盖实时指数非 mock、基金搜索/持仓、登录入口和 DeepSeek 分析 UI。`test:midscene` 在没有模型凭证时会运行跳过说明测试。

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
- `POST /api/auth/start`
- `POST /api/ai/analyze-fund`

## 数据来源

基金搜索读取东方财富当前搜索接口，搜索结果带上一交易日官方净值；基金详情优先读取天天基金 `fundgz` 盘中估算接口，返回 `quoteType: "estimate"`、`estimateTime` 和上一官方净值。大盘指数读取东方财富 push2 指数接口，Cloudflare 边缘不可用时切换腾讯行情源。历史净值读取东方财富历史净值接口。服务端负责统一 DTO、缓存结果和失败回退，前端不直接访问第三方接口。

## 文档和测试要求

见 `AGENTS.md`。每次功能变更必须同步更新文档，并运行单元/API/E2E 验证后再交付。

## 免责声明

本项目展示的数据和 AI 分析仅用于学习和参考，不构成投资建议、收益承诺或交易依据。

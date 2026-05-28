# GG Fund 中国基金行情

GG Fund 是一个接近线上网站形态的中国基金行情与持仓分析应用。前端使用 React、Vite、TypeScript、Tailwind CSS 和 shadcn/ui 风格组件；服务端使用 Bun，接入天天基金盘中估算、东方财富基金搜索/官方净值/历史净值，并使用 Bun 原生 SQLite 做组合快照与行情缓存。

## 功能

- 大盘概览：通过东方财富 push2 接口实时读取上证指数、深证成指、创业板指、沪深 300。
- 真实基金搜索：按代码或名称查询公开基金数据，接口失败时自动回退内置示例行情。
- 基金详情：优先展示天天基金盘中估算净值、估算涨跌和估算时间，同时保留上一交易日官方净值。
- 本地持仓：添加基金后计算市值、成本、盈亏、收益率和组合占比。
- 自选基金：关注基金但不计入持仓。
- 数据导入导出：使用 JSON 备份浏览器本地数据。
- SQLite 服务：提供默认组合快照、持仓/自选写入接口和基金行情缓存。
- 隐私优先：前端持仓默认保存在浏览器 localStorage，服务端数据库能力用于线上扩展和缓存。

## 技术栈

- React + Vite + TypeScript
- Tailwind CSS v4 + Radix UI + shadcn/ui 风格组件
- Bun HTTP server + `bun:sqlite`
- 东方财富/天天基金公开接口 + fallback 示例行情
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

## 测试

```bash
bun run test
bun run build
bun run test:e2e
bun run test:midscene
```

`bun run test` 会同时运行 Vitest 和 Bun 原生测试。`test:midscene` 在没有模型凭证时会运行跳过说明测试；配置 `OPENAI_API_KEY` 或兼容的 `MIDSCENE_MODEL_NAME` 后可扩展为自然语言 UI 断言。

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

## 数据来源

基金搜索读取东方财富当前搜索接口，搜索结果带上一交易日官方净值；基金详情优先读取天天基金 `fundgz` 盘中估算接口，返回 `quoteType: "estimate"`、`estimateTime` 和上一官方净值。大盘指数读取东方财富 push2 指数接口，解析 `f2/f3/f4/f124` 作为指数点位、涨跌幅、涨跌额和行情时间。历史净值读取东方财富历史净值接口。服务端负责统一 DTO、缓存结果和失败回退，前端不直接访问第三方接口。

## 免责声明

本项目展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。

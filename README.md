# GG Fund 全球基金与指数行情

English version: [README.en.md](./README.en.md)

GG Fund 现已以 Cloudflare-first 的 Next.js App Router 架构为主：`app/` 承载页面与 Route Handlers，根路径 `/` 会直接跳转到 `/app` 工作台，`components/workspace/FundWorkspace.tsx` 作为工作台入口复用现有可迁移的 React 模块，部署通过 OpenNext 输出 Cloudflare Worker，服务端能力聚合在 `features/*` 与 `lib/*`。

## 功能

- Next.js App Router 页面：根路径 `/` 会直接跳转到 `/app` 工作台，`/login` 提供独立邮箱验证码登录页，`/settings` 目前提供基础说明入口，`/app/portfolio` 当前作为组合落地页；本地持仓与自选能力继续在工作台内使用。
- 顶部导航工作台：`/app` 内通过固定顶部导航在“行情、账户”之间切换，右上角展示紧凑账户状态卡片；未登录时点击右上角“登录”进入 `/login`。原“总览”落地页和功能卡片区已移除，进入 `/app` 默认展示行情页。
- 养基宝式账本能力：账户页已接入今日估算收益、多平台账本、盈亏周报/月报摘要、贡献拆解、集中度风险、净值缺失、7 天赎回提醒、目标权重偏离、教育型定投计划和目标止盈提醒。
- 多平台导入助手：账户页仅保留导入助手作为本地录入入口，支持粘贴支付宝、理财通、天天基金、雪球等持仓文字，支持上传支付宝 `.txt` / `.csv` / `.json` 文本类持仓文件，也支持直接上传支付宝持仓截图图片（PNG/JPG/JPEG/WebP/BMP）。图片优先经 `POST /api/ai/recognize-holdings` 在服务端调用 OCR.space（可配置 `OCR_SPACE_API_KEY`，未配置时使用公共 demo key）识别文字，再用 DeepSeek（`deepseek-v4-flash`）对 OCR 文本做结构化持仓识别与纠错；云端 OCR 不可用时前端会回退浏览器本地 OCR。识别成功后会按基金名称自动查询并回填 6 位基金代码，再弹出可二次编辑的确认弹窗，用户可逐行修改基金名称、代码、持有金额、收益，也可点击「查代码 / 重新确认」按名称再次确认基金代码，最后点击「确认导入」写入本地账本。服务端从 Cloudflare runtime context 读取 `DEEPSEEK_API_KEY` 与可选 `OCR_SPACE_API_KEY`，缺少 DeepSeek key 时图片识别会返回明确错误而不伪造结果。平台授权同步、真实交易下单和全网用户加减仓榜仍标注为路线图，不伪造生产能力。
- 全球指数行情：行情页首屏以横向可点击卡片展示 A 股、港股、美股、日经、韩国和欧洲主要指数，默认选中上证指数，并在卡片下方用全宽走势图展示当前指数历史走势；实时点位优先使用东方财富 `push2` 的 `ulist.np/get`，全球指数使用 `100.{code}` 形式的 secid，例如 `100.DJIA`、`100.SPX`、`100.NDX`、`100.N225`、`100.KS11`、`100.FTSE`、`100.GDAXI`、`100.FCHI`、`100.HSI`；当东方财富在 Worker 出口不可用时，接口会合并腾讯 A 股指数和新浪全球指数行情作为兜底，并用历史日线补齐科创 50、北证 50、纳斯达克 100 等必备指数卡片。全球指数历史走势优先尝试东方财富 `push2his`，失败后使用 Naver Chart API 的公开日线接口（如 `.DJI`、`.INX`、`.IXIC`、`.NDX`、`.N225`、`KOSPI`、`.HSI`、`.FTSE`、`.GDAXI`、`.FCHI`）；北证 50 历史走势额外使用搜狐历史行情接口兜底，避免腾讯仅返回单日 K 线。
- 金融资产搜索：作为工作台第二板块放在指数行情下方，按代码或名称查询公开基金数据和 A 股实时行情，搜索结果以横向可切换卡片展示，接口失败时自动回退内置示例行情。
- 基金详情：优先展示天天基金 `fundgz` 盘中估算净值、估算涨跌和估算时间，同时保留上一交易日官方净值；当估算接口或移动端净值接口不可用时，会继续尝试东方财富 PC `pingzhongdata` 净值页和基金搜索精确命中，按估算时间/净值日期选择最新可用行情，避免单一上游抖动导致 404 或旧数据；详情动作区和持仓明细都提供「智能分析」入口，点击后会打开可拖拽、可缩放的右侧浮层，位置和尺寸会写入浏览器本地 `localStorage` 以便下次恢复。前端默认调用 `/api/ai/analyze-fund/stream` 读取流式分析草稿，服务端会从 Cloudflare runtime context 读取 `DEEPSEEK_API_KEY`，联网抓取基金行情、历史走势、主要指数和东方财富公开网页材料，再交给 Deepseek 流式生成涨跌驱动、后续走势因素、关注点和来源链接；缺少 key 时会明确降级到本地确定性报告，不再伪装成 AI 已就绪。
- 基金分析走势图：基金详情页使用暗色数据雷达风格的 ECharts 图表，默认展示更明显的 K 线和更细的收盘价/净值线；K 线采用接近 TradingView 的实色蜡烛与影线同色风格，少量数据点使用固定窄宽度避免蜡烛过胖，并置于收盘线之上，收盘线仅作为辅助细线。区间收益、最大回撤、年化收益、夏普、波动率、相对沪深 300 基准收益和超额收益作为可选图表指标点击展开，并保留时间范围切换。Tooltip、坐标轴和十字指针统一格式化数值，避免展示浮点长尾。指数、基金、个股历史走势都会叠加 K 线；当上游提供开高低收时优先使用真实 OHLC，当只提供净值/收盘点位时，前端围绕当前收盘价生成窄幅净值蜡烛，避免把前一日收盘误当今日开盘。
- 性能缓存：`/app` 服务端预取指数、推荐基金和沪深 300 基准历史；浏览器本地缓存指数、搜索结果、基金详情、历史走势、当日分时和持仓明细，下次进入先显示缓存再后台刷新；当日分时缓存带版本控制，近似走势在前端也会按基金估算时间二次裁剪，避免旧缓存显示未来时间点；服务端行情接口设置 `s-maxage` 与 `stale-while-revalidate`，上游请求带超时和过期缓存兜底。
- 本地持仓：添加基金后计算市值、成本、盈亏、收益率、组合占比、今日估算收益、账本来源和本地风险提醒。持仓分析顶部仅保留主标题，移除右上角收益率徽标和额外说明文案；顶部默认选中持仓指标，点击「持仓」只切回持仓明细状态，不再滚动到锚点；持仓明细、今日估算收益和累计盈亏都采用统一矩形面板风格，且点击今日估算收益或累计盈亏时只展示对应拆解面板，不再同时展示持仓明细。今日估算收益和累计盈亏指标卡可切换查看单只持仓贡献，且两个明细面板都支持按收益/涨跌率/市值/名称等维度排序，排序按钮用上下箭头展示当前方向并支持正序/反序切换；今日收益拆解支持点击整条持仓元素在对应行下方展开当日行情走势，不再额外显示「当日走势」按钮，并在图表头部标明「真实分时 / 近似走势」、收益口径和具体数据来源，分时走势默认叠加分时 K 线；收益展示统一按基金日涨跌估算，不再用分时首末点价差替代收益口径。今日收益优先使用当天行情；周末或当天暂无交易记录时，改为展示最近行情日的估算收益，并在指标卡和拆解面板中明确标注收益日期；纳斯达克等 QDII/海外基金优先使用可查到的最新盘中估算或最新净值，不再强制回退到旧官方净值；支付宝截图导入识别到的历史当日收益不写入账本，导入后统一按最新行情重新估算。走势优先读取东方财富分钟级分时数据，并在该源为空时回退腾讯分钟线；普通 OTC 基金不会误用同代码股票分时，ETF 联接基金会优先使用东方财富返回的跟踪 ETF 代码读取该 ETF 的腾讯分钟线，按基金自身估算时间截断未发生的分时点，并锚定基金自身当日估算涨跌，其次按已披露主要持仓的分钟线做归一化加权近似，仍不可用时才回退沪深 300 分时。账本、定投、风险诊断和盈亏报告模块沉到持仓面板底部。持仓行情每 1 分钟自动刷新一次，也支持手动刷新；持仓明细按涨红跌绿展示收益、收益率、日涨跌和今日贡献，提升盈亏文字区分度。对已有 6 位代码的持仓，基金名称统一以代码查询返回的官方名称为准，并会回写本地持仓，避免 OCR/手填错名继续展示或同步。持仓明细支持按市值 / 收益率 / 名称排序，持仓明细右上角提供默认折叠的「增加」入口，点击后在该工具栏下方立即展开手动新增持仓表单：输入 6 位基金代码或基金名称后拉取最新净值与官方名称，确认持有金额/成本金额即可写入持仓并触发行情刷新；同时支持手动编辑持有金额与成本金额；编辑后本地即时保存，登录后会先通过 `GET /api/portfolio/default` 恢复服务端组合，读取完成后才通过 `PUT /api/portfolio/default` 同步到 Cloudflare D1，避免新页面的空本地状态覆盖账户持仓（`holdings.recorded_market_value` 列保存手填或截图导入的市值，无 6 位代码的截图持仓也能正确估值）。无 6 位代码的持仓会按名称自动补全真实代码，明细中以「自动补全 / 待完善 / 手动确认」标签区分代码来源；只有持有金额、没有份额的截图/手填持仓会结合导入日期附近历史净值反推估算份额，再用最新净值重算当前市值、累计盈亏、收益率和今日估算收益。持仓明细优先读取东方财富 F10 的已披露股票投资明细（最多 100 条），展示前十大、前十大以外已披露持仓和未逐项披露/非股票资产估算占比；点击其中的股票可查看实时行情与价格走势图（A 股个股历史走势用腾讯前复权日 K 兜底）。
- 自选基金：关注基金但不计入持仓。
- Resend 邮箱登录：`/login` 使用独立极简登录页，验证码登录成功后自动返回 `/app#portfolio`，`/api/auth/challenge` 发送 6 位邮箱验证码并把 Resend 发信失败原因直接返回给前端，`/api/auth/verify` 创建 GG Fund 自有会话；`/api/portfolio/default` 会优先读取登录用户组合。
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
DEEPSEEK_API_KEY=sk_your_key
OCR_SPACE_API_KEY=your_ocr_space_key # 可选；未配置时使用 OCR.space 公共 demo key，频控更严格
```

本地 `bun run dev` 默认使用内存登录状态，即使 OpenNext 读取到 `wrangler.jsonc` 的 D1 绑定也不会走远端 D1；如果需要在本地调试 D1 登录链路，可额外设置 `GG_FUND_AUTH_USE_D1=1`。使用 `onboarding@resend.dev` 时，Resend 只允许发送到账号自己的测试邮箱；清空 `RESEND_API_KEY` 和 `AUTH_EMAIL_FROM` 可回到页面显示 `devCode` 的开发验证码模式。

## 测试

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

`bun run test:e2e` 会运行 Next 核心 smoke spec、`tests/e2e/email-login.spec.ts` 的邮箱登录截图 E2E，以及 `tests/fund-flow.spec.ts` 的基金工作台 E2E。

`bun run coverage` 是硬门槛：配置范围内的 Statements、Branches、Functions、Lines 都必须达到 90% 以上。大型 UI 编排、Route glue 和外部行情适配器不计入单测硬门槛，但仍需通过聚焦单测和 E2E 覆盖关键行为。

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
- `GET /api/market/indices/:code/history?range=1m|3m|6m|1y|all`
- `GET /api/funds/search?q=消费`
- `GET /api/funds/:code`
- `GET /api/funds/:code/history?range=1m|3m|6m|1y|all`
- `GET /api/funds/:code/holdings`
- `GET /api/funds/trending`
- `POST /api/ai/analyze-fund`
- `POST /api/ai/analyze-fund/stream`
- `GET /api/auth/me`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `POST /api/auth/logout`
- `GET /api/portfolio/default`
- `PUT /api/portfolio/default`（登录态下全量同步持仓与自选到 D1）

## 数据来源

金融资产搜索读取东方财富基金搜索、东方财富 A 股行情列表与腾讯证券备用行情，基金结果带上一交易日官方净值，股票结果带实时价格、涨跌幅、开高低、成交量和成交额。基金详情优先读取天天基金 `fundgz` 盘中估算接口，返回 `quoteType: "estimate"`、`estimateTime` 和上一官方净值；若估算源、东方财富移动端净值源或搜索源部分失败，会继续读取东方财富 PC `pingzhongdata` 净值页，并按估算时间/净值日期选择最新可用基金行情。基金持仓优先读取东方财富 F10 `FundArchivesDatas.aspx?type=jjcc` 已披露股票投资明细，失败时回退移动端前十大重仓股接口。指数实时行情读取东方财富 push2 指数接口，覆盖 A/H/美/日/韩/欧核心指数，Cloudflare 边缘不可用时合并腾讯 A 股与新浪全球指数行情，并通过历史日线补齐缺失的必备指数。指数历史走势读取东方财富 push2his，全球指数失败时回退 Naver Chart API 日线接口，北证 50 失败时回退搜狐历史行情；部署验证会检查必备指数全集、每个指数报价字段，以及页面实际使用的 `range=all` 历史数组。历史净值读取东方财富历史净值接口。服务端负责统一 DTO、缓存结果、超时控制和失败回退，前端不直接访问第三方接口。

## 能力状态说明

GG Fund 明确区分三种状态：

- `已接入`：当前页面已调用真实接口或本地能力，例如全球核心指数、A 股实时股价、基金净值、基金发现/搜索、基金诊断、历史净值、本地持仓、自选、养基账本、盈亏报告、风险提醒、支付宝文本文件上传、支付宝截图图片本地 OCR 识别、文本导入、Resend 邮箱登录。
- `可接入`：产品形态已明确但尚未接入真实数据或增强算法，例如平台授权同步和全网用户加减仓榜。
- `路线图`：不声称已提供实时生产能力，例如平台授权同步、全网用户加减仓榜、真实交易下单、Qlib 回测和组合优化。

## 文档和测试要求

见 `AGENTS.md`。每次功能变更必须同步更新 `README.md` 和必要的英文 README / 部署文档，并运行 lint、单元/API、覆盖率、构建和 E2E 验证后再交付。

## 免责声明

本项目展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。

# 免费基础设施部署说明

## 架构

- 前端：Vite 构建后的静态文件，部署目录为 `dist/`。
- 服务端：Bun HTTP server，入口为 `server/index.ts`，默认端口 `8787`，可通过 `PORT` 环境变量覆盖。
- 数据库：Bun 原生 SQLite，默认文件 `./data/gg-fund.sqlite`，可通过 `GG_FUND_DB` 指定持久化路径。
- 行情：服务端接入东方财富/天天基金公开接口，并保留内置 fallback。

## 推荐免费方案

### 前端：Cloudflare Pages

Cloudflare Pages 对静态资源分发友好，全球访问较稳定，也避免依赖 Google Fonts 或外部 CDN。

构建配置：

- Build command: `bun run build`
- Output directory: `dist`
- Node/Bun 环境：使用平台支持的 Bun 或在构建镜像中安装 Bun。

### 服务端：Render / Fly.io / Railway 免费层

Bun 服务端可以部署到支持自定义启动命令和持久磁盘的平台：

- Start command: `bun run start`
- Health check: `/api/health`
- Port: 使用平台注入的 `PORT` 环境变量
- Persistent disk path: 例如 `/data/gg-fund.sqlite`
- Environment: `GG_FUND_DB=/data/gg-fund.sqlite`

免费层可能休眠。前端 UI 已提供加载和错误状态，首次访问慢时用户可以重试。

## 中国大陆与海外可访问性注意事项

- 静态资源全部本地打包，不使用 Google Fonts。
- 第一版不依赖登录、验证码、付费数据库或必须翻墙的核心服务。
- 服务端封装公开行情接口，前端只访问自己的 `/api/*`，减少 CORS 和跨境网络问题。
- 服务端保留内置示例行情 fallback，即使上游公开数据源不可用，页面仍能展示可测试数据。
- SQLite 不需要独立云数据库，部署平台只需提供持久磁盘即可。

## 隐私模型

- 默认持仓和自选保存在浏览器 localStorage。
- SQLite 服务提供线上组合快照和行情缓存能力，可用于后续账号系统。
- 导入导出在浏览器内完成。
- localStorage 数据由用户浏览器管理；清除浏览器数据会删除持仓。

## 后续可选增强

- 接入多个公开免费行情源并按可用性切换。
- 为 SQLite 组合快照增加用户认证和多设备同步。
- 用 Cloudflare Workers + D1 替代 Bun + SQLite，以获得边缘部署能力；这需要重新适配数据库 API。

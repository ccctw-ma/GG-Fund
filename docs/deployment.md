# Cloudflare 部署说明

## 架构

- 前端：Vite 构建后的静态文件，部署目录为 `dist/`。
- API：Cloudflare Pages Functions，入口为 `functions/api/[[path]].ts`，业务逻辑唯一收敛在 `backend/api.ts`。
- 本地开发：`backend/local.ts` 用 Bun 注入内存 D1/KV bindings，复用同一套 Functions API。
- 共享层：`shared/` 保存前后端共用 DTO 和行情适配器。
- 数据库：Cloudflare D1，binding 为 `GG_FUND_DB`，迁移目录为 `migrations/`。
- 缓存：Cloudflare KV，binding 为 `GG_FUND_CACHE`。
- Secret：DeepSeek 和 OAuth 凭证通过 Cloudflare Pages Secret 注入，不进入代码和前端 bundle。

## 本地测试

执行与 CI 一致的测试流水线：

```bash
bun run ci:test
```

该脚本依次执行：

```bash
bun run test
bun run build
bun run test:e2e
```

`ci:test` 会运行 lint、单元/API 测试、coverage、构建和 E2E。本地 E2E 通过 `backend/local.ts` 运行 Cloudflare API 适配器。

覆盖率检查：

```bash
bun run coverage
```

当前全局阈值：statements 70%、branches 60%、functions 70%、lines 70%。

Midscene 检查：

```bash
bun run test:midscene
```

该脚本会读取本机 `~/.zshrc` 中的 Midscene 模型变量并自动启动本地 API/Web 服务。默认验证 Midscene + Playwright 集成；如需强制执行真实模型 `aiAct`，使用 `MIDSCENE_RUN_AI=1 bun run test:midscene`。

## 首次配置

登录 Cloudflare：

```bash
bunx wrangler@3 login
```

如果需要从零创建资源：

```bash
bunx wrangler@3 d1 create gg-fund-db
bunx wrangler@3 kv namespace create GG_FUND_CACHE
bunx wrangler@3 kv namespace create GG_FUND_CACHE --preview
```

将生成的 D1/KV id 写入 `wrangler.toml`。

配置 Pages Secret：

```bash
bunx wrangler@3 pages secret put DEEPSEEK_API_KEY --project-name gg-fund
bunx wrangler@3 pages secret put GITHUB_CLIENT_ID --project-name gg-fund
bunx wrangler@3 pages secret put WECHAT_CLIENT_ID --project-name gg-fund
```

## 手动部署

```bash
bun run deploy:cloudflare
bun run verify:cloudflare
```

`deploy:cloudflare` 会执行：

```bash
bun run build
bunx wrangler@3 d1 migrations apply gg-fund-db --remote
bunx wrangler@3 pages deploy dist --project-name gg-fund --branch master
```

`verify:cloudflare` 默认检查：

```bash
curl https://gg-fund.pages.dev/api/health
curl https://gg-fund.pages.dev/api/market/indices
curl https://gg-fund.pages.dev/api/funds/000001
```

## GitHub CI/CD

`.github/workflows/cloudflare-deploy.yml` 在 push/merge 到 `master` 后自动执行：

- 安装 Bun 依赖。
- 安装 Playwright Chromium。
- 运行 `bun run ci:test`。
- 使用 Wrangler 执行远端 D1 migrations。
- 部署 `dist/` 到 Cloudflare Pages 项目 `gg-fund`。
- 验证线上 `/api/health`、`/api/market/indices`、`/api/funds/000001`。

GitHub 仓库 Secrets 需要配置：

- `CLOUDFLARE_API_TOKEN`：需要 D1 编辑、Pages 部署、KV/Pages 读取相关权限。
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID。

## 可配置环境变量

- `CF_PAGES_PROJECT`：Pages 项目名，默认 `gg-fund`。
- `CF_PAGES_BRANCH`：部署分支名，默认 `master`。
- `CF_D1_DATABASE`：D1 数据库名，默认 `gg-fund-db`。
- `CF_VERIFY_BASE_URL`：线上验证地址，默认 `https://gg-fund.pages.dev`。
- `E2E_API_PORT`：E2E 本地 API 端口，默认 `48787`，避免和默认开发端口 `8787` 冲突。

## 注意事项

- D1/KV binding 名必须与 `wrangler.toml` 和 `backend/api.ts` 保持一致。
- 新增 migrations 后必须先在 CI 或手动部署中执行远端迁移，再验证线上接口。
- Secret 泄露后必须立即在提供商控制台吊销并重新配置。

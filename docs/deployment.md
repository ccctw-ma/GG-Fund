# Cloudflare 部署说明

## 架构

- 应用壳层：Next.js App Router，页面位于 `app/`，通过 OpenNext Cloudflare 进行 Cloudflare 兼容构建。
- 工作区 UI：`components/workspace/FundWorkspace.tsx` 复用现有 `frontend/src/App.tsx`，作为迁移期的主工作台。
- API：优先使用 `app/api/*` Route Handlers；现有 `functions/api/[[path]].ts` + `backend/api.ts` 仍保留用于兼容和参考。
- 共享层：`shared/` 保存前后端共用 DTO 和行情适配器。
- Cloudflare 数据库：现有 D1 binding 为 `GG_FUND_DB`，迁移目录为 `migrations/`。
- Supabase 数据库：新增 `supabase/migrations/202605300001_core_schema.sql` 作为 Auth/Profile/Portfolio/Holdings/Watchlist 的 Postgres 基础 schema。
- 缓存：Cloudflare KV，binding 为 `GG_FUND_CACHE`。
- Secret：DeepSeek 与 Supabase service role key 等服务端凭证必须通过部署环境注入，不进入代码和前端 bundle。

## 本地测试

执行与 CI 尽量一致的测试流水线：

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

当前新增 focused tests 已覆盖：

- `lib/env.ts`
- `lib/http.ts`
- `lib/supabase/browser.ts`
- `lib/supabase/server.ts`
- `features/auth/session.ts`
- `features/market/service.ts`
- `features/portfolio/repository.ts`
- `features/portfolio/localStorage.ts`
- `features/ai/service.ts`

## 首次配置

登录 Cloudflare：

```bash
bunx wrangler@3 login
```

配置 Next / Supabase 相关环境变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEEPSEEK_API_KEY=your-deepseek-api-key
```

如需继续使用现有 Cloudflare D1/KV 资源：

```bash
bunx wrangler@3 d1 create gg-fund-db
bunx wrangler@3 kv namespace create GG_FUND_CACHE
bunx wrangler@3 kv namespace create GG_FUND_CACHE --preview
```

将生成的 D1/KV id 同步写入 `wrangler.toml`、`wrangler.jsonc` 或对应的 OpenNext Cloudflare 配置。

## 手动部署

```bash
bun run build
bun run deploy:cloudflare
bun run verify:cloudflare
```

在新的 Next 架构下，重点验证：

```bash
curl https://gg-fund.pages.dev/api/health
curl https://gg-fund.pages.dev/api/market/indices
curl https://gg-fund.pages.dev/api/funds/000001
```

## GitHub CI/CD

`.github/workflows/cloudflare-deploy.yml` 仍以 Cloudflare 为默认部署目标。随着 Vite → Next/OpenNext 迁移推进，需要确保：

- 安装依赖使用 `bun install --frozen-lockfile --ignore-scripts`。
- 构建步骤从 `vite build` 逐步切换到 `next build` / OpenNext Cloudflare build。
- 线上验证继续覆盖 `/api/health`、`/api/market/indices`、`/api/funds/000001`。

## 可配置环境变量

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPSEEK_API_KEY`
- `CF_PAGES_PROJECT`
- `CF_PAGES_BRANCH`
- `CF_D1_DATABASE`
- `CF_VERIFY_BASE_URL`
- `E2E_API_PORT`

## 注意事项

- `app/api/portfolio/default/route.ts` 会优先读取 OpenNext Cloudflare runtime context 中的 `GG_FUND_DB`，并保留对 dev/test 全局 binding 的兼容；部署前需确保 `wrangler.jsonc` 与实际 Worker binding 保持一致。
- Supabase RLS/表结构迁移需要先在 Supabase 侧执行；持仓和自选策略现在会同时校验 `user_id` 与所属 `portfolio` 的 `user_id`。
- Secret 泄露后必须立即在提供商控制台吊销并重新配置。

# Cloudflare 部署说明

## 架构

- Web/App/API：Next.js App Router，通过 OpenNext 输出 Cloudflare Worker。
- API：`app/api/**/route.ts`，业务逻辑收敛到 `features/*`。
- 数据库/Auth：Supabase Auth + Supabase Postgres + RLS。
- 运行时存储：Cloudflare D1 仍通过 `GG_FUND_DB` 为组合默认快照等 Worker 侧能力提供绑定支持。
- 缓存：Cloudflare KV 可作为行情短缓存，访问封装在 market service 中。
- 支付：Stripe Checkout 与 webhook。
- 邮件：Resend 产品邮件。
- 分析：PostHog。
- Secret：所有服务端 key 通过 Cloudflare Secret 或本地 `.env.local` 注入，不进入前端 bundle。

## 本地测试

执行与 CI 尽量一致的测试流水线：

```bash
bun run lint
bun run test
bun run coverage
bun run build
bun run test:e2e
```

如需验证 Midscene：

```bash
bun run test:midscene
```

## 首次配置

登录 Cloudflare：

```bash
bunx wrangler login
```

配置本地 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
STRIPE_PRICE_ID=price_monthly_default
STRIPE_PRICE_PRO_MONTHLY=price_monthly_default
STRIPE_ALLOWED_PRICE_IDS=price_monthly_default,price_annual_optional
RESEND_API_KEY=re_your_key
AUTH_EMAIL_FROM="GG Fund <login@example.com>"
DEEPSEEK_API_KEY=your-deepseek-api-key
POSTHOG_API_KEY=phx_your_private_key
```

如需继续使用现有 Cloudflare D1/KV 资源：

```bash
bunx wrangler d1 create gg-fund-db
bunx wrangler kv namespace create GG_FUND_CACHE
bunx wrangler kv namespace create GG_FUND_CACHE --preview
```

将生成的 D1/KV id 同步写入 `wrangler.jsonc`。

## 手动部署

```bash
bun run deploy:cloudflare
bun run verify:cloudflare
```

默认验证目标：

```bash
curl https://gg-fund.workers.dev/api/health
curl https://gg-fund.workers.dev/api/market/indices
curl https://gg-fund.workers.dev/api/funds/000001
```

## GitHub CI/CD

`.github/workflows/cloudflare-deploy.yml` 使用 Bun 安装依赖，并直接执行 OpenNext Cloudflare Worker 构建、部署与验证：

- `bun install --frozen-lockfile --ignore-scripts`
- `bunx @opennextjs/cloudflare build`
- `bunx @opennextjs/cloudflare deploy`
- `bun run verify:cloudflare`

## 可配置环境变量

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_ALLOWED_PRICE_IDS`
- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`
- `DEEPSEEK_API_KEY`
- `POSTHOG_API_KEY`
- `CF_WORKER_NAME`
- `CF_VERIFY_BASE_URL`

## 注意事项

- `app/api/portfolio/default/route.ts` 会优先读取 OpenNext Cloudflare runtime context 中的 `GG_FUND_DB`，并保留对 dev/test 全局 binding 的兼容；部署前需确保 `wrangler.jsonc` 与实际 Worker binding 保持一致。
- Supabase RLS/表结构迁移需要先在 Supabase 侧执行；持仓和自选策略现在会同时校验 `user_id` 与所属 `portfolio` 的 `user_id`。
- Secret 泄露后必须立即在提供商控制台吊销并重新配置。

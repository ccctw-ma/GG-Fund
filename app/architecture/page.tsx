import Link from 'next/link';

const flowSteps = [
  { label: '用户操作', detail: '行情、账户、导入、AI 分析', tone: 'mint' },
  { label: 'Next.js App Router', detail: '页面、Route Handlers、SSR 预取', tone: 'gold' },
  { label: 'Cloudflare Worker', detail: 'OpenNext 输出、边缘运行、缓存兜底', tone: 'blue' },
  { label: '市场与 AI 源', detail: '东方财富、腾讯、Naver、OCR.space、DeepSeek', tone: 'violet' },
];

const architectureLayers = [
  {
    title: '体验层',
    kicker: 'Browser Workspace',
    items: ['React 工作台', 'ECharts 趋势与 K 线', 'localStorage 本地账本', 'Playwright 覆盖核心链路'],
  },
  {
    title: '应用层',
    kicker: 'Next.js 16',
    items: ['App Router 页面', 'Route Handler API', '服务端首屏预取', 'Resend 邮箱 OTP 会话'],
  },
  {
    title: '边缘层',
    kicker: 'Cloudflare First',
    items: ['OpenNext Worker', 'D1 组合存储', 'KV/R2 可扩展绑定', 'Wrangler 远程迁移与部署'],
  },
  {
    title: '数据层',
    kicker: 'Market Adapters',
    items: ['天天基金估算净值', '东方财富指数/基金/持仓', '腾讯 A 股日 K 与分时', 'Naver/新浪/搜狐全球指数兜底'],
  },
];

const dataPipelines = [
  ['行情请求', '浏览器缓存命中优先', 'Route Handler 聚合多源', '统一 DTO 返回前端'],
  ['持仓导入', '图片或文件进入导入助手', 'OCR.space 识别文字', 'DeepSeek 结构化为持仓'],
  ['AI 分析', '前端打开流式面板', 'Worker 收集行情和网页材料', 'DeepSeek 分段生成报告'],
  ['部署验证', 'GitHub Actions 构建', 'D1 迁移与 Worker 发布', '线上 API 拨测闭环'],
];

const qualityGates = ['lint', 'unit/API test', 'coverage >= 90%', 'build', 'E2E', 'Cloudflare deploy watch'];

export default function ArchitecturePage() {
  return (
    <main className="fund-shell architecture-page text-ink" style={{ minHeight: '100vh' }}>
      <div className="fund-page architecture-page-inner">
        <section className="architecture-hero" aria-labelledby="architecture-title">
          <div>
            <span className="section-kicker">Technical Architecture</span>
            <h1 id="architecture-title" className="hero-title">GG Fund 技术架构地图</h1>
            <p className="hero-subtitle">
              这个页面把工作台背后的请求链路、边缘运行时、数据源适配、AI 识别和质量门禁串成一张可读的架构图，方便快速理解系统如何从浏览器一路闭环到 Cloudflare。
            </p>
            <div className="hero-actions">
              <Link className="gold-cta" href="/app">进入工作台</Link>
              <Link className="ghost-cta" href="/app#portfolio">查看账户页</Link>
            </div>
          </div>
          <div className="architecture-orbit" aria-label="架构核心能力">
            <span className="architecture-orbit-core">GG Fund</span>
            <span className="architecture-node node-browser">React</span>
            <span className="architecture-node node-edge">Worker</span>
            <span className="architecture-node node-data">Market</span>
            <span className="architecture-node node-ai">AI</span>
          </div>
        </section>

        <section className="architecture-flow" aria-label="端到端请求流">
          {flowSteps.map((step, index) => (
            <article key={step.label} className={`architecture-flow-step architecture-flow-${step.tone}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </section>

        <section className="architecture-layers" aria-label="系统分层">
          {architectureLayers.map((layer) => (
            <article key={layer.title} className="architecture-layer-card">
              <span className="section-kicker">{layer.kicker}</span>
              <h2>{layer.title}</h2>
              <ul>
                {layer.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </section>

        <section className="architecture-pipelines" aria-labelledby="pipeline-title">
          <div className="architecture-section-copy">
            <span className="section-kicker">Runtime Pipelines</span>
            <h2 id="pipeline-title">四条核心链路</h2>
            <p>每条链路都尽量把不可控的外部接口关在服务端适配器里，前端只消费稳定 DTO 和明确的状态。</p>
          </div>
          <div className="architecture-pipeline-list">
            {dataPipelines.map((pipeline) => (
              <ol key={pipeline[0]} className="architecture-pipeline">
                {pipeline.map((item) => <li key={item}>{item}</li>)}
              </ol>
            ))}
          </div>
        </section>

        <section className="architecture-quality" aria-labelledby="quality-title">
          <div>
            <span className="section-kicker">Quality Gate</span>
            <h2 id="quality-title">上线前必须经过的闸门</h2>
            <p>功能变更不会只停留在本地可运行，必须经过覆盖率、构建、E2E 和部署观察，最后用生产 API 拨测收尾。</p>
          </div>
          <div className="architecture-gate-row">
            {qualityGates.map((gate) => <span key={gate}>{gate}</span>)}
          </div>
        </section>
      </div>
    </main>
  );
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const readmeEn = readFileSync('README.en.md', 'utf8');

describe('README content reconstruction', () => {
  it('documents Chinese route and capability guardrails', () => {
    expect(readme).toContain('全景工具宇宙');
    expect(readme).toContain('已接入');
    expect(readme).toContain('可接入');
    expect(readme).toContain('路线图');
    expect(readme).toContain('根路径 `/` 会直接跳转到 `/app` 工作台');
    expect(readme).toContain('`/settings`');
    expect(readme).toContain('`/app/portfolio`');
    expect(readme).toContain('基金发现、基金诊断、本地持仓、自选观察、AI 研究摘要为已接入；基金横向对比、ETF / LOF 专题、定投/分批行动路径明确标注为可接入。');
    expect(readme).toContain('Qlib 回测和组合优化');
    expect(readme).not.toContain('保留基金详情路由');
    expect(readme).toContain('不构成投资建议');
  });

  it('keeps the English README aligned with live, connectable, and roadmap language', () => {
    expect(readmeEn).toContain('Tool Universe');
    expect(readmeEn).toContain('Live');
    expect(readmeEn).toContain('Connectable');
    expect(readmeEn).toContain('Roadmap');
    expect(readmeEn).toContain('the root path `/` redirects directly to the `/app` workspace');
    expect(readmeEn).toContain('`/settings`');
    expect(readmeEn).toContain('`/app/portfolio`');
    expect(readmeEn).toContain('fund discovery, diagnostics, local holdings, watchlist, and AI research summaries are live today; fund comparison, ETF / LOF topics, and recurring investment paths are explicitly marked as connectable.');
    expect(readmeEn).toContain('Qlib backtesting');
    expect(readmeEn).not.toContain('fund detail, portfolio, and settings pages kept available');
    expect(readmeEn).toContain('not investment advice');
  });
});

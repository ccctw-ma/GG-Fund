import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const readmeEn = readFileSync('README.en.md', 'utf8');

describe('README content reconstruction', () => {
  it('documents Chinese route and capability guardrails', () => {
    expect(readme).not.toContain('全景工具宇宙');
    expect(readme).not.toContain('工具宇宙');
    expect(readme).not.toContain('基金与股票研究工具');
    expect(readme).toContain('根路径 `/` 会直接跳转到 `/app` 工作台');
    expect(readme).toContain('`/settings` 目前提供基础说明入口');
    expect(readme).toContain('`/app/portfolio`');
    expect(readme).toContain('四大指数行情');
    expect(readme).toContain('金融资产搜索');
    expect(readme).toContain('养基宝式账本能力');
    expect(readme).toContain('多平台导入助手');
    expect(readme).toContain('支付宝 `.txt` / `.csv` / `.json`');
    expect(readme).toContain('浏览器本地 OCR');
    expect(readme).toContain('Resend 邮箱登录');
    expect(readme).toContain('Qlib 回测和组合优化');
    expect(readme).not.toContain('保留基金详情路由');
    expect(readme).toContain('不构成投资建议');
  });

  it('keeps the English README aligned with live, connectable, and roadmap language', () => {
    expect(readmeEn).not.toContain('Tool Universe');
    expect(readmeEn).not.toContain('Fund and stock research tools');
    expect(readmeEn).toContain('the root path `/` redirects directly to the `/app` workspace');
    expect(readmeEn).toContain('`/settings` currently provides a basic information entry');
    expect(readmeEn).toContain('`/app/portfolio`');
    expect(readmeEn).toContain('Core index market');
    expect(readmeEn).toContain('Financial asset search');
    expect(readmeEn).toContain('Yangjibao-style portfolio ledger');
    expect(readmeEn).toContain('Multi-platform import assistant');
    expect(readmeEn).toContain('Alipay `.txt` / `.csv` / `.json`');
    expect(readmeEn).toContain('in-browser OCR');
    expect(readmeEn).toContain('Resend email login');
    expect(readmeEn).toContain('Qlib backtesting');
    expect(readmeEn).not.toContain('fund detail, portfolio, and settings pages kept available');
    expect(readmeEn).toContain('not investment advice');
  });
});

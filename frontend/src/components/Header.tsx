import { BarChart3, Database, LineChart, ShieldCheck, Sparkles, UserRound } from 'lucide-react';

export function Header() {
  return (
    <header className="banking-header">
      <a href="#top" className="brand-lockup" aria-label="GG Fund 首页">
        <span className="brand-mark">GG</span>
        <span>
          <span className="block text-xs uppercase tracking-[0.22em] text-ink/45">Fund Bank</span>
          <h1 className="font-display text-xl tracking-[-0.04em] text-ink">中国基金行情</h1>
        </span>
      </a>
      <nav className="bank-nav" aria-label="主要功能">
        {[
          ['#markets', '大盘', BarChart3],
          ['#funds', '基金搜索', LineChart],
          ['#auth', '登录', UserRound],
          ['#ai-analysis', 'AI分析', ShieldCheck],
          ['#settings', '基建', Database],
        ].map(([href, label, Icon]) => (
          <a key={String(href)} href={String(href)}>
            <Icon className="h-4 w-4" /> {String(label)}
          </a>
        ))}
      </nav>
      <a className="header-action" href="#ai-analysis">
        <Sparkles className="h-4 w-4" /> 智能投研
      </a>
    </header>
  );
}

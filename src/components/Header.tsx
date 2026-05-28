import { BarChart3, Database, LineChart, ShieldCheck, UserRound } from 'lucide-react';

export function Header() {
  return (
    <header className="mb-6 border-b-2 border-ink pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker">GG Fund Market Letter · Cloudflare Edition</div>
          <h1 className="font-display mt-2 text-5xl font-black leading-none text-ink sm:text-7xl">中国基金行情</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">实时指数、基金估算、账户与 AI 研究笔记，排版参考金融报纸和交易终端。</p>
        </div>
        <nav className="grid grid-cols-2 gap-2 text-sm md:flex" aria-label="主要功能">
          {[
            ['#markets', '大盘', BarChart3],
            ['#funds', '基金搜索', LineChart],
            ['#auth', '登录', UserRound],
            ['#ai-analysis', 'AI分析', ShieldCheck],
            ['#settings', '基建', Database],
          ].map(([href, label, Icon]) => (
            <a key={String(href)} href={String(href)} className="inline-flex items-center justify-center gap-2 border border-ink px-3 py-2 font-bold text-ink transition hover:bg-ink hover:text-paper">
              <Icon className="h-4 w-4" /> {String(label)}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

import { BarChart3, Database, LineChart, ShieldCheck } from 'lucide-react';
import { Badge } from './ui/badge';

export function Header() {
  return (
    <header className="sticky top-4 z-20 mb-8 rounded-[2rem] border border-white/70 bg-white/75 px-6 py-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20">
            <LineChart className="h-7 w-7" />
          </div>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge tone="blue">GG Fund</Badge>
              <Badge tone="green"><ShieldCheck className="h-3 w-3" /> 本地隐私</Badge>
              <Badge tone="slate"><Database className="h-3 w-3" /> SQLite</Badge>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">中国基金行情与持仓分析</h1>
            <p className="text-sm text-slate-500">真实公开行情 + 本地组合分析 + 免费数据库服务。</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="主要功能">
          {[
            ['#markets', '大盘', BarChart3],
            ['#funds', '基金搜索', LineChart],
            ['#portfolio', '我的持仓', ShieldCheck],
            ['#settings', '设置', Database],
          ].map(([href, label, Icon]) => (
            <a key={String(href)} href={String(href)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
              <Icon className="h-4 w-4" /> {String(label)}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

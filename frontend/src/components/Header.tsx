import { BarChart3, LineChart, LogOut, ShieldCheck, Smartphone, Sparkles, UserRound, WalletCards } from 'lucide-react';
import type { UiAuthSession } from '../supabaseAuth';

type HeaderProps = {
  session?: UiAuthSession;
  onLogout: () => void;
  logoutPending?: boolean;
};

export function Header({ session, onLogout, logoutPending = false }: HeaderProps) {
  return (
    <header className="banking-header">
      <a href="#top" className="brand-lockup" aria-label="GG Fund 首页">
        <span className="brand-mark">GG</span>
        <span>
          <span className="block text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Trusted Fund OS</span>
          <h1 className="font-display text-xl tracking-[-0.04em] text-[var(--text-strong)]">GG Fund</h1>
        </span>
      </a>
      <nav className="bank-nav" aria-label="主要功能">
        {[
          ['#overview', '账户总览', WalletCards],
          ['#features', '交易工具', LineChart],
          ['#security', '安全隐私', ShieldCheck],
          ['#download', '移动端', Smartphone],
          ['#workspace', '行情工作台', BarChart3],
        ].map(([href, label, Icon]) => (
          <a key={String(href)} href={String(href)}>
            <Icon className="h-4 w-4" /> {String(label)}
          </a>
        ))}
      </nav>
      <section className="profile-card" aria-label="个人信息">
        <div className="profile-avatar"><UserRound className="h-4 w-4" /></div>
        <div className="profile-copy">
          <span>个人信息</span>
          <strong>{session ? session.user.displayName || session.user.identifier : '未登录'}</strong>
          <small>{session ? `${session.user.provider} · ${session.user.identifier}` : '查看登录情况'}</small>
        </div>
        {session ? (
          <button className="profile-action" onClick={onLogout} disabled={logoutPending} aria-label="退出登录">
            <LogOut className="h-4 w-4" /> {logoutPending ? '退出中' : '退出'}
          </button>
        ) : (
          <a className="profile-action" href="#auth"><UserRound className="h-4 w-4" /> 登录</a>
        )}
      </section>
      <a className="header-action header-action-secondary" href="#ai-analysis">
        <Sparkles className="h-4 w-4" /> 智能投研
      </a>
    </header>
  );
}

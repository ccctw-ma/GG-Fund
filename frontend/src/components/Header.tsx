import { BarChart3, Compass, LogOut, UserRound, WalletCards } from 'lucide-react';
import type { AuthSessionResponse } from '../api';

export type WorkspacePage = 'overview' | 'tools' | 'workspace' | 'portfolio';

type HeaderProps = {
  session?: AuthSessionResponse;
  onLogout: () => void;
  logoutPending?: boolean;
  activePage: WorkspacePage;
  onPageChange: (page: WorkspacePage) => void;
};

const navItems = [
  { id: 'overview', label: '总览', icon: Compass },
  { id: 'tools', label: '工具宇宙', icon: BarChart3 },
  { id: 'workspace', label: '行情工作台', icon: WalletCards },
  { id: 'portfolio', label: '组合账户', icon: UserRound },
] satisfies Array<{ id: WorkspacePage; label: string; icon: typeof Compass }>;

export function Header({ session, onLogout, logoutPending = false, activePage, onPageChange }: HeaderProps) {
  return (
    <header className="banking-header">
      <button type="button" className="brand-lockup" aria-label="GG Fund 首页" onClick={() => onPageChange('overview')}>
        <span className="brand-mark">GG</span>
        <span>
          <span className="block text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Trusted Fund OS</span>
          <h1 className="font-display text-xl tracking-[-0.04em] text-[var(--text-strong)]">GG Fund</h1>
        </span>
      </button>
      <nav className="bank-nav" aria-label="主要页面">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={activePage === id ? 'bank-nav-active' : undefined}
            aria-current={activePage === id ? 'page' : undefined}
            onClick={() => onPageChange(id)}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>
      <section className="profile-card" aria-label="账户状态">
        <div className="profile-avatar"><UserRound className="h-4 w-4" /></div>
        <div className="profile-copy">
          <strong>{session ? session.user.displayName || session.user.identifier : '未登录'}</strong>
          {session && <small>Resend · {session.user.identifier}</small>}
        </div>
        {session ? (
          <button className="profile-action" onClick={onLogout} disabled={logoutPending} aria-label="退出登录">
            <LogOut className="h-4 w-4" /> {logoutPending ? '退出中' : '退出'}
          </button>
        ) : (
          <button type="button" className="profile-action" onClick={() => { window.location.href = '/login'; }}>
            登录
          </button>
        )}
      </section>
    </header>
  );
}

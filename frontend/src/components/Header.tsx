import { BarChart3, GitBranch, LogOut, UserRound } from 'lucide-react';
import type { AuthSessionResponse } from '../api';

export type WorkspacePage = 'workspace' | 'portfolio';

type HeaderProps = {
  session?: AuthSessionResponse;
  onLogout: () => void;
  logoutPending?: boolean;
  activePage: WorkspacePage;
  onPageChange: (page: WorkspacePage) => void;
};

const navItems = [
  { id: 'workspace', label: '行情', icon: BarChart3 },
  { id: 'portfolio', label: '账户', icon: UserRound },
] satisfies Array<{ id: WorkspacePage; label: string; icon: typeof BarChart3 }>;

function shortAccountLabel(session?: AuthSessionResponse) {
  const label = session?.user.displayName || session?.user.identifier;
  if (!label) return '未登录';
  const [name, domain] = label.split('@');
  if (!domain) return label;
  return `${name.slice(0, 8)}@${domain}`;
}

export function Header({ session, onLogout, logoutPending = false, activePage, onPageChange }: HeaderProps) {
  return (
    <header className="banking-header">
      <button type="button" className="brand-lockup" aria-label="GG Fund 行情" onClick={() => onPageChange('workspace')}>
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
        <button type="button" onClick={() => { window.location.href = '/architecture'; }}>
          <GitBranch className="h-4 w-4" /> 架构
        </button>
      </nav>
      <section className="profile-card" aria-label="账户状态">
        <div className="profile-avatar"><UserRound className="h-4 w-4" /></div>
        <div className="profile-copy">
          <strong>{shortAccountLabel(session)}</strong>
          {session && <small>Resend OTP</small>}
        </div>
        {session ? (
          <button className="profile-action" onClick={onLogout} disabled={logoutPending} aria-label="退出登录">
            <LogOut className="h-4 w-4" />
            <span>{logoutPending ? '退出中' : '退出'}</span>
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

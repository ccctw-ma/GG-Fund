import { Code2, Mail, MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
import { api, type AuthProvider, type AuthSessionResponse } from '../api';

const providers: Array<{ provider: AuthProvider; label: string; icon: typeof Mail; placeholder: string }> = [
  { provider: 'email', label: '邮箱', icon: Mail, placeholder: 'name@example.com' },
  { provider: 'github', label: 'GitHub', icon: Code2, placeholder: 'github 用户名' },
  { provider: 'wechat', label: '微信', icon: MessageCircle, placeholder: '微信号 / OpenID' },
  { provider: 'phone', label: '电话', icon: Phone, placeholder: '手机号' },
];

export function AuthPanel() {
  const [provider, setProvider] = useState<AuthProvider>('email');
  const [identifier, setIdentifier] = useState('demo@example.com');
  const [session, setSession] = useState<AuthSessionResponse>();
  const [error, setError] = useState<string>();
  const active = providers.find((item) => item.provider === provider)!;

  async function login() {
    setError(undefined);
    try {
      setSession(await api.startAuth(provider, identifier));
    } catch (event) {
      setError(event instanceof Error ? event.message : '登录失败');
    }
  }

  return (
    <section className="newspaper-panel border-ink/10 bg-paper p-5" id="auth">
      <div className="section-kicker">Account desk</div>
      <h2 className="font-display text-2xl text-ink">登录 / 账户</h2>
      <p className="mt-2 text-sm leading-6 text-ink/65">支持邮箱、GitHub、微信、电话的统一登录入口；生产环境可替换为真实 OAuth/短信服务。</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {providers.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.provider}
              className={item.provider === provider ? 'auth-tab auth-tab-active' : 'auth-tab'}
              onClick={() => setProvider(item.provider)}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <input className="newspaper-input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={active.placeholder} aria-label="登录标识" />
        <button className="ink-button" onClick={login}>登录</button>
      </div>
      {session && <p className="mt-3 text-sm text-emerald-700">已创建 {session.user.provider} 会话：{session.user.identifier}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

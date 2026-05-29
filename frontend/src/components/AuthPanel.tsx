import { Code2, LogOut, Mail, MessageCircle, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type AuthProvider, type AuthSessionResponse } from '../api';

const otpProviders = [
  { provider: 'email' as const, label: '邮箱验证码', icon: Mail, placeholder: 'name@example.com' },
  { provider: 'phone' as const, label: '短信验证码', icon: Phone, placeholder: '手机号' },
];

const oauthProviders = [
  { provider: 'github' as const, label: 'GitHub OAuth', icon: Code2 },
  { provider: 'wechat' as const, label: '微信扫码', icon: MessageCircle },
];

export function AuthPanel() {
  const [provider, setProvider] = useState<AuthProvider>('email');
  const [identifier, setIdentifier] = useState('demo@example.com');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState<AuthSessionResponse>();
  const [oauthUrl, setOauthUrl] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<'idle' | 'sending' | 'verifying' | 'logout'>('idle');
  const active = otpProviders.find((item) => item.provider === provider) ?? otpProviders[0];

  useEffect(() => {
    if (!api.hasSessionToken()) return;
    api.getCurrentUser()
      .then(setSession)
      .catch(() => api.clearSessionToken());
  }, []);

  function switchProvider(next: AuthProvider) {
    if (next === provider) return;
    setProvider(next);
    setIdentifier(next === 'email' ? 'demo@example.com' : '');
    setChallengeId('');
    setCode('');
    setError(undefined);
  }

  async function startChallenge() {
    if (!identifier.trim()) {
      setError('请先输入登录标识');
      return;
    }
    setError(undefined);
    setPending('sending');
    try {
      const challenge = await api.startAuthChallenge(provider, identifier.trim());
      setChallengeId(challenge.challengeId);
      setCode(challenge.devCode ?? '');
    } catch (event) {
      setError(event instanceof Error ? event.message : '发送验证码失败');
    } finally {
      setPending('idle');
    }
  }

  async function verifyChallenge() {
    if (!challengeId || code.length < 4) {
      setError('请先获取并输入验证码');
      return;
    }
    setError(undefined);
    setPending('verifying');
    try {
      const result = await api.verifyAuthChallenge(challengeId, code.trim());
      api.saveSessionToken(result.session.token);
      setSession(result);
      setChallengeId('');
    } catch (event) {
      setError(event instanceof Error ? event.message : '验证失败');
    } finally {
      setPending('idle');
    }
  }

  async function logout() {
    setError(undefined);
    setPending('logout');
    try {
      await api.logout();
    } catch {
      // Local token still needs to be cleared when the remote session already expired.
    }
    api.clearSessionToken();
    setSession(undefined);
    setChallengeId('');
    setCode('');
    setPending('idle');
  }

  async function loadOAuth(providerName: 'github' | 'wechat') {
    setError(undefined);
    try {
      const result = await api.getOAuthUrl(providerName);
      setOauthUrl(result.authUrl);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'OAuth 配置读取失败');
    }
  }

  return (
    <section className="market-card p-6" id="auth">
      <div className="section-kicker">账户与身份</div>
      <h2 className="font-display mt-2 text-3xl font-black tracking-[-0.04em] text-ink">安全登录</h2>
      <p className="mt-2 text-sm leading-6 text-ink/62">邮箱/电话走 OTP challenge，GitHub/微信走 OAuth 跳转元数据，不再直接创建假会话。</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {otpProviders.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.provider} className={item.provider === provider ? 'auth-tab auth-tab-active' : 'auth-tab'} onClick={() => switchProvider(item.provider)}>
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <input className="newspaper-input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={active.placeholder} aria-label="登录标识" />
        <button className="ink-button" onClick={startChallenge} disabled={pending === 'sending' || !identifier.trim()}>{pending === 'sending' ? '发送中…' : '发送验证码'}</button>
        <button className="ink-button" onClick={verifyChallenge} disabled={!challengeId || pending === 'verifying'}>{pending === 'verifying' ? '验证中…' : '验证登录'}</button>
      </div>
      {challengeId && <p className="mt-2 rounded-2xl bg-[#e5f7e9] px-3 py-2 text-xs font-bold text-[#047857]">开发环境验证码：{code}</p>}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {oauthProviders.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.provider} className="auth-tab" onClick={() => loadOAuth(item.provider)}>
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </div>
      {oauthUrl && <p className="mt-2 break-all rounded-2xl bg-white/60 px-3 py-2 text-xs text-ink/60">OAuth 跳转：{oauthUrl}</p>}
      {session && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[#e5f7e9] px-3 py-2 text-sm font-bold text-emerald-700 sm:flex-row sm:items-center sm:justify-between">
          <span>已登录：{session.user.identifier}</span>
          <button className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs text-emerald-800" onClick={logout} disabled={pending === 'logout'}><LogOut className="h-3 w-3" />{pending === 'logout' ? '退出中…' : '退出登录'}</button>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
    </section>
  );
}

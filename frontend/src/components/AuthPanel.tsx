import { Code2, LogOut, MailCheck, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { api, type AuthSessionResponse } from '../api';

const oauthProviders = [
  { provider: 'github' as const, label: 'GitHub OAuth', icon: Code2 },
  { provider: 'wechat' as const, label: '微信扫码', icon: MessageCircle },
];

type AuthPanelProps = {
  session?: AuthSessionResponse;
  onSessionChange: (session?: AuthSessionResponse) => void;
};

export function AuthPanel({ session, onSessionChange }: AuthPanelProps) {
  const [identifier, setIdentifier] = useState('demo@example.com');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [oauthUrl, setOauthUrl] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<'idle' | 'sending' | 'verifying' | 'logout'>('idle');

  async function startChallenge() {
    const email = identifier.trim();
    if (!email) {
      setError('请先输入邮箱地址');
      return;
    }
    setError(undefined);
    setMessage(undefined);
    setPending('sending');
    try {
      const challenge = await api.startAuthChallenge('email', email);
      setChallengeId(challenge.challengeId);
      setCode(challenge.devCode ?? '');
      setMessage(challenge.devCode ? '本地开发环境未配置邮件服务，请使用下方开发验证码。' : `验证码已真实发送到 ${email}，请查收后输入。`);
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
      onSessionChange(result);
      setChallengeId('');
      setCode('');
      setMessage('登录成功，个人信息栏已更新。');
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
    onSessionChange(undefined);
    setChallengeId('');
    setCode('');
    setMessage('已退出登录。');
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
      <h2 className="font-display mt-2 text-3xl font-black tracking-[-0.04em] text-ink">邮箱验证码登录</h2>
      <p className="mt-2 text-sm leading-6 text-ink/62">配置 RESEND_API_KEY 与 AUTH_EMAIL_FROM 后会真实发送邮箱验证码；未配置时仅显示本地开发验证码。</p>

      <div className="mt-5 grid gap-2 md:grid-cols-[1fr_auto]">
        <input className="newspaper-input" type="email" inputMode="email" autoComplete="email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="name@example.com" aria-label="邮箱地址" />
        <button className="ink-button" onClick={startChallenge} disabled={pending === 'sending' || !identifier.trim()}>{pending === 'sending' ? '发送中…' : '发送验证码'}</button>
      </div>
      {challengeId && (
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
          <input className="newspaper-input" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="请输入邮箱验证码" aria-label="邮箱验证码" />
          <button className="ink-button" onClick={verifyChallenge} disabled={!challengeId || pending === 'verifying'}>{pending === 'verifying' ? '验证中…' : '验证登录'}</button>
        </div>
      )}
      {code && <p className="mt-2 rounded-2xl border border-[var(--mint)]/20 bg-[var(--mint)]/10 px-3 py-2 text-xs font-bold text-[var(--mint)]">开发环境验证码：{code}</p>}
      {message && <p className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--mint)]/20 bg-[var(--mint)]/10 p-3 text-sm font-bold text-[var(--mint)]"><MailCheck className="h-4 w-4" />{message}</p>}

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
      {oauthUrl && <p className="mt-2 break-all rounded-2xl bg-white/10 px-3 py-2 text-xs text-[var(--text-muted)]">OAuth 跳转：{oauthUrl}</p>}
      {session && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[var(--mint)]/20 bg-[var(--mint)]/10 px-3 py-2 text-sm font-bold text-[var(--mint)] sm:flex-row sm:items-center sm:justify-between">
          <span>已登录：{session.user.identifier}</span>
          <button className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-[var(--text-strong)]" onClick={logout} disabled={pending === 'logout'}><LogOut className="h-3 w-3" />{pending === 'logout' ? '退出中…' : '退出登录'}</button>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-bold text-red-300">{error}</p>}
    </section>
  );
}

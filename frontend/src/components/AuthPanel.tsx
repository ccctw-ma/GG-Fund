import { Code2, Mail, MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
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
  const active = otpProviders.find((item) => item.provider === provider) ?? otpProviders[0];

  async function startChallenge() {
    setError(undefined);
    try {
      const challenge = await api.startAuthChallenge(provider, identifier);
      setChallengeId(challenge.challengeId);
      setCode(challenge.devCode ?? '');
    } catch (event) {
      setError(event instanceof Error ? event.message : '发送验证码失败');
    }
  }

  async function verifyChallenge() {
    setError(undefined);
    try {
      setSession(await api.verifyAuthChallenge(challengeId, code));
    } catch (event) {
      setError(event instanceof Error ? event.message : '验证失败');
    }
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
            <button key={item.provider} className={item.provider === provider ? 'auth-tab auth-tab-active' : 'auth-tab'} onClick={() => setProvider(item.provider)}>
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <input className="newspaper-input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={active.placeholder} aria-label="登录标识" />
        <button className="ink-button" onClick={startChallenge}>发送验证码</button>
        <button className="ink-button" onClick={verifyChallenge} disabled={!challengeId}>验证登录</button>
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
      {session && <p className="mt-3 rounded-2xl bg-[#e5f7e9] px-3 py-2 text-sm font-bold text-emerald-700">已通过 {session.user.provider} 登录：{session.user.identifier}</p>}
      {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
    </section>
  );
}

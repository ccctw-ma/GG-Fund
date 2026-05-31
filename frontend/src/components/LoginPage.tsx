'use client';

import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type AuthChallengeResponse, type AuthSessionResponse } from '../api';

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<AuthChallengeResponse>();
  const [session, setSession] = useState<AuthSessionResponse>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<'idle' | 'loading' | 'sending' | 'verifying'>('loading');

  useEffect(() => {
    api.getCurrentUser()
      .then(setSession)
      .catch(() => undefined)
      .finally(() => setPending('idle'));
  }, []);

  async function sendCode() {
    const email = identifier.trim();
    if (!email) {
      setError('请先输入邮箱地址');
      return;
    }

    setError(undefined);
    setMessage(undefined);
    setPending('sending');
    try {
      const nextChallenge = await api.startAuthChallenge('email', email);
      setChallenge(nextChallenge);
      setCode(nextChallenge.devCode ?? '');
      setMessage(nextChallenge.devCode ? `开发环境验证码：${nextChallenge.devCode}` : `验证码已发送到 ${email}，10 分钟内有效。`);
    } catch (event) {
      setError(event instanceof Error ? event.message : '发送验证码失败');
    } finally {
      setPending('idle');
    }
  }

  async function login() {
    if (!challenge) {
      await sendCode();
      return;
    }

    const otp = code.trim();
    if (!otp) {
      setError('请输入邮箱验证码');
      return;
    }

    setError(undefined);
    setPending('verifying');
    try {
      const nextSession = await api.verifyAuthChallenge(challenge.challengeId, otp);
      api.saveSessionToken(nextSession.session.token);
      setSession(nextSession);
      setChallenge(undefined);
      setCode('');
      setMessage('登录成功，已保存当前浏览器会话。');
    } catch (event) {
      setError(event instanceof Error ? event.message : '验证码验证失败');
    } finally {
      setPending('idle');
    }
  }

  return (
    <main className="login-page" aria-labelledby="login-title">
      <a className="login-back-link" href="/app#portfolio"><ArrowLeft className="h-4 w-4" />返回工作台</a>
      <section className="login-card">
        <div className="login-brand">
          <span className="login-logo-mark">GG</span>
          <strong>GG Fund</strong>
          <em>开放平台</em>
        </div>

        <div className="login-layout">
          <form className="login-form" onSubmit={(event) => { event.preventDefault(); void login(); }}>
            <div>
              <p className="login-kicker">Resend Email OTP</p>
              <h1 id="login-title">登录 GG Fund</h1>
              <p>使用邮箱进入你的基金组合和本地备份工作台。</p>
            </div>

            <label className="login-input-shell">
              <span>邮箱</span>
              <input type="email" inputMode="email" autoComplete="email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="name@example.com" aria-label="邮箱地址" />
            </label>

            <div className="login-code-row">
              <label className="login-input-shell">
                <span>验证码</span>
                <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="请输入验证码" aria-label="邮箱验证码" />
              </label>
              <button type="button" className="login-code-button" onClick={sendCode} disabled={pending === 'sending' || !identifier.trim()}>
                {pending === 'sending' ? '发送中' : '发送验证码'}
              </button>
            </div>

            <p className="login-terms">注册登录即代表已阅读并同意 GG Fund 的服务说明与隐私保护约定。验证码仅用于身份验证，不构成投资建议。</p>

            <button type="submit" className="login-submit" disabled={pending === 'loading' || pending === 'verifying'}>
              {pending === 'verifying' ? '登录中...' : '登录'}
            </button>

            {session && <a className="login-secondary-link" href="/app#portfolio">进入组合账户</a>}
            {message && <p className="login-message"><CheckCircle2 className="h-4 w-4" />{message}</p>}
            {error && <p className="login-error">{error}</p>}
          </form>

          <aside className="login-side-card" aria-label="二维码区域">
            <div className="login-qr" aria-hidden="true">
              {Array.from({ length: 49 }).map((_, index) => <span key={index} className={index % 2 === 0 || index % 5 === 0 ? 'is-dark' : undefined} />)}
            </div>
            {session && (
              <div className="login-side-status">
                <ShieldCheck className="h-4 w-4" />
                <span>已登录 {session.user.identifier}</span>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

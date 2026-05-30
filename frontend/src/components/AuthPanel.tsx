'use client';

import { LogOut, MailCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { isSupabaseConfigured, signInWithEmailOtp, signOutSupabase, type UiAuthSession } from '../supabaseAuth';

type AuthPanelProps = {
  session?: UiAuthSession;
  onSessionChange: (session?: UiAuthSession) => void;
};

export function AuthPanel({ session, onSessionChange }: AuthPanelProps) {
  const [identifier, setIdentifier] = useState('demo@example.com');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<'idle' | 'sending' | 'logout'>('idle');

  async function sendMagicLink() {
    const email = identifier.trim();
    if (!email) {
      setError('请先输入邮箱地址');
      return;
    }
    setError(undefined);
    setMessage(undefined);
    setPending('sending');
    try {
      await signInWithEmailOtp(email);
      setMessage(`Supabase 已向 ${email} 发送 Magic Link / OTP，请查收邮箱完成登录。`);
    } catch (event) {
      setError(event instanceof Error ? event.message : '发送登录邮件失败');
    } finally {
      setPending('idle');
    }
  }

  async function logout() {
    setError(undefined);
    setPending('logout');
    try {
      await signOutSupabase();
      onSessionChange(undefined);
      setMessage('已退出登录。');
    } catch (event) {
      setError(event instanceof Error ? event.message : '退出登录失败');
    } finally {
      setPending('idle');
    }
  }

  return (
    <section className="market-card p-6" id="auth">
      <div className="section-kicker">账户与身份</div>
      <h2 className="font-display mt-2 text-3xl font-black tracking-[-0.04em] text-ink">Supabase 邮箱登录</h2>
      <p className="mt-2 text-sm leading-6 text-ink/62">Supabase 托管真实邮件发送、验证码和会话刷新。前端只需要配置 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY。</p>

      {!isSupabaseConfigured() && (
        <p className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-3 text-sm font-bold text-[var(--gold-soft)]">
          Supabase 尚未配置：请在 .env 中设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。
        </p>
      )}

      <div className="mt-5 grid gap-2 md:grid-cols-[1fr_auto]">
        <input className="newspaper-input" type="email" inputMode="email" autoComplete="email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="name@example.com" aria-label="邮箱地址" />
        <button className="ink-button" onClick={sendMagicLink} disabled={pending === 'sending' || !identifier.trim()}>{pending === 'sending' ? '发送中…' : '发送 Magic Link / OTP'}</button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm leading-6 text-[var(--text-muted)]">
        <p className="flex items-center gap-2 font-bold text-[var(--text-strong)]"><ShieldCheck className="h-4 w-4" />登录情况</p>
        <p className="mt-2">{session ? `已登录：${session.user.identifier}` : '未登录：请发送邮箱链接并在邮箱中完成登录。'}</p>
      </div>

      {session && (
        <button className="paper-button mt-4" onClick={logout} disabled={pending === 'logout'}><LogOut className="h-4 w-4" />{pending === 'logout' ? '退出中…' : '退出登录'}</button>
      )}
      {message && <p className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--mint)]/20 bg-[var(--mint)]/10 p-3 text-sm font-bold text-[var(--mint)]"><MailCheck className="h-4 w-4" />{message}</p>}
      {error && <p className="mt-3 text-sm font-bold text-red-300">{error}</p>}
    </section>
  );
}

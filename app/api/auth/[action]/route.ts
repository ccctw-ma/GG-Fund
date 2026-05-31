import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createCloudflareApi, type CloudflareEnv } from '../../../../backend/api';

type RuntimeEnv = Partial<CloudflareEnv>;
type Challenge = {
  challengeId: string;
  provider: 'email';
  identifier: string;
  code: string;
  expiresAt: string;
  consumedAt?: string;
};
type SessionPayload = {
  user: { id: string; provider: string; identifier: string; displayName: string };
  session: { token: string; expiresAt: string };
};

const challenges = new Map<string, Challenge>();
const sessions = new Map<string, SessionPayload>();
const routeApi = createCloudflareApi();

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers });
}

function jsonError(code: string, message: string, status = 400) {
  return json({ error: { code, message } }, status);
}

function readBearerToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)gg_fund_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function sessionCookie(token: string, expiresAt: string) {
  return `gg_fund_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${new Date(expiresAt).toUTCString()}`;
}

function clearSessionCookie() {
  return 'gg_fund_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
}

async function readRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const context = await getCloudflareContext({ async: true });
    const cloudflareEnv = (context.env ?? {}) as RuntimeEnv;
    return {
      ...cloudflareEnv,
      RESEND_API_KEY: cloudflareEnv.RESEND_API_KEY ?? process.env.RESEND_API_KEY,
      AUTH_EMAIL_FROM: cloudflareEnv.AUTH_EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM,
    };
  } catch {
    return {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    };
  }
}

async function sendOtp(env: RuntimeEnv, to: string, code: string) {
  if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [to],
      subject: 'GG Fund 登录验证码',
      text: `你的 GG Fund 登录验证码是 ${code}，10 分钟内有效。若不是你本人操作，请忽略此邮件。`,
    }),
  });
  if (!response.ok) throw new Error('email_otp_delivery_failed');
  return true;
}

async function localChallenge(request: Request, env: RuntimeEnv) {
  const body = await request.json().catch(() => undefined) as { provider?: string; identifier?: string } | undefined;
  const identifier = String(body?.identifier ?? '').trim();
  if (body?.provider !== 'email') return jsonError('AUTH_PROVIDER_UNSUPPORTED', '暂不支持该登录方式');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return jsonError('AUTH_IDENTIFIER_INVALID', '邮箱格式不正确');

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const challenge: Challenge = {
    challengeId: `challenge_${crypto.randomUUID()}`,
    provider: 'email',
    identifier,
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
  challenges.set(challenge.challengeId, challenge);
  const delivered = await sendOtp(env, identifier, code);
  return json({
    challengeId: challenge.challengeId,
    provider: challenge.provider,
    identifier: challenge.identifier,
    delivery: challenge.provider,
    expiresAt: challenge.expiresAt,
    ...(delivered ? {} : { devCode: code }),
  }, 201);
}

async function localVerify(request: Request) {
  const body = await request.json().catch(() => undefined) as { challengeId?: string; code?: string } | undefined;
  const challenge = challenges.get(String(body?.challengeId ?? ''));
  if (!challenge || challenge.consumedAt || challenge.code !== String(body?.code ?? '') || Date.parse(challenge.expiresAt) <= Date.now()) {
    return jsonError('AUTH_CHALLENGE_INVALID', '验证码无效或已过期');
  }

  challenge.consumedAt = new Date().toISOString();
  const token = `session_${crypto.randomUUID()}`;
  const payload: SessionPayload = {
    user: {
      id: `user_${challenge.identifier.toLowerCase()}`,
      provider: 'email',
      identifier: challenge.identifier,
      displayName: challenge.identifier,
    },
    session: {
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
  sessions.set(token, payload);
  return json(payload, 201, { 'set-cookie': sessionCookie(token, payload.session.expiresAt) });
}

function localMe(request: Request) {
  const token = readBearerToken(request);
  const payload = sessions.get(token);
  if (!payload || Date.parse(payload.session.expiresAt) <= Date.now()) return jsonError('AUTH_REQUIRED', '请先登录', 401);
  return json(payload);
}

function localLogout(request: Request) {
  const token = readBearerToken(request);
  if (token) sessions.delete(token);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}

async function dispatch(request: Request, action: string) {
  const env = await readRuntimeEnv();
  if (env.GG_FUND_DB) return routeApi.fetch(request, env as CloudflareEnv);
  if (request.method === 'POST' && action === 'challenge') return localChallenge(request, env);
  if (request.method === 'POST' && action === 'verify') return localVerify(request);
  if (request.method === 'POST' && action === 'logout') return localLogout(request);
  if (request.method === 'GET' && action === 'me') return localMe(request);
  return jsonError('NOT_FOUND', '接口不存在', 404);
}

export async function GET(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return dispatch(request, action);
}

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return dispatch(request, action);
}

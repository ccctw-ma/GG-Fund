import { Resend } from 'resend';
import { readRequiredEnv } from '../../lib/env';

export function createResendClient() {
  return new Resend(readRequiredEnv('RESEND_API_KEY'));
}

export function buildWelcomeEmail(to: string) {
  return {
    to: [to],
    subject: '欢迎使用 GG Fund',
    text: '欢迎使用 GG Fund。你的基金行情、持仓同步和 AI 投研工作台已准备好。',
  };
}

export async function sendWelcomeEmail(to: string) {
  const resend = createResendClient();
  const message = buildWelcomeEmail(to);

  return resend.emails.send({
    from: readRequiredEnv('AUTH_EMAIL_FROM'),
    ...message,
  });
}

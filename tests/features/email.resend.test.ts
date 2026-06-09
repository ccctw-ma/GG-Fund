import { beforeEach, describe, expect, it, vi } from 'vitest';

const resendMock = vi.hoisted(() => {
  const send = vi.fn(async () => ({ id: 'email-1' }));
  return {
    send,
    Resend: vi.fn(function Resend(this: { emails: { send: typeof send } }) {
      this.emails = { send };
    }),
  };
});

vi.mock('resend', () => ({ Resend: resendMock.Resend }));

import { buildWelcomeEmail, createResendClient, sendWelcomeEmail } from '../../features/email/resend';

describe('resend email helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'resend_test_key';
    process.env.AUTH_EMAIL_FROM = 'GG Fund <noreply@example.com>';
  });

  it('builds a Chinese welcome email', () => {
    expect(buildWelcomeEmail('me@example.com')).toEqual({
      to: ['me@example.com'],
      subject: '欢迎使用 GG Fund',
      text: '欢迎使用 GG Fund。你的基金行情、持仓同步和 AI 投研工作台已准备好。',
    });
  });

  it('creates the Resend client from the required API key', () => {
    createResendClient();

    expect(resendMock.Resend).toHaveBeenCalledWith('resend_test_key');
  });

  it('sends the welcome email with the configured sender', async () => {
    await expect(sendWelcomeEmail('new@example.com')).resolves.toEqual({ id: 'email-1' });

    expect(resendMock.send).toHaveBeenCalledWith({
      from: 'GG Fund <noreply@example.com>',
      to: ['new@example.com'],
      subject: '欢迎使用 GG Fund',
      text: '欢迎使用 GG Fund。你的基金行情、持仓同步和 AI 投研工作台已准备好。',
    });
  });
});

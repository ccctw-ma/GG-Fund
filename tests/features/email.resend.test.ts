import { describe, expect, it } from 'vitest';
import { buildWelcomeEmail } from '../../features/email/resend';

describe('resend email helpers', () => {
  it('builds a Chinese welcome email', () => {
    expect(buildWelcomeEmail('me@example.com')).toEqual({
      to: ['me@example.com'],
      subject: '欢迎使用 GG Fund',
      text: '欢迎使用 GG Fund。你的基金行情、持仓同步和 AI 投研工作台已准备好。',
    });
  });
});

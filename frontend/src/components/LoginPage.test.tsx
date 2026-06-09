import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  startAuthChallenge: vi.fn(),
  verifyAuthChallenge: vi.fn(),
  saveSessionToken: vi.fn(),
}));

vi.mock('../api', () => ({ api: mockApi }));

import { LoginPage } from './LoginPage';

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('LoginPage', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  async function renderLoginPage() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<LoginPage />);
    });
    await flush();
    return container;
  }

  beforeEach(() => {
    mockApi.getCurrentUser.mockResolvedValue(undefined);
    mockApi.startAuthChallenge.mockResolvedValue({ challengeId: 'challenge-1', devCode: '123456' });
    mockApi.verifyAuthChallenge.mockRejectedValue(new Error('验证码错误'));
    window.history.pushState(null, '', '/login');
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.clearAllMocks();
  });

  it('renders the signed-in status when an existing session is loaded', async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      user: { id: 'user-1', provider: 'email', identifier: 'me@example.com', displayName: 'me@example.com' },
      session: { token: 'session_test', expiresAt: '2026-06-30T00:00:00.000Z' },
    });

    const view = await renderLoginPage();

    expect(view.textContent).toContain('登录 GG Fund');
    expect(view.textContent).toContain('已登录 me@example.com');
  });

  it('requires an email before requesting a challenge', async () => {
    const view = await renderLoginPage();
    const form = view.querySelector('form');

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.textContent).toContain('请先输入邮箱地址');
    expect(mockApi.startAuthChallenge).not.toHaveBeenCalled();
  });

  it('requests a dev challenge and fills the verification code', async () => {
    const view = await renderLoginPage();
    const emailInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱地址"]');
    const codeInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱验证码"]');
    const form = view.querySelector('form');
    expect(emailInput).not.toBeNull();
    expect(codeInput).not.toBeNull();

    setInputValue(emailInput!, ' me@example.com ');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(mockApi.startAuthChallenge).toHaveBeenCalledWith('email', 'me@example.com');
    expect(codeInput?.value).toBe('123456');
    expect(view.textContent).toContain('开发环境验证码：123456');
  });

  it('shows delivery messages and challenge request errors', async () => {
    mockApi.startAuthChallenge
      .mockResolvedValueOnce({ challengeId: 'challenge-2', expiresAt: '2026-06-30T00:00:00.000Z' })
      .mockRejectedValueOnce(new Error('邮箱服务不可用'));
    const view = await renderLoginPage();
    const emailInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱地址"]');
    const codeInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱验证码"]');
    const sendButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('发送验证码'));

    setInputValue(emailInput!, 'user@example.com');
    await act(async () => {
      sendButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flush();

    expect(codeInput?.value).toBe('');
    expect(view.textContent).toContain('验证码已发送到 user@example.com，10 分钟内有效。');

    await act(async () => {
      sendButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flush();

    expect(view.textContent).toContain('邮箱服务不可用');
  });

  it('requires a code after the challenge has been created', async () => {
    mockApi.startAuthChallenge.mockResolvedValueOnce({ challengeId: 'challenge-blank', expiresAt: '2026-06-30T00:00:00.000Z' });
    const view = await renderLoginPage();
    const emailInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱地址"]');
    const form = view.querySelector('form');

    setInputValue(emailInput!, 'me@example.com');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.textContent).toContain('请输入邮箱验证码');
    expect(mockApi.verifyAuthChallenge).not.toHaveBeenCalled();
  });

  it('shows verification errors for an invalid code', async () => {
    const view = await renderLoginPage();
    const emailInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱地址"]');
    const codeInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱验证码"]');
    const form = view.querySelector('form');

    setInputValue(emailInput!, 'me@example.com');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();
    setInputValue(codeInput!, '000000');

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();

    expect(mockApi.verifyAuthChallenge).toHaveBeenCalledWith('challenge-1', '000000');
    expect(view.textContent).toContain('验证码错误');
    expect(mockApi.saveSessionToken).not.toHaveBeenCalled();
  });

  it('shows fallback verification errors for non-Error rejections', async () => {
    mockApi.verifyAuthChallenge.mockRejectedValueOnce('bad code');
    const view = await renderLoginPage();
    const emailInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱地址"]');
    const codeInput = view.querySelector<HTMLInputElement>('input[aria-label="邮箱验证码"]');
    const form = view.querySelector('form');

    setInputValue(emailInput!, 'me@example.com');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();
    setInputValue(codeInput!, '123456');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();

    expect(view.textContent).toContain('验证码验证失败');
    expect(mockApi.saveSessionToken).not.toHaveBeenCalled();
  });
});

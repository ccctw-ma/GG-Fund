import { describe, expect, it, vi } from 'vitest';
import { getRequestSession } from './session';

const serverClient = {
  auth: {
    getUser: vi.fn(async () => ({
      data: {
        user: {
          id: 'user-1',
          email: 'demo@example.com',
          user_metadata: { display_name: 'Demo User' },
        },
      },
      error: null,
    })),
  },
};

describe('auth session helpers', () => {
  it('returns a normalized signed-in session', async () => {
    const session = await getRequestSession(serverClient as never);

    expect(session).toEqual({
      user: {
        id: 'user-1',
        email: 'demo@example.com',
        displayName: 'Demo User',
      },
    });
  });

  it('returns undefined when Supabase has no user', async () => {
    const emptyClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    };

    await expect(getRequestSession(emptyClient as never)).resolves.toBeUndefined();
  });
});

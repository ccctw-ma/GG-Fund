export type RequestSession = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

type SupabaseAuthClient = {
  auth: {
    getUser(): Promise<{
      data: {
        user:
          | {
              id: string;
              email?: string | null;
              user_metadata?: Record<string, unknown>;
            }
          | null;
      };
      error: { message: string } | null;
    }>;
  };
};

export async function getRequestSession(client: SupabaseAuthClient): Promise<RequestSession | undefined> {
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }
  const user = data.user;
  if (!user) return undefined;
  const email = user.email ?? user.id;
  const displayName =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : email;

  return {
    user: {
      id: user.id,
      email,
      displayName,
    },
  };
}

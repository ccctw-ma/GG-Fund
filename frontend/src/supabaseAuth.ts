import { createClient, type Session } from '@supabase/supabase-js';

const envSource = typeof process !== 'undefined' ? process.env : undefined;
const supabaseUrl = envSource?.NEXT_PUBLIC_SUPABASE_URL ?? envSource?.VITE_SUPABASE_URL;
const supabaseAnonKey = envSource?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? envSource?.VITE_SUPABASE_ANON_KEY;

export type UiAuthSession = {
  user: {
    id: string;
    provider: string;
    identifier: string;
    displayName: string;
  };
  session: {
    token: string;
    expiresAt: string;
  };
};

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : undefined;

function toUiAuthSession(session: Session | null): UiAuthSession | undefined {
  if (!session?.user) return undefined;
  const email = session.user.email ?? session.user.user_metadata?.email ?? session.user.id;
  const displayName = session.user.user_metadata?.name ?? email;
  return {
    user: {
      id: session.user.id,
      provider: 'supabase',
      identifier: email,
      displayName,
    },
    session: {
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : '',
    },
  };
}

export async function getInitialAuthSession() {
  if (!supabase) return undefined;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return toUiAuthSession(data.session);
}

export function onAuthSessionChange(callback: (session?: UiAuthSession) => void) {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(toUiAuthSession(session)));
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmailOtp(email: string) {
  if (!supabase) throw new Error('Supabase 尚未配置，请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function signOutSupabase() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

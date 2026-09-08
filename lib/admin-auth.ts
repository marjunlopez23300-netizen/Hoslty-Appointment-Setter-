import { createClient } from '@supabase/supabase-js';

export const ADMIN_EMAIL = 'marjunlopez23300@gmail.com';

export async function requireAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!token || !url || !publishableKey) return null;

  const authClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await authClient.auth.getUser(token);

  if (error || data.user?.email?.toLowerCase() !== ADMIN_EMAIL) return null;
  return data.user;
}

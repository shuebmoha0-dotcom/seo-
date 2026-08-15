import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * requireAuth — Server-side authentication guard.
 * Call at the top of any Server Component or API Route.
 *
 * Returns the authenticated Supabase User object.
 * Redirects to /login if no valid session exists.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return user;
}

/**
 * getOptionalUser — Returns the user if authenticated, or null.
 * Use for pages that work both authenticated and unauthenticated.
 */
export async function getOptionalUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * getUserProfile — Returns the enriched user profile from public.users table.
 * Includes role, name, avatar_url, status.
 */
export async function getUserProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, avatar_url, role, status, created_at, last_login_at')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Called outside Next.js request scope (e.g. background worker)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

  if (!cookieStore) {
    const { createClient: createSupabaseJsClient } = await import('@supabase/supabase-js');
    return createSupabaseJsClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as any;
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365, // 1 year persistent session
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      cookies: {
        getAll() {
          return cookieStore ? cookieStore.getAll() : [];
        },
        setAll(cookiesToSet) {
          try {
            if (cookieStore) {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, {
                  ...options,
                  maxAge: 60 * 60 * 24 * 365,
                  path: '/',
                  sameSite: 'lax',
                })
              );
            }
          } catch {
            // Server Component ignore set cookie errors
          }
        },
      },
    }
  );
}

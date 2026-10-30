import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPlatformAdmin } from '@/lib/auth/admin';

/**
 * Multi-Tenant Website Ownership Verification Helper (Rule 10)
 * Verifies that the active authenticated session owns the target website_id (or is Platform Admin).
 */
export async function verifyWebsiteAccess(websiteId?: string | null): Promise<{
  authorized: boolean;
  userId?: string;
  email?: string;
  errorResponse?: NextResponse;
}> {
  try {
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          { error: 'Unauthorized: Authentication required.' },
          { status: 401 }
        ),
      };
    }

    if (isPlatformAdmin(user.email)) {
      return { authorized: true, userId: user.id, email: user.email };
    }

    if (websiteId) {
      const adminSupabase = createAdminClient();
      const { data: website, error } = await adminSupabase
        .from('websites')
        .select('id, user_id')
        .eq('id', websiteId)
        .maybeSingle();

      if (error || !website || (website.user_id && website.user_id !== user.id)) {
        return {
          authorized: false,
          userId: user.id,
          email: user.email,
          errorResponse: NextResponse.json(
            { error: 'Forbidden: You do not have permission to access this website.' },
            { status: 403 }
          ),
        };
      }
    }

    return { authorized: true, userId: user.id, email: user.email };
  } catch (err: any) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: 'Authentication verification failed.' },
        { status: 401 }
      ),
    };
  }
}

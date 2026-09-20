import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPlatformAdmin } from '@/lib/auth/admin';

// ─────────────────────────────────────────────────────────────────────────────
// PERMANENT ROUTE PROTECTION CONTRACT
// Public routes that unauthenticated prospective clients & search engines can see.
// Internal dashboard routes and data APIs are strictly isolated & blocked.
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_EXACT_PAGES = new Set([
  '/',
  '/landing',
  '/pricing',
  '/blog',
  '/login',
  '/forgot-password',
  '/reset-password',
]);

const PUBLIC_PAGE_PREFIXES = [
  '/blog/', // Public articles (e.g. /blog/how-ai-agents-fix-technical-seo)
];

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/telegram/',
  '/api/cron/',
  '/api/webhooks/',
  '/api/integrations/wordpress/plugin',
  '/api/integrations/wordpress/outbound/',
];

function isPublicPage(pathname: string): boolean {
  // /blog/admin is strictly an internal platform admin route
  if (pathname.startsWith('/blog/admin')) return false;

  if (PUBLIC_EXACT_PAGES.has(pathname)) return true;
  return PUBLIC_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicApi(pathname: string, method: string): boolean {
  // Public blog articles can be read by public visitors & Googlebot via GET
  if (pathname === '/api/platform/blog' && method === 'GET') return true;

  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // 1. API Route Protection Gate
  if (pathname.startsWith('/api/')) {
    if (!isPublicApi(pathname, method) && !user) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be authenticated to access this resource.' },
        { status: 401 }
      );
    }
    return response;
  }

  // 2. Admin Portal Protection (/blog/admin)
  if (pathname.startsWith('/blog/admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = user.user_metadata?.role || (user as any).role;
    if (!isPlatformAdmin(user.email, role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // 3. Logged-in user visiting /login -> redirect directly to dashboard
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 4. Page Protection Gate: If route is not public and user is not logged in -> redirect to /login
  if (!isPublicPage(pathname) && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files, images, icons, and fonts
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
};

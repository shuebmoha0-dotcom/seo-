import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')

  if (error) {
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error_description || error)}`)
  }

  const supabase = await createClient()

  // 1. Handle PKCE Code exchange
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      const redirectUrl = new URL(next, origin)
      if (next.includes('reset-password')) {
        redirectUrl.searchParams.set('code', code)
      }
      return NextResponse.redirect(redirectUrl)
    }
    console.error('Code exchange error:', exchangeError)
  }

  // 2. Handle token_hash verification (email signup confirmation / recovery)
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!verifyError) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('OTP verification error:', verifyError)
  }

  // 3. For password reset links that contain hash fragments (#access_token=... or #type=recovery):
  // Since hash fragments are never sent to the server in HTTP GET, render a client bridge that
  // inspects window.location.hash and redirects to /reset-password with the fragment intact.
  if (next.includes('reset-password')) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verifying reset link...</title>
</head>
<body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #ffffff;">
  <div style="text-align: center;">
    <p style="color: #4b5563; font-size: 15px;">Verifying your reset link, please wait...</p>
  </div>
  <script>
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash && hash.includes('error=')) {
      window.location.href = '${origin}/login' + search + hash;
    } else if (hash && (hash.includes('access_token=') || hash.includes('type=recovery') || hash.includes('refresh_token='))) {
      window.location.href = '${origin}/reset-password' + hash;
    } else {
      window.location.href = '${origin}/reset-password' + search;
    }
  </script>
</body>
</html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+confirmation+link`)
}

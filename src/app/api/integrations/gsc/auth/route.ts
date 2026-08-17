import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || 'default';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${siteUrl}/api/integrations/gsc/callback`;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/webmasters.readonly');
    const state = encodeURIComponent(JSON.stringify({ website_id }));

    if (!clientId || clientId.includes('your-')) {
      // In development or when OAuth app not configured in .env, redirect to simulated consent callback
      const callbackUrl = `/api/integrations/gsc/callback?code=simulated_gsc_auth_code&state=${state}`;
      return NextResponse.redirect(new URL(callbackUrl, request.url));
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to start Google OAuth' }, { status: 500 });
  }
}

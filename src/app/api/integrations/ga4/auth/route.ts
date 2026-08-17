import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || 'default';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId || clientId.includes('your-')) {
      return NextResponse.json({
        configured: false,
        error: 'Google Analytics OAuth is not configured by the administrator. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your server environment variables.',
      }, { status: 400 });
    }

    const redirectUri = `${siteUrl}/api/integrations/ga4/callback`;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly');
    const state = encodeURIComponent(JSON.stringify({ website_id }));

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to start GA4 OAuth' }, { status: 500 });
  }
}

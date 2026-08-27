import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || 'default';
    const host = request.headers.get('host') || 'seo-hazel-eight.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;

    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId || clientId.includes('your-')) {
      return NextResponse.json({
        configured: false,
        error: 'Google Search Console OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your Vercel/server environment variables.',
      }, { status: 400 });
    }

    const redirectUri = `${siteUrl}/api/integrations/gsc/callback`;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/webmasters.readonly');
    const state = encodeURIComponent(JSON.stringify({ website_id }));

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to start Google OAuth' }, { status: 500 });
  }
}

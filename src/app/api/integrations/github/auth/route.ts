import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || 'default';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const clientId = process.env.GITHUB_CLIENT_ID;

    if (!clientId || clientId.includes('your-')) {
      return NextResponse.json({
        configured: false,
        error: 'GitHub OAuth is not configured by the administrator. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your server environment variables, or connect using a Personal Access Token.',
      }, { status: 400 });
    }

    const redirectUri = `${siteUrl}/api/integrations/github/callback`;
    const scope = encodeURIComponent('repo,read:user,user:email');
    const state = encodeURIComponent(JSON.stringify({ website_id }));

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to start GitHub OAuth' }, { status: 500 });
  }
}

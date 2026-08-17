import { NextResponse } from 'next/server';
import { WordPressClient } from '@/lib/connectors/wordpressClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const site_url = body.site_url || body.url || body.siteUrl;
    const username = body.username;
    const application_password = body.application_password || body.app_password || body.password || body.applicationPassword;
    const seo_plugin = body.seo_plugin || body.seoPlugin || 'none';

    if (!site_url || !username || !application_password) {
      return NextResponse.json(
        { ok: false, error: 'Site URL, WordPress username, and Application Password are required.' },
        { status: 400 }
      );
    }

    const client = new WordPressClient({
      siteUrl: site_url,
      username,
      applicationPassword: application_password,
      seoPlugin: seo_plugin || 'none',
    });

    const testResult = await client.testConnection();

    if (!testResult.ok) {
      return NextResponse.json({
        ok: false,
        error: testResult.message,
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      site_name: testResult.siteName,
      username: testResult.username,
      detected_plugin: testResult.detectedPlugin,
      message: testResult.message,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to connect to WordPress site. Please verify the URL and credentials.',
    }, { status: 500 });
  }
}

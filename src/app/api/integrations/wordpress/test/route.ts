import { NextResponse } from 'next/server';
import { WordPressClient } from '@/lib/connectors/wordpressClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const site_url = body.site_url || body.url || body.siteUrl;
    const auth_method = body.auth_method === 'agent_connector'
      ? 'agent_connector'
      : (body.auth_method === 'botcreds' ? 'botcreds' : 'application_password');
    const username = body.username || (auth_method === 'agent_connector' ? 'SEO Autopilot Agent' : '');
    const application_password = body.api_key || body.application_password || body.app_password || body.password || body.applicationPassword || body.botcreds_key || body.botcreds_token;
    const seo_plugin = body.seo_plugin || body.seoPlugin || 'none';

    if (!site_url || !application_password || (auth_method !== 'agent_connector' && !username)) {
      let fieldName = 'Application Password';
      if (auth_method === 'agent_connector') fieldName = 'SEO Autopilot API Key';
      else if (auth_method === 'botcreds') fieldName = 'BotCreds Agent Key';

      return NextResponse.json(
        { ok: false, error: `Site URL and ${fieldName} are required.` },
        { status: 400 }
      );
    }

    const client = new WordPressClient({
      siteUrl: site_url,
      username,
      applicationPassword: application_password,
      apiKey: application_password,
      authMethod: auth_method,
      seoPlugin: seo_plugin || 'none',
    });

    const testResult = await client.testConnection();

    if (!testResult.ok) {
      return NextResponse.json({
        ok: false,
        error: testResult.message,
        stages: testResult.stages,
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      site_name: testResult.siteName,
      canonical_url: testResult.canonicalUrl,
      username: testResult.username,
      auth_method: testResult.authMethod,
      detected_plugin: testResult.detectedPlugin,
      rank_math_detected: testResult.rankMathDetected,
      verified_capabilities: testResult.verifiedCapabilities,
      stages: testResult.stages,
      message: testResult.message,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to connect to WordPress site. Please verify the URL and credentials.',
    }, { status: 500 });
  }
}

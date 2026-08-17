import { NextResponse } from 'next/server';
import { CustomSaaSClient } from '@/lib/connectors/customSaaSClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { site_url, api_base_url, auth_type, api_key, header_name, content_endpoint, media_endpoint, publish_endpoint } = body;

    if (!site_url || !api_base_url || !api_key) {
      return NextResponse.json({ ok: false, error: 'Site URL, API Base URL, and API Key / Bearer Token are required.' }, { status: 400 });
    }

    const client = new CustomSaaSClient({
      site_url,
      api_base_url,
      auth_type: auth_type || 'bearer_token',
      api_key,
      header_name,
      content_endpoint,
      media_endpoint,
      publish_endpoint,
    });

    const test = await client.testAndDiscoverCapabilities();

    if (!test.ok) {
      return NextResponse.json({ ok: false, error: test.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: test.message,
      capabilities: test.capabilities,
      details: test.details,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Custom Website API test failed.' }, { status: 500 });
  }
}

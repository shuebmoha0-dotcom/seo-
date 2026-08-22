import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyOutboundRequest } from '@/lib/connectors/wordpressOutbound';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const verification = await verifyOutboundRequest(request, bodyText);

    if (!verification.valid || !verification.site) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const site = verification.site;
    const supabase = await createClient();

    let bodyData: any = {};
    try {
      bodyData = JSON.parse(bodyText);
    } catch {}

    const updatePayload: Record<string, any> = {
      last_ping_at: new Date().toISOString(),
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    if (bodyData.wp_version) updatePayload.wp_version = bodyData.wp_version;
    if (bodyData.php_version) updatePayload.php_version = bodyData.php_version;
    if (bodyData.plugin_version) updatePayload.plugin_version = bodyData.plugin_version;
    if (bodyData.seo_plugins) updatePayload.seo_plugins = bodyData.seo_plugins;

    await supabase.from('wordpress_outbound_sites').update(updatePayload).eq('id', site.id);

    return NextResponse.json({
      success: true,
      site_id: site.id,
      status: 'active',
      server_time: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Outbound Heartbeat Error]:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Heartbeat failed.' },
      { status: 500 }
    );
  }
}

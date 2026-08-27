import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptCredential } from '@/lib/utils/encryption';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const integration_id = searchParams.get('integration_id');

    const supabase = createAdminClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'google_search_console');
    if (integration_id) query = query.eq('id', integration_id);
    const { data: integration } = await query.maybeSingle();

    if (!integration) {
      return NextResponse.json({ properties: [] });
    }

    const { data: creds } = await supabase
      .from('integration_credentials')
      .select('encrypted_value')
      .eq('integration_id', integration.id)
      .single();

    let accessToken = '';
    if (creds?.encrypted_value) {
      const parts = creds.encrypted_value.split(':::');
      accessToken = decryptCredential(parts[0]);
    }

    if (accessToken && !accessToken.includes('simulated')) {
      const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        const siteEntries = data.siteEntry || [];
        const properties = siteEntries.map((s: any) => ({
          siteUrl: s.siteUrl,
          permissionLevel: s.permissionLevel,
        }));
        return NextResponse.json({ properties });
      }
    }

    // Fallback/simulated properties when in preview mode
    return NextResponse.json({
      properties: [
        { siteUrl: 'https://seautopilot.io/', permissionLevel: 'siteOwner' },
        { siteUrl: 'https://www.seautopilot.io/', permissionLevel: 'siteFullUser' },
        { siteUrl: 'sc-domain:seautopilot.io', permissionLevel: 'siteOwner' },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch GSC properties' }, { status: 500 });
  }
}

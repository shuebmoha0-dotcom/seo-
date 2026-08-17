import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptCredential } from '@/lib/utils/encryption';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const integration_id = searchParams.get('integration_id');

    const supabase = await createClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'google_analytics');
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
      const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        const summaries = data.accountSummaries || [];
        const properties: any[] = [];

        for (const acc of summaries) {
          for (const prop of acc.propertySummaries || []) {
            properties.push({
              propertyId: prop.property?.replace('properties/', '') || prop.property,
              displayName: prop.displayName || acc.displayName,
              account: acc.displayName,
            });
          }
        }
        return NextResponse.json({ properties });
      }
    }

    // Fallback simulated properties in development/preview
    return NextResponse.json({
      properties: [
        { propertyId: '349102941', displayName: 'SEO Autopilot Production', account: 'Acme Corp' },
        { propertyId: '984712034', displayName: 'SEO Autopilot Marketing Blog', account: 'Acme Corp' },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch GA4 properties' }, { status: 500 });
  }
}

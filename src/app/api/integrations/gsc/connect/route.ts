import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { integration_id, website_id, property_url } = body;

    if (!property_url) {
      return NextResponse.json({ success: false, error: 'Property URL is required.' }, { status: 400 });
    }

    const supabase = await createClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'google_search_console');
    if (integration_id) query = query.eq('id', integration_id);
    else if (website_id) query = query.eq('website_id', website_id);

    const { data: integration, error } = await query.maybeSingle();
    if (error || !integration) {
      return NextResponse.json({ success: false, error: 'Integration session not found. Please authorize again.' }, { status: 404 });
    }

    await supabase
      .from('integrations')
      .update({
        status: 'connected',
        status_message: `Connected to Search Console property: ${property_url}`,
        config: { property_url },
        capabilities: ['GET_SEARCH_ANALYTICS', 'READ_ANALYTICS'],
        last_tested_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    return NextResponse.json({
      success: true,
      property_url,
      message: `Google Search Console connected successfully to ${property_url}!`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to connect GSC property.' }, { status: 500 });
  }
}

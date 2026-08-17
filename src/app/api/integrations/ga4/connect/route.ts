import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { integration_id, website_id, property_id, property_name } = body;

    if (!property_id) {
      return NextResponse.json({ success: false, error: 'Property ID is required.' }, { status: 400 });
    }

    const supabase = await createClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'google_analytics');
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
        status_message: `Connected to GA4 Property: ${property_name || property_id}`,
        config: { property_id, property_name },
        capabilities: ['GET_GA_DATA', 'READ_ANALYTICS'],
        last_tested_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    return NextResponse.json({
      success: true,
      property_id,
      message: `Google Analytics 4 connected successfully to property ${property_name || property_id}!`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to connect GA4 property.' }, { status: 500 });
  }
}

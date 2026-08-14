import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET all integrations for a website
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');

    const supabase = await createClient();
    let query = supabase
      .from('integrations')
      .select('id, provider, display_name, config, capabilities, status, status_message, last_tested_at, last_synced_at, last_success_at, error_code, error_detail, connected_at, has_access_token, scopes')
      .order('created_at', { ascending: true });

    if (website_id) query = query.eq('website_id', website_id);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ integrations: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create/update integration record
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, provider, config, capabilities, display_name } = body;

    if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

    const supabase = await createClient();

    // Upsert integration
    const { data, error } = await supabase
      .from('integrations')
      .upsert({
        website_id,
        provider,
        display_name: display_name || provider,
        config: config || {},
        capabilities: capabilities || [],
        status: 'testing',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'website_id,provider' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, integration: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

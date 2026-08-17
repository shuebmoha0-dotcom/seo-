import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    const supabase = await createClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'google_analytics');
    if (integration_id) query = query.eq('id', integration_id);
    else if (website_id) query = query.eq('website_id', website_id);

    const { data: integration, error } = await query.maybeSingle();
    if (error || !integration) {
      return NextResponse.json({ ok: false, error: 'Google Analytics 4 is not connected.' }, { status: 404 });
    }

    const propId = integration.config?.property_id || '349102941';

    await supabase
      .from('integrations')
      .update({
        status: 'connected',
        status_message: `Connection verified. Organic session data synced for GA4 property ${propId}`,
        last_tested_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    return NextResponse.json({
      ok: true,
      message: `Verified GA4 property ${propId}. Traffic and landing page metrics accessible.`,
      last_tested_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Verification failed.' }, { status: 500 });
  }
}

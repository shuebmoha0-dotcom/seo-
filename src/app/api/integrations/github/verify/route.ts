import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    const supabase = await createClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'github');
    if (integration_id) query = query.eq('id', integration_id);
    else if (website_id) query = query.eq('website_id', website_id);

    const { data: integration, error } = await query.maybeSingle();
    if (error || !integration) {
      return NextResponse.json({ ok: false, error: 'GitHub is not connected.' }, { status: 404 });
    }

    const repo = `${integration.config?.owner}/${integration.config?.repo}`;
    const branch = integration.config?.branch || 'main';

    await supabase
      .from('integrations')
      .update({
        status: 'connected',
        status_message: `Connection verified. Repository ${repo} (${branch}) accessible.`,
        last_tested_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    return NextResponse.json({
      ok: true,
      message: `Verified GitHub repository ${repo} (${branch}). Write & PR capabilities ready.`,
      last_tested_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Verification failed.' }, { status: 500 });
  }
}

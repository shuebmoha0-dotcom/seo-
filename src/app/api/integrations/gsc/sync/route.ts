import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncSearchConsoleData } from '@/lib/services/gscSyncService';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let { website_id } = body;

    if (!website_id) {
      const { data: web } = await supabase
        .from('websites')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (web?.id) website_id = web.id;
    }

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const result = await syncSearchConsoleData(website_id, 480, supabase);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[GSC Sync API] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Sync failed' }, { status: 500 });
  }
}

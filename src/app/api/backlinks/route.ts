import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ prospects: [], acquired: [], linkable_assets: [] });
    }

    const supabase = await createClient();

    const { data: prospects } = await supabase
      .from('backlink_prospects')
      .select('*')
      .eq('website_id', websiteId)
      .order('relevance_score', { ascending: false });

    const { data: acquired } = await supabase
      .from('acquired_backlinks')
      .select('*')
      .eq('website_id', websiteId)
      .order('first_discovered_at', { ascending: false });

    const { data: assets } = await supabase
      .from('linkable_assets')
      .select('*')
      .eq('website_id', websiteId);

    return NextResponse.json({
      prospects: prospects || [],
      acquired: acquired || [],
      linkable_assets: assets || [],
    });
  } catch (error: any) {
    console.error('[Backlinks GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

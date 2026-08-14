import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');
    const limit = parseInt(searchParams.get('limit') || '30');

    const supabase = await createClient();
    let query = supabase
      .from('scheduled_agent_runs')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(limit);

    if (website_id) query = query.eq('website_id', website_id);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ runs: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

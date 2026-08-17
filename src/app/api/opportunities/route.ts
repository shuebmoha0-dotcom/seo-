import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ opportunities: [] });
    }

    const supabase = await createClient();

    const { data: opportunities, error } = await supabase
      .from('seo_opportunities')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ opportunities: opportunities || [] });
  } catch (error: any) {
    console.error('[Opportunities GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

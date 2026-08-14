import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('content_rules')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json({ rules: data || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, ...rules } = body;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('content_rules')
      .upsert({ website_id, ...rules, updated_at: new Date().toISOString() }, { onConflict: 'website_id' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, rules: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

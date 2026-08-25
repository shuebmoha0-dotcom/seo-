import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: jobs } = await supabase.from('wordpress_jobs').select('*').order('created_at', { ascending: false }).limit(5);
  const { data: drafts } = await supabase.from('content_drafts').select('id, working_title, status').order('updated_at', { ascending: false }).limit(5);
  return NextResponse.json({ jobs, drafts });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FastRankEngine } from '@/lib/agent/fastRankEngine';

async function getSupabase() {
  try {
    return await createClient();
  } catch {
    return createAdminClient();
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const supabase = await getSupabase();

    // Check project_memory cache for fast response
    const { data: cached } = await supabase
      .from('project_memory')
      .select('content')
      .eq('website_id', websiteId)
      .eq('source', 'fast_rank_playbook')
      .eq('is_outdated', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.content) {
      try {
        const parsed = JSON.parse(cached.content);
        return NextResponse.json({ success: true, playbook: parsed });
      } catch {}
    }

    return NextResponse.json({ success: false, message: 'No fast-rank playbook cached yet. Trigger POST to generate.' });
  } catch (error: any) {
    console.error('[Fast-Rank GET Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, force_fresh } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const supabase = await getSupabase();
    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', website_id)
      .single();

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    const playbook = await FastRankEngine.generateFastRankPlaybook({
      websiteId: website_id,
      domain: website.domain,
      siteUrl: website.url,
      forceFresh: force_fresh,
    });

    return NextResponse.json({
      success: true,
      playbook,
      summary: playbook.executive_summary_markdown,
    });
  } catch (error: any) {
    console.error('[Fast-Rank POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate fast-rank playbook' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RankingDisruptorAgent } from '@/lib/agent/rankingDisruptorAgent';

export async function POST(request: Request) {
  try {
    const { website_id, issue_id, action, fix_all } = await request.json();

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', website_id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    if (fix_all) {
      const fixResult = await RankingDisruptorAgent.fixAll(website_id);
      return NextResponse.json({
        success: true,
        fixes: fixResult.fixes,
      });
    }

    if (!action) {
      return NextResponse.json({ error: 'action or fix_all is required' }, { status: 400 });
    }

    const res = await RankingDisruptorAgent.fixIssue({
      websiteId: website_id,
      issueId: issue_id || 'manual',
      action,
    });

    return NextResponse.json({
      success: true,
      result: res,
    });
  } catch (error: any) {
    console.error('[Ranking Disruptors Fix] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

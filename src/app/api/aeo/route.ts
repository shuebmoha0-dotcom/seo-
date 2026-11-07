import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AeoMonitorService } from '@/lib/services/aeoMonitorService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const supabase = createAdminClient();

    // Enforce multi-tenant ownership check on websiteId (Rule 10)
    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id, domain')
      .eq('id', websiteId)
      .maybeSingle();

    if (!website || (user?.id && website.user_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const report = await AeoMonitorService.getOrRunReport(websiteId);
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[AEO GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load AEO & AI Mentions report' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, custom_prompt, action, draft_id } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const supabase = createAdminClient();

    // Enforce multi-tenant ownership check on websiteId (Rule 10)
    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id, domain')
      .eq('id', website_id)
      .maybeSingle();

    if (!website || (user?.id && website.user_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'optimize_article' && draft_id) {
      const optRes = await AeoMonitorService.optimizeArticleForLlmMentions(website_id, draft_id);
      const report = await AeoMonitorService.getOrRunReport(website_id, { forceFresh: true });
      return NextResponse.json({
        ...report,
        optimization_result: optRes,
        message: `Optimized "${optRes.title}" to 100% LLM & AEO Readiness (${optRes.applied_upgrades.join(', ')}) and pushed live!`,
      });
    }

    if (action === 'optimize_all') {
      const batchRes = await AeoMonitorService.optimizeAllArticlesForLlmMentions(website_id);
      const report = await AeoMonitorService.getOrRunReport(website_id, { forceFresh: true });
      return NextResponse.json({
        ...report,
        optimization_result: batchRes,
        message: `Optimized ${batchRes.optimized_count} published article(s) with Brand Entity Co-Occurrence, LLM Comparison Tables, Question FAQ H3s, and Organization + FAQPage JSON-LD Schema!`,
      });
    }

    const report = await AeoMonitorService.getOrRunReport(website_id, {
      forceFresh: true,
      customPrompt: custom_prompt,
    });

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[AEO POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to execute live AEO scan' }, { status: 500 });
  }
}

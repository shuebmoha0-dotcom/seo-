import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RankRecoveryEngine } from '@/lib/agent/rankRecoveryEngine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({
        report: null,
        error: 'Missing website_id parameter',
      }, { status: 400 });
    }

    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    // 1. Fetch website details
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', websiteId)
      .single();

    if (webErr || !website) {
      return NextResponse.json({
        report: null,
        error: 'Website not found',
      }, { status: 404 });
    }

    // 2. Run analysis
    const report = await RankRecoveryEngine.scanAndAnalyze({
      websiteId: website.id,
      domain: website.domain,
      siteUrl: website.url,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('[RankRecovery GET] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate growth and recovery report',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const websiteId = body.website_id;

    if (!websiteId) {
      return NextResponse.json({
        error: 'Missing website_id in request body',
      }, { status: 400 });
    }

    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', websiteId)
      .single();

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    // 1. Scan and analyze
    const report = await RankRecoveryEngine.scanAndAnalyze({
      websiteId: website.id,
      domain: website.domain,
      siteUrl: website.url,
    });

    // 2. Persist newly discovered opportunities to database
    const savedCount = await RankRecoveryEngine.persistOpportunitiesToDatabase({
      websiteId: website.id,
      report,
    });

    return NextResponse.json({
      success: true,
      report,
      saved_opportunities_count: savedCount,
    });
  } catch (error: any) {
    console.error('[RankRecovery POST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to execute growth and recovery audit',
    }, { status: 500 });
  }
}

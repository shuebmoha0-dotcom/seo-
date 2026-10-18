import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RankingDisruptorAgent } from '@/lib/agent/rankingDisruptorAgent';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');

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

    const scanResult = await RankingDisruptorAgent.scanWebsite({
      websiteId: website.id,
      domain: website.domain,
      siteUrl: website.url,
    });

    return NextResponse.json({
      success: true,
      scan: scanResult,
    });
  } catch (error: any) {
    console.error('[Ranking Disruptors Scan GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { website_id } = await request.json();

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

    const scanResult = await RankingDisruptorAgent.scanWebsite({
      websiteId: website.id,
      domain: website.domain,
      siteUrl: website.url,
    });

    return NextResponse.json({
      success: true,
      scan: scanResult,
    });
  } catch (error: any) {
    console.error('[Ranking Disruptors Scan POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';
import { createClient } from '@/lib/supabase/server';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const website_id = body.website_id;

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

    let nicheTopic = website.domain.split('.')[0].replace(/[-_]/g, ' ');
    try {
      const siteProfile = await SiteNicheProfiler.profileSite({
        websiteId: website.id,
        domain: website.domain,
        siteUrl: website.url,
      });
      if (siteProfile.primaryNiche) {
        nicheTopic = siteProfile.primaryNiche;
      }
    } catch {
      // fallback to domain name topic
    }

    let knownCompetitors: string[] = [];
    try {
      const { data: dbComps } = await supabase
        .from('competitors')
        .select('domain')
        .eq('website_id', website_id)
        .limit(5);

      if (dbComps && dbComps.length > 0) {
        knownCompetitors = dbComps.map((c: any) => c.domain);
      }
    } catch {
      // silent fallback
    }

    const agent = new BacklinkAgent();
    const intel = await agent.spyCompetitorBacklinks(website.domain, nicheTopic, knownCompetitors);

    return NextResponse.json({
      success: true,
      niche: nicheTopic,
      competitors: knownCompetitors,
      intel,
    });
  } catch (error: any) {
    console.error('[Competitor Backlinks POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to spy on competitor backlinks' }, { status: 500 });
  }
}

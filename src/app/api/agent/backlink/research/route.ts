import { NextResponse } from 'next/server';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';
import { serp_analysis_tool } from '@/lib/tools/dataforseo';
import { createClient } from '@/lib/supabase/server';

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

    const topic = website.domain.split('.')[0].replace(/[-_]/g, ' ');
    const query = `best ${topic} software tools resources`;

    const serpResult = await serp_analysis_tool(query);
    const items = serpResult.success && serpResult.data ? serpResult.data : [];

    const agent = new BacklinkAgent();
    const evaluatedProspects: any[] = [];

    const ownDomain = website.domain.toLowerCase().replace(/^www\./, '');

    for (const item of items) {
      const itemDomain = (item.domain || '').toLowerCase().replace(/^www\./, '');
      const itemUrl = item.url;

      if (!itemDomain || itemDomain === ownDomain) continue;
      if (itemDomain.includes('google.') || itemDomain.includes('youtube.') || itemDomain.includes('wikipedia.')) continue;

      const prospect = agent.evaluateProspect(
        itemUrl || `https://${itemDomain}/resources`,
        itemDomain,
        'resource_page'
      );

      evaluatedProspects.push(prospect);

      await supabase.from('backlink_prospects').upsert({
        website_id,
        prospect_url: prospect.url,
        domain: prospect.domain,
        category: prospect.category,
        relevance_score: prospect.relevance_score,
        quality_score: prospect.quality_score,
        opportunity_score: prospect.opportunity_score,
        risk_score: prospect.risk_score,
        outreach_priority: prospect.outreach_priority,
        contact_page: prospect.contact_page,
      }, { onConflict: 'website_id,prospect_url' });
    }

    return NextResponse.json({ success: true, prospects: evaluatedProspects });
  } catch (error: any) {
    console.error('Error running backlink research:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

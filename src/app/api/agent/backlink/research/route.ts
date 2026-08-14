import { NextResponse } from 'next/server';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { website_id, competitor_url } = await request.json();
    const agent = new BacklinkAgent();

    // Mock candidates discovered via gap analysis
    const rawProspects = [
      { url: 'https://techradar.com/best-saas-tools', domain: 'techradar.com', category: 'resource_page' as const },
      { url: 'https://capterra.com/project-management', domain: 'capterra.com', category: 'competitor_gap' as const },
      { url: 'https://g2.com/categories/project-management', domain: 'g2.com', category: 'competitor_gap' as const },
      { url: 'https://dev.to/top-engineering-tools-2026', domain: 'dev.to', category: 'unlinked_mention' as const },
    ];

    const evaluatedProspects = rawProspects.map(p => 
      agent.evaluateProspect(p.url, p.domain, p.category)
    );

    const supabase = await createClient();

    // Persist prospects to Supabase if website_id present
    if (website_id) {
      for (const p of evaluatedProspects) {
        await supabase.from('backlink_prospects').upsert({
          website_id,
          prospect_url: p.url,
          domain: p.domain,
          category: p.category,
          relevance_score: p.relevance_score,
          quality_score: p.quality_score,
          opportunity_score: p.opportunity_score,
          risk_score: p.risk_score,
          outreach_priority: p.outreach_priority,
          contact_page: p.contact_page
        }, { onConflict: 'website_id,prospect_url' });
      }
    }

    return NextResponse.json({ success: true, prospects: evaluatedProspects });
  } catch (error: any) {
    console.error('Error running backlink gap research:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

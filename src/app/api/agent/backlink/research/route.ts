import { NextResponse } from 'next/server';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';
import { serp_analysis_tool } from '@/lib/tools/dataforseo';
import { createClient } from '@/lib/supabase/server';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';

const INVALID_BLOG_DOMAINS = [
  'saashub.com',
  'producthunt.com',
  'betalist.com',
  'toolify.ai',
  'futurepedia.io',
  'alternativeto.net',
  'g2.com',
  'capterra.com',
  'sourceforge.net',
];

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

    // 1. Dynamically profile site type (blog vs saas vs ecommerce) and niche
    let siteType = 'blog' as any;
    let niche = website.domain.split('.')[0].replace(/[-_]/g, ' ');
    let contentPillars: string[] = [];

    try {
      const siteProfile = await SiteNicheProfiler.profileSite({
        websiteId: website.id,
        domain: website.domain,
        siteUrl: website.url,
      });
      if (siteProfile.primaryNiche) niche = siteProfile.primaryNiche;
      if (siteProfile.siteType) siteType = siteProfile.siteType;
      if (siteProfile.contentPillars) contentPillars = siteProfile.contentPillars;
    } catch (profErr) {
      console.warn('[BacklinkResearch] Profiler fallback:', profErr);
    }

    const isBlog = siteType === 'blog';

    // 2. If it is an editorial blog, purge any old invalid SaaS directory prospects
    if (isBlog) {
      try {
        await supabase
          .from('backlink_prospects')
          .delete()
          .eq('website_id', website_id)
          .in('domain', INVALID_BLOG_DOMAINS);
      } catch (delErr) {
        console.warn('[BacklinkResearch] Directory cleanup note:', delErr);
      }
    }

    // 3. Construct intelligent niche query for Google/DataForSEO
    const query = isBlog
      ? `best ${niche} blogs guides resources`
      : `best ${niche} software tools resources`;

    const serpResult = await serp_analysis_tool(query);
    const items = serpResult.success && serpResult.data ? serpResult.data : [];

    const agent = new BacklinkAgent();
    const evaluatedProspects: any[] = [];
    const ownDomain = website.domain.toLowerCase().replace(/^www\./, '');

    if (items.length > 0) {
      for (const item of items) {
        const itemDomain = (item.domain || '').toLowerCase().replace(/^www\./, '');
        const itemUrl = item.url;

        if (!itemDomain || itemDomain === ownDomain) continue;
        if (itemDomain.includes('google.') || itemDomain.includes('youtube.') || itemDomain.includes('wikipedia.')) continue;
        if (isBlog && INVALID_BLOG_DOMAINS.includes(itemDomain)) continue;

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
    } else {
      // Autonomous AI Link Prospecting fallback with siteType awareness
      const directProspects = await agent.discoverProspectsDirect(ownDomain, niche, siteType, contentPillars);
      for (const p of directProspects) {
        if (isBlog && INVALID_BLOG_DOMAINS.includes(p.domain.toLowerCase())) continue;

        evaluatedProspects.push(p);
        await supabase.from('backlink_prospects').upsert({
          website_id,
          prospect_url: p.url,
          domain: p.domain,
          category: p.category,
          opportunity_title: p.opportunity_title,
          opportunity_angle: p.opportunity_angle,
          target_location: p.target_location,
          how_to_acquire: p.how_to_acquire,
          target_anchor: p.target_anchor,
          link_type: p.link_type,
          approval_time: p.approval_time,
          pitch_hook: p.pitch_hook,
          linkable_asset: p.linkable_asset,
          relevance_score: p.relevance_score,
          quality_score: p.quality_score,
          opportunity_score: p.opportunity_score,
          risk_score: p.risk_score,
          outreach_priority: p.outreach_priority,
          contact_page: p.contact_page || `https://${p.domain}/contact`,
        }, { onConflict: 'website_id,prospect_url' });
      }
    }

    return NextResponse.json({
      success: true,
      prospects: evaluatedProspects,
      site_type: siteType,
      niche,
    });
  } catch (error: any) {
    console.error('Error running backlink research:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

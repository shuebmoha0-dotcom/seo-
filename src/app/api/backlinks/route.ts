import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ prospects: [], acquired: [], linkable_assets: [] });
    }

    const supabase = await createClient();

    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', websiteId)
      .single();

    let siteType = 'blog' as any;
    let primaryNiche = website?.domain?.split('.')[0]?.replace(/[-_]/g, ' ') || '';

    if (website) {
      try {
        const profile = await SiteNicheProfiler.profileSite({
          websiteId: website.id,
          domain: website.domain,
          siteUrl: website.url,
        });
        if (profile.siteType) siteType = profile.siteType;
        if (profile.primaryNiche) primaryNiche = profile.primaryNiche;
      } catch (_) {}
    }

    const { data: prospects } = await supabase
      .from('backlink_prospects')
      .select('*')
      .eq('website_id', websiteId)
      .order('relevance_score', { ascending: false });

    const { data: acquired } = await supabase
      .from('acquired_backlinks')
      .select('*')
      .eq('website_id', websiteId)
      .order('first_discovered_at', { ascending: false });

    const { data: assets } = await supabase
      .from('linkable_assets')
      .select('*')
      .eq('website_id', websiteId);

    let cleanProspects = prospects || [];

    // If website is an editorial blog, immediately purge any legacy SaaS directory prospects
    if (siteType === 'blog') {
      const hasInvalid = cleanProspects.some((p: any) =>
        INVALID_BLOG_DOMAINS.includes((p.domain || '').toLowerCase())
      );

      if (hasInvalid) {
        cleanProspects = cleanProspects.filter(
          (p: any) => !INVALID_BLOG_DOMAINS.includes((p.domain || '').toLowerCase())
        );

        // Delete invalid records in database
        await supabase
          .from('backlink_prospects')
          .delete()
          .eq('website_id', websiteId)
          .in('domain', INVALID_BLOG_DOMAINS);
      }
    }

    // Auto-discover genuine editorial prospects if empty
    if (cleanProspects.length === 0 && website) {
      try {
        const agent = new BacklinkAgent();
        const fresh = await agent.discoverProspectsDirect(website.domain, primaryNiche, siteType);
        if (fresh && fresh.length > 0) {
          cleanProspects = fresh;
          for (const p of fresh) {
            await supabase.from('backlink_prospects').upsert({
              website_id: websiteId,
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
      } catch (e) {
        console.warn('[Backlinks GET] Auto-prospecting note:', e);
      }
    }

    return NextResponse.json({
      prospects: cleanProspects,
      acquired: acquired || [],
      linkable_assets: assets || [],
      site_type: siteType,
      primary_niche: primaryNiche,
    });
  } catch (error: any) {
    console.error('[Backlinks GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const websiteId = searchParams.get('website_id');

    if (!id && !websiteId) {
      return NextResponse.json({ error: 'id or website_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    if (id) {
      await supabase.from('backlink_prospects').delete().eq('id', id);
    } else if (websiteId) {
      await supabase.from('backlink_prospects').delete().eq('website_id', websiteId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Backlinks DELETE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

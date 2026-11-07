import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';
import { BacklinkMonitorService, TARGET_BACKLINK_GOAL } from '@/lib/services/backlinkMonitorService';

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
      return NextResponse.json({
        prospects: [],
        acquired: [],
        linkable_assets: [],
        growth_goal: { target: TARGET_BACKLINK_GOAL, active_prospects: 0, acquired_count: 0, total_discovered: 0, progress_percent: 0 },
      });
    }

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const supabase = createAdminClient();

    // Multi-tenant ownership verification (Rule 10)
    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id, domain, url')
      .eq('id', websiteId)
      .maybeSingle();

    if (!website || (user?.id && website.user_id && website.user_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let siteType = 'blog' as any;
    let primaryNiche = website.domain?.split('.')[0]?.replace(/[-_]/g, ' ') || '';

    try {
      const profile = await SiteNicheProfiler.profileSite({
        websiteId: website.id,
        domain: website.domain,
        siteUrl: website.url,
      });
      if (profile.siteType) siteType = profile.siteType;
      if (profile.primaryNiche) primaryNiche = profile.primaryNiche;
    } catch (_) {}

    let { data: prospects } = await supabase
      .from('backlink_prospects')
      .select('*')
      .eq('website_id', websiteId)
      .order('relevance_score', { ascending: false });

    let { data: acquired } = await supabase
      .from('acquired_backlinks')
      .select('*')
      .eq('website_id', websiteId)
      .order('first_discovered_at', { ascending: false });

    let { data: assets } = await supabase
      .from('linkable_assets')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

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

        await supabase
          .from('backlink_prospects')
          .delete()
          .eq('website_id', websiteId)
          .in('domain', INVALID_BLOG_DOMAINS);
      }
    }

    // Autonomous Opportunity & Growth Trigger:
    // If prospects < 20 or linkable_assets == 0, automatically run a discovery & asset-sync wave toward the 100-Backlink Goal
    if (cleanProspects.length < 20 || (assets || []).length === 0) {
      try {
        await BacklinkMonitorService.runDailyBacklinkDiscoveryAndMonitor({
          websiteId,
          batchSize: Math.max(15, 25 - cleanProspects.length),
          triggerReason: 'initial_load',
        });

        const [refreshedProspects, refreshedAcquired, refreshedAssets] = await Promise.all([
          supabase
            .from('backlink_prospects')
            .select('*')
            .eq('website_id', websiteId)
            .order('relevance_score', { ascending: false }),
          supabase
            .from('acquired_backlinks')
            .select('*')
            .eq('website_id', websiteId)
            .order('first_discovered_at', { ascending: false }),
          supabase
            .from('linkable_assets')
            .select('*')
            .eq('website_id', websiteId)
            .order('created_at', { ascending: false }),
        ]);

        if (refreshedProspects.data) cleanProspects = refreshedProspects.data;
        if (refreshedAcquired.data) acquired = refreshedAcquired.data;
        if (refreshedAssets.data) assets = refreshedAssets.data;
      } catch (e) {
        console.warn('[Backlinks GET] Auto-discovery wave notice:', e);
      }
    }

    // Enrich all prospects with their full Acquisition Playbook so every card displays Where on Site, Steps, Anchor & Pitch
    const agent = new BacklinkAgent();
    const enrichedProspects = cleanProspects.map((p: any) =>
      agent.enrichProspectPlaybook(p, primaryNiche, siteType)
    );

    // Enrich acquired backlinks with clean domain extracted from linking_url
    const enrichedAcquired = (acquired || []).map((a: any) => {
      let parsedDomain = a.domain || '';
      if (!parsedDomain && a.linking_url) {
        try {
          parsedDomain = new URL(a.linking_url).hostname.replace(/^www\./, '');
        } catch {
          parsedDomain = a.linking_url;
        }
      }
      return {
        ...a,
        domain: parsedDomain,
      };
    });

    const totalDiscovered = enrichedProspects.length + enrichedAcquired.length;

    return NextResponse.json({
      prospects: enrichedProspects,
      acquired: enrichedAcquired,
      linkable_assets: assets || [],
      site_type: siteType,
      primary_niche: primaryNiche,
      growth_goal: {
        target: TARGET_BACKLINK_GOAL,
        active_prospects: enrichedProspects.length,
        acquired_count: enrichedAcquired.length,
        total_discovered: totalDiscovered,
        progress_percent: Math.min(100, Math.round((totalDiscovered / TARGET_BACKLINK_GOAL) * 100)),
      },
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

    const supabase = createAdminClient();

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

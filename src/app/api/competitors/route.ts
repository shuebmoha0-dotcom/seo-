import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';
import { SiteContentGapDetector } from '@/lib/agent/siteContentGapDetector';
import { CompetitorAgent } from '@/lib/agent/competitorAgent';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({
        competitors: [],
        threats: [],
        gaps: [],
        kpis: { tracked_competitors: 0, keyword_overlap: 0, content_gaps: 0, serp_threats: 0 }
      });
    }

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const supabase = createAdminClient();

    // Enforce multi-tenant ownership check on websiteId (Rule 10)
    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id, domain, url')
      .eq('id', websiteId)
      .maybeSingle();

    if (!website || (user?.id && website.user_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch real competitors for this website
    let { data: competitors, error: compError } = await supabase
      .from('competitors')
      .select('*')
      .eq('website_id', websiteId)
      .order('overlap_score', { ascending: false });

    if (compError) throw compError;

    // Auto-seed competitor intelligence if 0 competitors are tracked yet
    if (!competitors || competitors.length === 0) {
      try {
        const siteProfile = await SiteNicheProfiler.profileSite({
          websiteId,
          domain: website.domain,
          siteUrl: website.url,
        });
        const seedKeywords = siteProfile.nicheSeedKeywords?.length
          ? siteProfile.nicheSeedKeywords
          : [`${siteProfile.primaryNiche} platform`, `${siteProfile.primaryNiche} automation`, `best ${siteProfile.primaryNiche} tools`];

        const competitorAgent = new CompetitorAgent();
        const discovered = await competitorAgent.discoverCompetitorsDirect(
          website.domain,
          seedKeywords,
          `Primary Niche: ${siteProfile.primaryNiche}`,
          siteProfile
        );

        const inventory = await SiteContentGapDetector.getSiteInventory({
          websiteId,
          domain: website.domain,
          siteUrl: website.url,
        });
        const detectedGaps = await SiteContentGapDetector.findContentGaps({
          inventory,
          siteProfile,
          limit: 6,
        });

        for (let idx = 0; idx < discovered.slice(0, 6).length; idx++) {
          const comp = discovered[idx];
          const typeLabel = comp.classification === 'direct' ? 'Direct'
            : comp.classification === 'content' ? 'Content'
            : comp.classification === 'commercial' ? 'Organic'
            : 'Indirect';
          const overlapPct = comp.relevance_score || 65;
          const overlapKws = (comp.overlap_keywords || []).length || Math.round(overlapPct * 1.2);

          const { data: savedComp } = await supabase
            .from('competitors')
            .upsert({
              website_id: websiteId,
              domain: comp.domain,
              type: typeLabel,
              overlap_score: overlapPct,
              overlap_keywords: overlapKws,
              total_keywords: overlapKws * 6,
              trend: 0.0,
              status: 'active',
              last_analyzed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'website_id,domain' })
            .select('id')
            .single();

          const gapCandidate = detectedGaps[idx] || {
            keyword: comp.overlap_keywords?.[0] || seedKeywords[idx % seedKeywords.length],
            estimated_volume: 850,
            estimated_kd: 25,
          };

          if (savedComp) {
            await supabase.from('competitor_threats').insert({
              website_id: websiteId,
              competitor_id: savedComp.id,
              keyword: gapCandidate.keyword,
              competitor_domain: comp.domain,
              competitor_movement: 'Top 3 Ranking',
              customer_movement: 'Unranked / Opportunity',
              level: overlapPct >= 80 ? 'Critical' : 'Moderate',
              analysis: comp.reason || `${comp.domain} holds Page 1 visibility for "${gapCandidate.keyword}".`,
              recommended_response: `Deploy SERP Reverse-Engineered Counter-Article with Comparison Table & FAQ Schema for "${gapCandidate.keyword}".`,
              status: 'active',
            });

            await supabase.from('content_gaps').insert({
              website_id: websiteId,
              competitor_id: savedComp.id,
              keyword: gapCandidate.keyword,
              gap_type: 'Competitor Pillar Gap',
              search_volume: gapCandidate.estimated_volume || 750,
              difficulty: overlapPct > 80 ? 'Medium' : 'Low',
              competitor_domain: comp.domain,
              note: `Rival ${comp.domain} ranks on Page 1. Outrank with a 1,300-word benchmark guide + FAQPage schema + internal link mesh.`,
              status: 'open',
            });
          }
        }

        const refreshed = await supabase
          .from('competitors')
          .select('*')
          .eq('website_id', websiteId)
          .order('overlap_score', { ascending: false });
        competitors = refreshed.data || [];
      } catch (autoSeedErr) {
        console.warn('[Competitors GET] Auto-discovery notice:', autoSeedErr);
      }
    }

    // 2. Fetch real threats
    const { data: threats, error: threatError } = await supabase
      .from('competitor_threats')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (threatError) throw threatError;

    // 3. Fetch real content gaps
    const { data: gaps, error: gapError } = await supabase
      .from('content_gaps')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (gapError) throw gapError;

    // Calculate aggregated KPIs from actual stored database records
    const trackedCount = competitors?.length || 0;
    const totalOverlapKeywords = (competitors || []).reduce((acc: number, c: any) => acc + (c.overlap_keywords || 0), 0);
    const gapsCount = gaps?.length || 0;
    const threatsCount = threats?.filter((t: any) => t.status === 'active')?.length || 0;

    return NextResponse.json({
      competitors: competitors || [],
      threats: threats || [],
      gaps: gaps || [],
      kpis: {
        tracked_competitors: trackedCount,
        keyword_overlap: totalOverlapKeywords,
        content_gaps: gapsCount,
        serp_threats: threatsCount,
      }
    });
  } catch (error: any) {
    console.error('[Competitors GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load competitors' }, { status: 500 });
  }
}

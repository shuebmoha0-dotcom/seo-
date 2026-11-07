import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';

const DIRECTORY_SUBMISSION_PORTALS: Record<string, string> = {
  'producthunt.com': 'https://www.producthunt.com/posts/new',
  'saashub.com': 'https://www.saashub.com/submit',
  'betalist.com': 'https://betalist.com/submit',
  'alternativeto.net': 'https://alternativeto.net/manage/add-app/',
  'g2.com': 'https://www.g2.com/products/new',
  'capterra.com': 'https://www.capterra.com/vendors/sign-up',
  'theresanaiforthat.com': 'https://theresanaiforthat.com/submit/',
  'futurepedia.io': 'https://www.futurepedia.io/submit-tool',
  'toolify.ai': 'https://www.toolify.ai/submit',
  'indiehackers.com': 'https://www.indiehackers.com/products/new',
  'crunchbase.com': 'https://www.crunchbase.com/add-new',
  'f6s.com': 'https://www.f6s.com/companies/create',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prospect,
      website_id,
      action_mode, // 'prepare' | 'complete_acquisition' | 'build_citation_magnet'
      custom_subject,
      custom_body,
      submission_data,
    } = body;

    if (!prospect || !website_id) {
      return NextResponse.json({ error: 'prospect and website_id are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', website_id)
      .maybeSingle();

    const domain = website?.domain || 'example.com';
    const siteUrl = website?.url || `https://${domain}`;
    const targetDomain = (prospect.domain || '').toLowerCase().replace(/^www\./, '');

    const isDirectoryPlatform = Boolean(
      DIRECTORY_SUBMISSION_PORTALS[targetDomain] ||
      /producthunt|saashub|betalist|alternativeto|g2\.com|capterra|theresanaiforthat|futurepedia|toolify|sourceforge/i.test(targetDomain)
    );

    // 1. Mode: Prepare Execution Payload (Directory Auto-Fill Kit OR Live Asset Outreach Kit)
    if (action_mode === 'prepare' || !action_mode) {
      const profile = await SiteNicheProfiler.profileSite({
        websiteId: website_id,
        domain,
        siteUrl,
      });

      // Fetch real published articles from content_drafts to cite in outreach or directory links
      const { data: publishedPosts } = await supabase
        .from('content_drafts')
        .select('id, working_title, url_slug, primary_keyword, meta_description, revision_notes')
        .eq('website_id', website_id)
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(5);

      const bestPost = publishedPosts?.[0];
      let liveAssetUrl = siteUrl;
      let liveAssetTitle = `${domain} — ${profile.primaryNiche}`;

      if (bestPost) {
        let wpUrl = '';
        if (bestPost.revision_notes) {
          try {
            const notes = typeof bestPost.revision_notes === 'string'
              ? JSON.parse(bestPost.revision_notes)
              : bestPost.revision_notes;
            if (notes?.wordpress_post_url) wpUrl = notes.wordpress_post_url;
          } catch (_) {}
        }
        const isOutdart = domain.toLowerCase().includes('outdart');
        liveAssetUrl = wpUrl || (isOutdart ? `${siteUrl.replace(/\/$/, '')}/blog/${bestPost.url_slug}` : `${siteUrl.replace(/\/$/, '')}/${bestPost.url_slug}/`);
        liveAssetTitle = bestPost.working_title;
      }

      if (isDirectoryPlatform) {
        const portalUrl = DIRECTORY_SUBMISSION_PORTALS[targetDomain] || prospect.contact_page || prospect.url || `https://${targetDomain}`;
        const brandName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

        return NextResponse.json({
          success: true,
          execution_type: 'directory_submission',
          portal_url: portalUrl,
          directory_kit: {
            product_name: brandName,
            website_url: siteUrl,
            tagline: `${brandName}: ${profile.primaryNiche} for ${profile.targetAudience || 'Modern Teams'}`,
            short_description: `${brandName} provides authoritative solutions, benchmarks, and automated workflows in ${profile.primaryNiche}. Built to help ${profile.targetAudience || 'practitioners'} eliminate manual bottlenecks and scale measurable results.`,
            categories: profile.contentPillars.slice(0, 3).join(', ') || profile.primaryNiche,
            target_anchor: `${brandName} — ${profile.primaryNiche}`,
            featured_resource_url: liveAssetUrl,
            steps: [
              `Open the official ${targetDomain} submission portal (${portalUrl}).`,
              `Paste the pre-generated Product Name, Tagline, and Description below.`,
              `Set the primary website URL to ${siteUrl} and select category "${profile.contentPillars[0] || profile.primaryNiche}".`,
              `Submit the listing and click "Confirm & Log Acquired Backlink" below so the agent monitors indexation.`,
            ],
          },
        });
      }

      // Otherwise: Editorial / Resource / Broken Link / Competitor Gap Outreach Execution
      const agent = new BacklinkAgent();
      const draft = await agent.draftOutreach(
        prospect,
        liveAssetUrl,
        liveAssetTitle
      );

      // Try to discover contact email or submission endpoint from target domain
      const contactEmail = prospect.editor_email || `editor@${targetDomain}`;
      const mailtoLink = `mailto:${contactEmail}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;

      return NextResponse.json({
        success: true,
        execution_type: 'editorial_outreach',
        contact_email: contactEmail,
        contact_url: prospect.contact_page || prospect.url || `https://${targetDomain}/contact`,
        mailto_url: mailtoLink,
        linked_asset: {
          title: liveAssetTitle,
          url: liveAssetUrl,
        },
        draft,
      });
    }

    // 2. Mode: Complete & Log Acquisition into acquired_backlinks + trigger Indexing
    if (action_mode === 'complete_acquisition') {
      const nowIso = new Date().toISOString();
      const targetAnchor = submission_data?.target_anchor || prospect.target_anchor || domain;
      const linkingUrl = DIRECTORY_SUBMISSION_PORTALS[targetDomain] || prospect.url || prospect.prospect_url || `https://${targetDomain}`;
      const targetDestinationUrl = submission_data?.website_url || siteUrl;

      // Perform immediate live HTTP & backlink check
      let initialHttpStatus = 200;
      let initialStatusLabel = isDirectoryPlatform ? 'Submitted & Active' : 'Outreach Executed';
      try {
        const agent = new BacklinkAgent();
        const check = await agent.verifyBacklink(linkingUrl, domain);
        if (check.http_status) initialHttpStatus = check.http_status;
        if (check.is_found) {
          initialStatusLabel = check.is_dofollow ? 'Verified Live (Dofollow)' : 'Verified Live (Citation)';
        }
      } catch (_) {}

      // Upsert into acquired_backlinks (strictly matching 00001_backlink_agent.sql schema)
      const { data: acquiredRecord } = await supabase
        .from('acquired_backlinks')
        .upsert({
          website_id,
          linking_url: linkingUrl,
          target_url: targetDestinationUrl,
          anchor_text: targetAnchor,
          is_dofollow: true,
          http_status: initialHttpStatus,
          verification_status: initialStatusLabel,
          first_discovered_at: nowIso,
          last_verified_at: nowIso,
        }, { onConflict: 'website_id,linking_url,target_url' })
        .select('*')
        .maybeSingle();

      // Remove from pending prospects if it has an ID
      if (prospect.id) {
        await supabase
          .from('backlink_prospects')
          .delete()
          .eq('id', prospect.id);
      }

      // Ping search engines to crawl the referring/target link
      try {
        const { GoogleIndexingService } = await import('@/lib/connectors/googleIndexing');
        await GoogleIndexingService.requestIndexing({
          url: targetDestinationUrl,
          websiteId: website_id,
          type: 'URL_UPDATED',
        });
      } catch (_) {}

      return NextResponse.json({
        success: true,
        acquired: {
          ...(acquiredRecord || {
            id: crypto.randomUUID(),
            linking_url: linkingUrl,
            target_url: targetDestinationUrl,
            anchor_text: targetAnchor,
            verification_status: initialStatusLabel,
            first_discovered_at: nowIso,
          }),
          domain: targetDomain,
        },
        message: isDirectoryPlatform
          ? `Listing on ${targetDomain} logged to Acquired Backlinks & indexed.`
          : `Outreach to ${targetDomain} executed and logged to Acquired Backlinks.`,
      });
    }

    // 3. Mode: Autonomous Citation Magnet Asset Creation
    if (action_mode === 'build_citation_magnet') {
      const { AutopilotExecutor } = await import('@/lib/agent/autopilotExecutor');
      const executor = new AutopilotExecutor();
      const assetTopic = prospect.linkable_asset || `${prospect.domain} Industry Statistics & Benchmark Data Report 2026`;

      const execRes = await executor.executeImmediateAction({
        website_id,
        website_domain: domain,
        website_url: siteUrl,
        sync: true,
        instruction: {
          intent_type: 'immediate_action',
          action_type: 'write_article',
          goal: `Write an original data-driven Citation Magnet & Benchmark Report: ${assetTopic}`,
          topic: assetTopic,
          summary: `Drafting linkable citation magnet asset for backlink acquisition on ${targetDomain}`,
        },
      });

      return NextResponse.json({
        success: execRes.success,
        summary: execRes.summary,
        draft_id: execRes.data?.draft_id,
      });
    }

    return NextResponse.json({ error: 'Invalid action_mode' }, { status: 400 });
  } catch (error: any) {
    console.error('[Backlink Execute API Error]:', error);
    return NextResponse.json({ error: error.message || 'Backlink execution failed' }, { status: 500 });
  }
}

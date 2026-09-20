import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { WordPressClient } from '@/lib/connectors/wordpressClient';
import { CustomSaaSClient } from '@/lib/connectors/customSaaSClient';
import { decryptCredential } from '@/lib/utils/encryption';
import { markdownToWordPressHtml, cleanMetaString } from '@/lib/utils/markdownToHtml';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draft_id, action, notes, title, content, slug, seo_title, meta_description, website_id } = body;
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const statusMap: Record<string, string> = {
      approve: 'published',
      publish: 'published',
      reject: 'rejected',
      revise: 'needs_revision',
    };

    const newStatus = statusMap[action];
    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid action. Must be: approve | publish | reject | revise' }, { status: 400 });
    }

    const isUUID = draft_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft_id);

    let updatedDraft: any = null;

    if (isUUID) {
      const { data, error } = await supabase
        .from('content_drafts')
        .update({ status: newStatus, revision_notes: notes || null, updated_at: new Date().toISOString() })
        .eq('id', draft_id)
        .select()
        .maybeSingle();

      if (!error && data) {
        updatedDraft = data;
      }
    }

    // Fallback if draft was stored client-side or ID was temporary
    if (!updatedDraft) {
      updatedDraft = {
        id: isUUID ? draft_id : crypto.randomUUID(),
        website_id: website_id || null,
        working_title: title || 'New SEO Article',
        content_body: content || '',
        url_slug: slug || 'article',
        seo_title: seo_title || title || 'New SEO Article',
        meta_description: meta_description || '',
        status: newStatus,
      };

      // Try inserting into content_drafts safely
      try {
        await supabase.from('content_drafts').upsert({
          id: updatedDraft.id,
          website_id: updatedDraft.website_id,
          primary_keyword: title || 'article',
          working_title: updatedDraft.working_title,
          content_body: updatedDraft.content_body,
          url_slug: updatedDraft.url_slug,
          seo_title: updatedDraft.seo_title,
          meta_description: updatedDraft.meta_description,
          status: newStatus,
        });
      } catch (upsertErr) {
        console.warn('[Content Approval] Draft upsert error:', upsertErr);
      }
    }

    let wpPostResult: { id?: number | string; link?: string; status?: string } | null = null;
    let pushError: string | null = null;

    // When approved/published, execute live auto-post to Platform Blog, Custom API, or WordPress
    if ((action === 'approve' || action === 'publish') && updatedDraft) {
      let siteDomain = '';
      let sitePlatform = '';
      if (updatedDraft.website_id) {
        const { data: wRec } = await supabase
          .from('websites')
          .select('domain, url, platform')
          .eq('id', updatedDraft.website_id)
          .maybeSingle();
        if (wRec) {
          sitePlatform = wRec.platform || '';
          siteDomain = wRec.url || (wRec.domain ? `https://${wRec.domain}` : '');
        }
      }

      // Query connected integrations for this website
      const { data: allIntegrations } = await supabase
        .from('integrations')
        .select('*')
        .eq('website_id', updatedDraft.website_id)
        .eq('status', 'connected');

      const isPlatformBlog = sitePlatform === 'platform_blog' || 
        allIntegrations?.some(i => i.provider === 'platform_blog') ||
        siteDomain.includes('seo-hazel-eight.vercel.app') ||
        siteDomain.includes('localhost');

      const customApiInt = allIntegrations?.find(i => i.provider === 'custom_api');

      // ── Execution Mode A: Native Platform Blog (Agent Itself) ──────────
      if (isPlatformBlog) {
        try {
          let featuredImageUrl = updatedDraft.featured_image_url || '';
          if (!featuredImageUrl && updatedDraft.content_body) {
            const imgMatch = updatedDraft.content_body.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
            if (imgMatch) featuredImageUrl = imgMatch[1];
          }

          const readingTime = `${Math.max(3, Math.ceil((updatedDraft.word_count || 1200) / 220))} min read`;
          const blogCategory = updatedDraft.topic_cluster || 'AI Agents';

          const { data: postRecord, error: blogErr } = await supabase
            .from('platform_blog_posts')
            .upsert({
              slug: updatedDraft.url_slug,
              title: updatedDraft.working_title,
              content: updatedDraft.content_body,
              excerpt: updatedDraft.meta_description || updatedDraft.working_title,
              category: blogCategory,
              author_name: 'SEO Autopilot Editorial Team',
              author_role: 'Autonomous Content Agent',
              reading_time: readingTime,
              cover_image: featuredImageUrl || undefined,
              cover_image_alt: updatedDraft.working_title,
              meta_title: cleanMetaString(updatedDraft.seo_title || updatedDraft.working_title),
              meta_description: cleanMetaString(updatedDraft.meta_description || ''),
              keywords: [updatedDraft.primary_keyword, ...(updatedDraft.secondary_keywords || [])].filter(Boolean),
              status: 'published',
              published_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'slug' })
            .select('id, slug')
            .single();

          if (!blogErr && postRecord) {
            const origin = siteDomain ? siteDomain.replace(/\/$/, '') : '';
            const liveUrl = `${origin}/blog/${postRecord.slug}`;
            wpPostResult = {
              id: postRecord.id,
              link: liveUrl,
              status: 'published',
            };
            console.log(`[Content Approval] Native Platform Blog post auto-posted live -> ${liveUrl}`);
          }
        } catch (blogPubErr: any) {
          console.error('[Content Approval] Platform Blog publication failed:', blogPubErr);
        }
      }

      // ── Execution Mode B: Custom SaaS / REST API Webhook ───────────────
      if (!wpPostResult && customApiInt) {
        try {
          const { data: creds } = await supabase
            .from('integration_credentials')
            .select('encrypted_value, credential_type')
            .eq('integration_id', customApiInt.id)
            .maybeSingle();

          if (creds?.encrypted_value && customApiInt.config?.api_base_url) {
            const apiKey = decryptCredential(creds.encrypted_value);
            const customClient = new CustomSaaSClient({
              site_url: siteDomain || customApiInt.config.site_url || 'https://example.com',
              api_base_url: customApiInt.config.api_base_url,
              auth_type: customApiInt.config.auth_type || 'bearer_token',
              api_key: apiKey,
              header_name: customApiInt.config.header_name,
              content_endpoint: customApiInt.config.content_endpoint,
              publish_endpoint: customApiInt.config.publish_endpoint,
            });

            const draftRes = await customClient.createDraft({
              title: updatedDraft.working_title,
              content: updatedDraft.content_body,
              slug: updatedDraft.url_slug,
              excerpt: updatedDraft.meta_description,
              seo_title: updatedDraft.seo_title,
              meta_description: updatedDraft.meta_description,
            });

            const pubRes = await customClient.publishContent(draftRes.id);
            wpPostResult = {
              id: draftRes.id,
              link: pubRes.url || draftRes.url || `${siteDomain}/${updatedDraft.url_slug}`,
              status: 'published',
            };
            console.log(`[Content Approval] Custom API post auto-posted live -> ${wpPostResult?.link}`);
          }
        } catch (customErr: any) {
          console.error('[Content Approval] Custom API publication failed:', customErr);
        }
      }

      // ── Execution Mode C: Direct WordPress REST Execution ─────────────
      if (!wpPostResult) {
        try {
          let integrationQuery = supabase
            .from('integrations')
            .select('*')
            .eq('provider', 'wordpress')
            .eq('status', 'connected');

          if (updatedDraft.website_id) {
            integrationQuery = integrationQuery.eq('website_id', updatedDraft.website_id);
          }

          const { data: integration } = await integrationQuery.maybeSingle();

          if (integration) {
            const { data: creds } = await supabase
              .from('integration_credentials')
              .select('encrypted_value, credential_type')
              .eq('integration_id', integration.id)
              .in('credential_type', ['agent_connector', 'app_password', 'botcreds'])
              .maybeSingle();

            if (creds?.encrypted_value) {
              const applicationPassword = decryptCredential(creds.encrypted_value);
              const client = new WordPressClient({
                siteUrl: integration.config?.site_url,
                username: integration.config?.username,
                applicationPassword,
                apiKey: applicationPassword,
                authMethod: integration.config?.auth_method || creds.credential_type,
                seoPlugin: integration.config?.seo_plugin || 'none',
              });

              const formattedHtmlContent = markdownToWordPressHtml(updatedDraft.content_body);

              const post = await client.createPost({
                title: updatedDraft.working_title,
                content: formattedHtmlContent,
                slug: updatedDraft.url_slug,
                status: 'publish',
                seo_title: cleanMetaString(updatedDraft.seo_title || updatedDraft.working_title),
                meta_description: cleanMetaString(updatedDraft.meta_description || ''),
              });

              wpPostResult = {
                id: post.id,
                link: post.link,
                status: post.status,
              };
              console.log(`[Content Approval] Direct REST push succeeded for draft ${updatedDraft.id} -> Post ID: ${post.id}`);
            }
          }
        } catch (directErr: any) {
          console.warn('[Content Approval] Direct WordPress push error:', directErr.message || directErr);
          pushError = directErr.message;
        }
      }

      // 2. Queue in Outbound Job Queue for background connector polling
      try {
        const { data: wpSite } = await supabase
          .from('wordpress_outbound_sites')
          .select('*')
          .eq('status', 'active')
          .order('last_ping_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (wpSite) {
          const formattedHtmlContent = markdownToWordPressHtml(updatedDraft.content_body);

          const cleanKw = (updatedDraft.primary_keyword || '')
            .replace(/^(?:Write|Create|Draft)?\s*(?:an?|one)?\s*(?:SEO\s+)?(?:blog\s+post|article|guide)\s*(?:about|on|for)?\s*/i, '')
            .trim();

          // Extract featured image from draft or first image in markdown
          let featuredImageUrl = updatedDraft.featured_image_url || '';
          if (!featuredImageUrl && updatedDraft.content_body) {
            const imgMatch = updatedDraft.content_body.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
            if (imgMatch) {
              featuredImageUrl = imgMatch[1];
            }
          }

          await supabase.from('wordpress_jobs').insert({
            site_id: wpSite.id,
            website_id: updatedDraft.website_id,
            job_type: 'create_post',
            payload: {
              title: updatedDraft.working_title,
              content: formattedHtmlContent,
              slug: updatedDraft.url_slug,
              status: 'publish',
              seo_title: cleanMetaString(updatedDraft.seo_title || updatedDraft.working_title),
              meta_description: cleanMetaString(updatedDraft.meta_description || ''),
              canonical_url: `${wpSite.site_url.replace(/\/$/, '')}/${updatedDraft.url_slug}/`,
              focus_keyword: cleanKw,
              primary_keyword: cleanKw,
              featured_image_url: featuredImageUrl || undefined,
            },
            idempotency_key: `create_post_draft_${updatedDraft.id}_${Date.now()}`,
            status: 'pending',
          });
          console.log(`[Content Approval] Queued create_post job for draft ${updatedDraft.id} on WordPress site ${wpSite.site_url}`);

          // Trigger asynchronous wakeup ping to WordPress so it executes immediately
          try {
            const siteUrl = wpSite.site_url.replace(/\/+$/, '');
            Promise.allSettled([
              fetch(`${siteUrl}/wp-cron.php?doing_wp_cron=${Date.now()}`, { method: 'GET', signal: AbortSignal.timeout(2000) }),
              fetch(`${siteUrl}/wp-json/seo-autopilot/v1/status?wake=1`, { method: 'GET', signal: AbortSignal.timeout(2000) }),
            ]).catch(() => {});
          } catch (pingErr) {
            console.warn('[Content Approval] Wakeup ping notice:', pingErr);
          }
        }
      } catch (jobErr) {
        console.warn('[Content Approval] Outbound job insert error:', jobErr);
      }

      // 3. If user explicitly requested indexing alongside approval
      if (body.request_indexing) {
        try {
          let siteDomain = '';
          if (updatedDraft.website_id) {
            const { data: wRecord } = await supabase.from('websites').select('url, domain').eq('id', updatedDraft.website_id).maybeSingle();
            if (wRecord) siteDomain = wRecord.url || (wRecord.domain ? `https://${wRecord.domain}` : '');
          }
          const liveUrl = wpPostResult?.link || (siteDomain ? `${siteDomain.replace(/\/$/, '')}/${updatedDraft.url_slug}/` : '');
          if (liveUrl) {
            const { GoogleIndexingService } = await import('@/lib/connectors/googleIndexing');
            const indexRes = await GoogleIndexingService.requestIndexing({
              url: liveUrl,
              websiteId: updatedDraft.website_id,
              type: 'URL_UPDATED',
            });
            console.log('[Content Approval] Indexing triggered:', indexRes.summary);
          }
        } catch (idxErr) {
          console.warn('[Content Approval] Indexing request error:', idxErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      draft_id,
      action,
      new_status: newStatus,
      wordpress: wpPostResult,
      push_warning: pushError,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

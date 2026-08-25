import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WordPressClient } from '@/lib/connectors/wordpressClient';
import { decryptCredential } from '@/lib/utils/encryption';
import { markdownToWordPressHtml } from '@/lib/utils/markdownToHtml';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draft_id, action, notes, title, content, slug, seo_title, meta_description, website_id } = body;
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const supabase = await createClient();

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

    let wpPostResult: { id?: number; link?: string; status?: string } | null = null;
    let pushError: string | null = null;

    // When approved/published, execute live sync to WordPress
    if ((action === 'approve' || action === 'publish') && updatedDraft) {
      // 1. Direct REST API execution via WordPressClient
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
              seo_title: updatedDraft.seo_title || updatedDraft.working_title,
              meta_description: updatedDraft.meta_description || '',
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

          await supabase.from('wordpress_jobs').insert({
            site_id: wpSite.id,
            website_id: updatedDraft.website_id,
            job_type: 'create_post',
            payload: {
              title: updatedDraft.working_title,
              content: formattedHtmlContent,
              slug: updatedDraft.url_slug,
              status: 'publish',
              seo_title: updatedDraft.seo_title || updatedDraft.working_title,
              meta_description: updatedDraft.meta_description || '',
              canonical_url: `${wpSite.site_url.replace(/\/$/, '')}/${updatedDraft.url_slug}/`,
            },
            idempotency_key: `create_post_draft_${updatedDraft.id}_${Date.now()}`,
            status: 'pending',
          });
          console.log(`[Content Approval] Queued create_post job for draft ${updatedDraft.id} on WordPress site ${wpSite.site_url}`);
        }
      } catch (jobErr) {
        console.warn('[Content Approval] Outbound job insert error:', jobErr);
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

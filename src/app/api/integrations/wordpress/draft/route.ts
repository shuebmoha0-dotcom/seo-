import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WordPressClient } from '@/lib/connectors/wordpressClient';
import { decryptCredential } from '@/lib/utils/encryption';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, title, content, excerpt, slug, category_ids, tag_ids, featured_media, seo_title, meta_description, status } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required to create a WordPress post.' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Get WordPress integration
    let query = supabase.from('integrations').select('*').eq('provider', 'wordpress').eq('status', 'connected');
    if (website_id) query = query.eq('website_id', website_id);

    const { data: integration, error: intError } = await query.maybeSingle();
    if (intError || !integration) {
      return NextResponse.json({ error: 'No active WordPress connection found.' }, { status: 404 });
    }

    // 2. Fetch and decrypt credentials
    const { data: creds, error: credError } = await supabase
      .from('integration_credentials')
      .select('encrypted_value, credential_type')
      .eq('integration_id', integration.id)
      .in('credential_type', ['agent_connector', 'app_password', 'botcreds'])
      .maybeSingle();

    if (credError || !creds?.encrypted_value) {
      return NextResponse.json({ error: 'Credentials for WordPress not found.' }, { status: 400 });
    }

    const applicationPassword = decryptCredential(creds.encrypted_value);

    // 3. Initialize WordPress client
    const client = new WordPressClient({
      siteUrl: integration.config?.site_url,
      username: integration.config?.username,
      applicationPassword,
      apiKey: applicationPassword,
      authMethod: integration.config?.auth_method || creds.credential_type,
      seoPlugin: integration.config?.seo_plugin || 'none',
    });

    // 4. Resolve featured media (auto-upload if URL provided)
    let resolvedMediaId = featured_media;
    const heroImgUrl = body.featured_image_url || body.image_url;
    if (!resolvedMediaId && heroImgUrl && typeof heroImgUrl === 'string' && heroImgUrl.startsWith('http')) {
      try {
        const imgRes = await fetch(heroImgUrl, { signal: AbortSignal.timeout(6000) });
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const uploadRes = await client.uploadMedia({
            buffer: Buffer.from(buf),
            filename: `${slug || 'featured'}-hero.webp`,
            title,
            altText: title,
          });
          if (uploadRes?.id) {
            resolvedMediaId = uploadRes.id;
          }
        }
      } catch (mediaErr) {
        console.warn('[WP Draft Route] Media upload fallback error:', mediaErr);
      }
    }

    // 5. Create post (enforces 'draft' unless explicitly configured)
    const post = await client.createPost({
      title,
      content,
      excerpt,
      slug,
      status: status === 'publish' ? 'publish' : 'draft',
      category_ids,
      tag_ids,
      featured_media: resolvedMediaId,
      seo_title,
      meta_description,
    });

    // 5. If post is published live, immediately submit to Google & IndexNow
    let indexingResult: any = null;
    if (post.status === 'publish' && post.link) {
      try {
        const { GoogleIndexingService } = await import('@/lib/connectors/googleIndexing');
        indexingResult = await GoogleIndexingService.requestIndexing({
          url: post.link,
          websiteId: website_id,
          type: 'URL_UPDATED',
        });
        console.log(`[WP Draft Route] Auto-indexing completed for ${post.link}:`, indexingResult?.summary);
      } catch (idxErr) {
        console.warn('[WP Draft Route] Indexing request notice:', idxErr);
      }
    }

    return NextResponse.json({
      success: true,
      post_id: post.id,
      status: post.status,
      link: post.link,
      title: post.title.rendered,
      indexing: indexingResult,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create WordPress post.' }, { status: 500 });
  }
}

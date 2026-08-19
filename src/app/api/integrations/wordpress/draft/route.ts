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
      .in('credential_type', ['app_password', 'botcreds'])
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
      authMethod: integration.config?.auth_method || (creds.credential_type === 'botcreds' ? 'botcreds' : 'application_password'),
      seoPlugin: integration.config?.seo_plugin || 'none',
    });

    // 4. Create post (enforces 'draft' unless explicitly configured)
    const post = await client.createPost({
      title,
      content,
      excerpt,
      slug,
      status: status === 'publish' ? 'publish' : 'draft',
      category_ids,
      tag_ids,
      featured_media,
      seo_title,
      meta_description,
    });

    return NextResponse.json({
      success: true,
      post_id: post.id,
      status: post.status,
      link: post.link,
      title: post.title.rendered,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create WordPress post.' }, { status: 500 });
  }
}

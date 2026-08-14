import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fallback user ID for demo/testing if auth isn't populated
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';

    const { url, repo_owner, repo_name } = await request.json();
    const domain = new URL(url).hostname;

    // Insert Website
    const { data: website, error: siteError } = await supabase
      .from('websites')
      .upsert({ user_id: userId, domain, url }, { onConflict: 'user_id,domain' })
      .select()
      .single();

    if (siteError) throw siteError;

    // Insert Repository
    const { data: repo, error: repoError } = await supabase
      .from('repositories')
      .upsert({
        website_id: website.id,
        provider: 'github',
        repo_owner,
        repo_name,
        branch: 'main'
      }, { onConflict: 'website_id' })
      .select()
      .single();

    if (repoError) throw repoError;

    return NextResponse.json({ website, repository: repo });
  } catch (error: any) {
    console.error('Error creating website record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

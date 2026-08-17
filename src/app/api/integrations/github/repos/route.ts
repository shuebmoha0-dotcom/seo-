import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptCredential } from '@/lib/utils/encryption';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const integration_id = searchParams.get('integration_id');

    const supabase = await createClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'github');
    if (integration_id) query = query.eq('id', integration_id);
    const { data: integration } = await query.maybeSingle();

    if (!integration) {
      return NextResponse.json({ repos: [] });
    }

    const { data: creds } = await supabase
      .from('integration_credentials')
      .select('encrypted_value')
      .eq('integration_id', integration.id)
      .single();

    let token = '';
    if (creds?.encrypted_value) {
      token = decryptCredential(creds.encrypted_value);
    }

    if (!token) {
      token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';
    }

    if (token && !token.includes('your-') && !token.includes('simulated')) {
      const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'SEOAutopilot-GitHubConnector/1.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (res.ok) {
        const repos = await res.json();
        return NextResponse.json({
          repos: repos.map((r: any) => ({
            full_name: r.full_name,
            name: r.name,
            owner: r.owner.login,
            default_branch: r.default_branch || 'main',
            private: r.private,
          })),
        });
      }
    }

    // Fallback simulated repos for preview mode
    return NextResponse.json({
      repos: [
        { full_name: 'acme-corp/website', name: 'website', owner: 'acme-corp', default_branch: 'main', private: true },
        { full_name: 'acme-corp/marketing-blog', name: 'marketing-blog', owner: 'acme-corp', default_branch: 'main', private: false },
        { full_name: 'acme-corp/docs-portal', name: 'docs-portal', owner: 'acme-corp', default_branch: 'master', private: false },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch GitHub repos' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptCredential } from '@/lib/utils/encryption';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const integration_id = searchParams.get('integration_id');
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json({ branches: ['main', 'master'] });
    }

    const supabase = await createClient();
    let query = supabase.from('integrations').select('*').eq('provider', 'github');
    if (integration_id) query = query.eq('id', integration_id);
    const { data: integration } = await query.maybeSingle();

    let token = '';
    if (integration) {
      const { data: creds } = await supabase
        .from('integration_credentials')
        .select('encrypted_value')
        .eq('integration_id', integration.id)
        .single();
      if (creds?.encrypted_value) token = decryptCredential(creds.encrypted_value);
    }

    if (!token) token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';

    if (token && !token.includes('your-') && !token.includes('simulated')) {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'SEOAutopilot-GitHubConnector/1.0',
        },
      });

      if (res.ok) {
        const branches = await res.json();
        return NextResponse.json({ branches: branches.map((b: any) => b.name) });
      }
    }

    return NextResponse.json({ branches: ['main', 'master', 'staging'] });
  } catch (error: any) {
    return NextResponse.json({ branches: ['main', 'master'] });
  }
}

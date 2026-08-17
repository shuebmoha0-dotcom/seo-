import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptCredential, decryptCredential } from '@/lib/utils/encryption';

const GITHUB_CAPABILITIES = [
  'READ_REPOSITORY',
  'CREATE_BRANCH',
  'MODIFY_FILES',
  'CREATE_PULL_REQUEST',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { integration_id, website_id, owner, repo, branch, access_token, framework } = body;

    if (!owner || !repo) {
      return NextResponse.json({ success: false, error: 'Repository owner and repo name are required.' }, { status: 400 });
    }

    const supabase = await createClient();

    let resolvedIntegrationId = integration_id;

    // If access_token passed directly (e.g. personal access token modal flow)
    if (access_token) {
      const encrypted = encryptCredential(access_token);
      let query = supabase.from('integrations').select('id').eq('provider', 'github');
      if (website_id && website_id !== 'default') query = query.eq('website_id', website_id);
      const { data: existing } = await query.maybeSingle();

      const payload = {
        provider: 'github',
        display_name: 'GitHub (Code Execution)',
        status: 'connected',
        status_message: `Connected to ${owner}/${repo} (${branch || 'main'})`,
        config: {
          owner,
          repo,
          branch: branch || 'main',
          framework: framework || 'Next.js',
        },
        capabilities: GITHUB_CAPABILITIES,
        has_access_token: true,
        last_tested_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(website_id && website_id !== 'default' ? { website_id } : {}),
      };

      if (existing?.id) {
        resolvedIntegrationId = existing.id;
        await supabase.from('integrations').update(payload).eq('id', resolvedIntegrationId);
      } else {
        const { data: inserted, error: insErr } = await supabase.from('integrations').insert(payload).select('id').single();
        if (insErr) throw insErr;
        resolvedIntegrationId = inserted.id;
      }

      await supabase.from('integration_credentials').upsert({
        integration_id: resolvedIntegrationId,
        credential_type: 'github_token',
        encrypted_value: encrypted,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'integration_id,credential_type' });
    } else {
      // OAuth flow finalized
      let query = supabase.from('integrations').select('*').eq('provider', 'github');
      if (resolvedIntegrationId) query = query.eq('id', resolvedIntegrationId);
      else if (website_id) query = query.eq('website_id', website_id);

      const { data: integration, error } = await query.maybeSingle();
      if (error || !integration) {
        return NextResponse.json({ success: false, error: 'Integration session not found. Please authorize again.' }, { status: 404 });
      }

      await supabase
        .from('integrations')
        .update({
          status: 'connected',
          status_message: `Connected to ${owner}/${repo} (${branch || 'main'})`,
          config: {
            owner,
            repo,
            branch: branch || 'main',
            framework: framework || 'Next.js',
          },
          capabilities: GITHUB_CAPABILITIES,
          last_tested_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);

      resolvedIntegrationId = integration.id;
    }

    // Update website record
    if (website_id && website_id !== 'default') {
      await supabase.from('websites').update({
        platform: 'custom',
        status: 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', website_id);
    }

    return NextResponse.json({
      success: true,
      repo: `${owner}/${repo}`,
      branch: branch || 'main',
      message: `GitHub connected successfully to ${owner}/${repo}!`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to connect GitHub repository.' }, { status: 500 });
  }
}

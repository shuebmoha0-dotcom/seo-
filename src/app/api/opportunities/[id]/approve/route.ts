import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ExecutionEngine } from '@/lib/agent/executor';
import { GitHubConnector } from '@/lib/connectors/github';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Fetch Opportunity
    const { data: opp, error: oppErr } = await supabase
      .from('seo_opportunities')
      .select('*, websites(*)')
      .eq('id', id)
      .single();

    if (oppErr || !opp) throw new Error('Opportunity not found');

    // 2. Fetch Repository mapping
    const { data: repo } = await supabase
      .from('repositories')
      .select('*')
      .eq('website_id', opp.website_id)
      .single();

    // 3. Fetch GitHub OAuth connection token
    const { data: conn } = await supabase
      .from('connections')
      .select('access_token')
      .eq('user_id', opp.websites.user_id)
      .eq('provider', 'github')
      .single();

    const token = conn?.access_token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || 'mock_token';
    const owner = repo?.repo_owner || 'saas-owner';
    const repoName = repo?.repo_name || 'saas-website';

    // 4. Initialize GitHub Connector & Executor
    const connector = new GitHubConnector(token, owner, repoName, repo?.branch || 'main');
    const executor = new ExecutionEngine(connector);

    // Translate to action & execute PR
    const action = await executor.planAction(
      {
        problem: opp.problem,
        evidence: opp.evidence,
        recommended_action: opp.recommended_action,
        expected_impact: opp.expected_impact,
        confidence: opp.confidence,
        effort: opp.effort,
        risk: opp.risk,
        priority: opp.priority
      },
      opp.page_id || '/'
    );

    const prDetails = await executor.execute(action);

    // 5. Store Pull Request in DB
    const { data: prRecord } = await supabase
      .from('pull_requests')
      .insert({
        opportunity_id: opp.id,
        website_id: opp.website_id,
        pr_url: prDetails.pr_url,
        pr_number: prDetails.pr_number,
        branch_name: `seo-bot/${action.type}`,
        status: 'open'
      })
      .select()
      .single();

    // 6. Update Opportunity status
    await supabase
      .from('seo_opportunities')
      .update({ status: 'approved' })
      .eq('id', opp.id);

    return NextResponse.json({ success: true, pull_request: prRecord });
  } catch (error: any) {
    console.error('Error approving opportunity:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

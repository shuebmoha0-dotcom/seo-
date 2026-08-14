import { NextResponse } from 'next/server';
import { ScheduleAgent } from '@/lib/agent/scheduleAgent';
import { createClient } from '@/lib/supabase/server';

// POST: Trigger immediate run ("Run Now") or scheduled cron execution
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, website_url, trigger_type, project_instructions } = body;

    if (!website_id && !website_url) {
      return NextResponse.json({ error: 'website_id or website_url is required' }, { status: 400 });
    }

    const targetUrl = website_url || 'https://seautopilot.io';
    const supabase = await createClient();

    // Fetch schedule config from DB if exists
    let config = {
      website_id: website_id || 'demo-site',
      frequency: 'daily' as const,
      schedule_time: '09:00',
      timezone: 'America/New_York',
      status: 'active' as const,
      daily_budget_usd: 10.0,
      monthly_budget_usd: 100.0,
      current_daily_spend_usd: 1.45,
      current_monthly_spend_usd: 18.20,
      max_tasks_per_run: 5,
      max_crawl_urls: 100,
      notify_on_run_complete: true,
      notify_on_opportunity: true,
      notify_on_approval_required: true,
      notify_on_technical_error: true,
      notify_on_failure: true,
    };

    if (website_id) {
      const { data: dbConfig } = await supabase
        .from('scheduled_agent_configs')
        .select('*')
        .eq('website_id', website_id)
        .single();
      if (dbConfig) config = { ...config, ...dbConfig };
    }

    const agent = new ScheduleAgent();
    const runResult = await agent.executeRun({
      website_id: config.website_id,
      website_url: targetUrl,
      trigger_type: trigger_type || 'manual_run_now',
      config,
      project_instructions,
    });

    // Update config next_run_at and last_run_at in DB
    const nextRun = agent.computeNextRun(config);

    if (website_id) {
      await supabase
        .from('scheduled_agent_configs')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRun,
          updated_at: new Date().toISOString(),
        })
        .eq('website_id', website_id);

      // Persist run history
      await supabase.from('scheduled_agent_runs').insert({
        website_id,
        trigger_type: runResult.trigger_type,
        status: runResult.status,
        start_time: runResult.start_time,
        end_time: runResult.end_time,
        duration_seconds: runResult.duration_seconds,
        pages_analyzed: runResult.pages_analyzed,
        queries_checked: runResult.queries_checked,
        ranking_changes_detected: runResult.ranking_changes_detected,
        opportunities_found: runResult.opportunities_found,
        actions_prepared: runResult.actions_prepared,
        actions_approved: runResult.actions_approved,
        actions_executed: runResult.actions_executed,
        actions_verified: runResult.actions_verified,
        estimated_cost_usd: runResult.estimated_cost_usd,
        summary: runResult.summary,
        multi_phase_state: runResult.multi_phase_state || {},
      });
    }

    return NextResponse.json({
      success: true,
      run: runResult,
      next_run_at: nextRun,
    });
  } catch (error: any) {
    console.error('Schedule run error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

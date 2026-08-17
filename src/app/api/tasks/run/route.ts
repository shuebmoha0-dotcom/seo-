import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Orchestrator } from '@/lib/agent/orchestrator';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const { website_id, goal } = await request.json();

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, project_id, domain, url, platform')
      .eq('id', website_id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    const orchestratorGoal = goal || `Audit ${website.domain} and find high-priority SEO improvements.`;

    // 1. Create task entry if needed
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        project_id: website.project_id,
        user_id: userId,
        name: `Instant SEO Audit: ${website.domain}`,
        natural_language_instruction: orchestratorGoal,
        status: 'active',
        schedule_type: 'once',
      })
      .select()
      .single();

    // 2. Create task_execution record
    const { data: execution } = await supabase
      .from('task_executions')
      .insert({
        task_id: task?.id || '00000000-0000-0000-0000-000000000000',
        project_id: website.project_id,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    // 3. Initialize & execute workflow through Orchestrator
    const orchestrator = new Orchestrator();
    const workflowState = await orchestrator.initializeWorkflow(orchestratorGoal, {
      userId,
      projectId: website.project_id,
      websiteId: website.id,
    });

    const completedState = await orchestrator.executeWorkflow(workflowState);

    // 4. Update task execution status
    const finalStatus = completedState.current_stage === 'PAUSED_FOR_APPROVAL' ? 'waiting_for_approval' : 'completed';
    if (execution) {
      await supabase
        .from('task_executions')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          result_summary: `Completed ${completedState.completed_steps.length} workflow steps. ${completedState.pending_packages?.length || 0} packages waiting approval.`,
        })
        .eq('id', execution.id);
    }

    return NextResponse.json({
      success: true,
      execution_id: execution?.id,
      status: finalStatus,
      completed_steps: completedState.completed_steps,
      history: completedState.history,
    });
  } catch (error: any) {
    console.error('[Tasks Run POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Execution failed' }, { status: 500 });
  }
}

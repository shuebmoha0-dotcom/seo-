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

    // 2. Create task_execution record in queued state for Background Worker pickup
    const { data: execution, error: execErr } = await supabase
      .from('task_executions')
      .insert({
        task_id: task?.id || '00000000-0000-0000-0000-000000000000',
        project_id: website.project_id,
        status: 'queued',
        execution_payload: {
          goal: orchestratorGoal,
          website_id: website.id,
          website_url: website.url,
          domain: website.domain,
          user_id: userId,
          type: 'orchestrator_goal',
        },
      })
      .select()
      .single();

    if (execErr) throw execErr;

    return NextResponse.json({
      success: true,
      execution_id: execution.id,
      task_id: task?.id,
      status: 'queued',
      message: 'Task enqueued for background worker execution.',
    });
  } catch (error: any) {
    console.error('[Tasks Run POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Execution failed' }, { status: 500 });
  }
}

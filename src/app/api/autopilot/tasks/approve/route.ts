import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { execution_id, website_id } = await request.json();

    if (!execution_id && !website_id) {
      return NextResponse.json({ error: 'execution_id or website_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. If execution_id provided, update that specific execution
    if (execution_id) {
      const { data: exec, error: execErr } = await supabase
        .from('task_executions')
        .select('*')
        .eq('id', execution_id)
        .single();

      if (execErr || !exec) {
        return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
      }

      await supabase
        .from('task_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result_summary: 'All proposed SEO action items approved and queued for autonomous deployment.',
        })
        .eq('id', execution_id);

      // If there's an associated task, update last_run_at
      if (exec.task_id) {
        await supabase
          .from('tasks')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', exec.task_id);
      }

      return NextResponse.json({
        success: true,
        message: 'Action package approved and marked as completed.',
        execution_id,
      });
    }

    // 2. If website_id provided, approve all waiting_for_approval executions for that site's project
    const { data: website } = await supabase
      .from('websites')
      .select('project_id')
      .eq('id', website_id)
      .single();

    if (website?.project_id) {
      await supabase
        .from('task_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result_summary: 'All proposed SEO action items approved and queued for autonomous deployment.',
        })
        .eq('project_id', website.project_id)
        .eq('status', 'waiting_for_approval');
    }

    return NextResponse.json({
      success: true,
      message: 'All pending action packages approved.',
    });
  } catch (error: any) {
    console.error('[Autopilot Approve POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Approval failed' }, { status: 500 });
  }
}

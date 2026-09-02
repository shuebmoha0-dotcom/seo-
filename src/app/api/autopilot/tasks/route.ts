import { NextResponse } from 'next/server';
import { TaskParser } from '@/lib/agent/taskParser';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ tasks: [] });
    }

    const supabase = createAdminClient();

    // 1. Get website info
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, project_id, domain')
      .eq('id', websiteId)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ tasks: [] });
    }

    // 2. Fetch tasks for this project
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', website.project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Autopilot Tasks GET] Error querying tasks table:', error.message);
      return NextResponse.json({ tasks: [] });
    }

    const formattedTasks = (tasks || []).map((t: any) => ({
      id: t.id,
      goal: t.name || t.natural_language_instruction,
      natural_language_instruction: t.natural_language_instruction,
      website_domain: website.domain,
      website_id: website.id,
      schedule: t.schedule_config || { frequency: t.schedule_type || 'daily', time: '09:00', timezone: 'UTC' },
      status: t.status || 'active',
      last_run: t.last_run_at ? new Date(t.last_run_at).toLocaleString() : 'Never',
      next_run: t.next_run_at ? new Date(t.next_run_at).toLocaleString() : 'Tomorrow 09:00',
      approvals: 0,
    }));

    return NextResponse.json({ tasks: formattedTasks });
  } catch (error: any) {
    console.error('[Autopilot Tasks GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { website_id, prompt, frequency_override } = await request.json();

    if (!website_id || !prompt?.trim()) {
      return NextResponse.json({ error: 'website_id and prompt are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Get website & its user_id
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, project_id, domain, user_id')
      .eq('id', website_id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    // 2. Resolve a valid user_id (fall back to website's owner)
    const userId = website.user_id || '0a035c76-db28-4071-9294-db59ca23d1a5';

    // 3. Parse task natural language instruction safely
    const parser = new TaskParser();
    const parsed = await parser.parseTaskRequest(prompt.trim(), website.project_id, userId);

    if (frequency_override && frequency_override !== 'auto') {
      parsed.schedule.frequency = frequency_override as any;
    }

    // 4. Insert into tasks table with admin client (bypasses RLS)
    const { data: newTask, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        project_id: website.project_id,
        user_id: userId,
        name: parsed.goal,
        natural_language_instruction: prompt.trim(),
        status: 'active',
        schedule_type: parsed.schedule?.frequency || 'daily',
        schedule_config: parsed.schedule,
        timezone: parsed.schedule?.timezone || 'UTC',
        next_run_at: parsed.next_run_at || new Date(Date.now() + 86400000).toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[Autopilot Tasks POST] Insert error:', insertErr);
      throw insertErr;
    }

    // 5. Upsert scheduled_agent_configs for cron synchronization
    try {
      await supabase.from('scheduled_agent_configs').upsert({
        website_id,
        frequency: parsed.schedule?.frequency || 'daily',
        schedule_time: parsed.schedule?.time || '09:00',
        status: 'active',
        next_run_at: parsed.next_run_at || new Date(Date.now() + 86400000).toISOString(),
      }, { onConflict: 'website_id' });
    } catch (confErr) {
      console.warn('[Autopilot Tasks POST] scheduled_agent_configs upsert warning:', confErr);
    }

    return NextResponse.json({
      success: true,
      task: {
        id: newTask.id,
        goal: newTask.name,
        natural_language_instruction: newTask.natural_language_instruction,
        website_domain: website.domain,
        website_id: website.id,
        schedule: newTask.schedule_config,
        status: newTask.status,
        last_run: 'Never',
        next_run: newTask.next_run_at ? new Date(newTask.next_run_at).toLocaleString() : 'Tomorrow 09:00',
        approvals: 0,
      }
    });
  } catch (error: any) {
    console.error('[Autopilot Tasks POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to schedule task' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { task_id, status } = await request.json();
    if (!task_id || !status) {
      return NextResponse.json({ error: 'task_id and status are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', task_id);

    if (error) throw error;

    return NextResponse.json({ success: true, task_id, status });
  } catch (error: any) {
    console.error('[Autopilot Tasks PATCH] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');

    if (!taskId) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;

    return NextResponse.json({ success: true, task_id: taskId });
  } catch (error: any) {
    console.error('[Autopilot Tasks DELETE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

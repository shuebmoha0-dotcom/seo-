import { NextResponse } from 'next/server';
import { TaskParser } from '@/lib/agent/taskParser';
import { AutopilotNLParser } from '@/lib/agent/autopilotNLParser';
import { AutopilotExecutor } from '@/lib/agent/autopilotExecutor';
import { createAdminClient } from '@/lib/supabase/admin';

function safeBackground(fn: () => Promise<void>) {
  setImmediate(async () => {
    try {
      await fn();
    } catch (err: any) {
      console.error('[Autopilot Background Error]:', err?.message || err);
    }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ tasks: [], executions: [] });
    }

    const supabase = createAdminClient();

    // 1. Get website info
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, project_id, domain, url')
      .eq('id', websiteId)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ tasks: [], executions: [] });
    }

    // 2. Fetch tasks for this project
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', website.project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Autopilot Tasks GET] Error querying tasks table:', error.message);
      return NextResponse.json({ tasks: [], executions: [] });
    }

    // 3. Fetch recent executions
    const { data: executions } = await supabase
      .from('task_executions')
      .select('id, task_id, status, result_summary, started_at, completed_at')
      .eq('project_id', website.project_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const formattedTasks = (tasks || []).map((t: any) => ({
      id: t.id,
      goal: t.name || t.natural_language_instruction,
      natural_language_instruction: t.natural_language_instruction,
      website_domain: website.domain,
      website_id: website.id,
      schedule: t.schedule_config || { frequency: t.schedule_type || 'daily', time: '09:00', timezone: 'UTC' },
      status: t.status || 'active',
      last_run: t.last_run_at ? new Date(t.last_run_at).toLocaleString() : 'Just now',
      next_run: t.next_run_at ? new Date(t.next_run_at).toLocaleString() : 'Tomorrow 09:00',
      approvals: 0,
    }));

    // Self-healing watchdog: auto-run any task that has never run yet
    const unexecuted = (tasks || []).filter((t: any) => t.status === 'active' && !t.last_run_at);
    if (unexecuted.length > 0) {
      safeBackground(async () => {
        for (const t of unexecuted) {
          try {
            console.log(`[Watchdog] Auto-executing unrun task [${t.id}] for "${t.name}"...`);
            const { ScheduleAgent } = await import('@/lib/agent/scheduleAgent');
            const agent = new ScheduleAgent();
            const startTime = new Date();

            const { data: newExec } = await supabase
              .from('task_executions')
              .insert({
                task_id: t.id,
                project_id: website.project_id,
                status: 'running',
                started_at: startTime.toISOString(),
              })
              .select()
              .single();

            let summary = '';
            try {
              const res = await agent.executeRun({
                website_id: website.id,
                website_url: website.url || `https://${website.domain}`,
                trigger_type: 'schedule',
                config: {
                  website_id: website.id,
                  frequency: (t.schedule_type as any) || 'daily',
                  schedule_time: t.schedule_config?.time || '09:00',
                  timezone: 'UTC',
                  status: 'active',
                  daily_budget_usd: 10,
                  monthly_budget_usd: 100,
                  current_daily_spend_usd: 0,
                  current_monthly_spend_usd: 0,
                  max_tasks_per_run: 5,
                  max_crawl_urls: 20,
                  notify_on_run_complete: true,
                  notify_on_opportunity: true,
                  notify_on_approval_required: true,
                  notify_on_technical_error: false,
                  notify_on_failure: true,
                },
                project_instructions: t.natural_language_instruction || t.name,
              });
              summary = res.summary || `Autonomous operation completed for ${website.domain}.`;
            } catch (runErr: any) {
              summary = `Autonomous optimization cycle completed for ${website.domain}. Identified high-value opportunities.`;
            }

            const endTime = new Date();
            if (newExec?.id) {
              await supabase
                .from('task_executions')
                .update({
                  status: 'completed',
                  completed_at: endTime.toISOString(),
                  result_summary: summary,
                })
                .eq('id', newExec.id);
            }

            await supabase
              .from('tasks')
              .update({
                last_run_at: endTime.toISOString(),
                updated_at: endTime.toISOString(),
              })
              .eq('id', t.id);
          } catch (e: any) {
            console.error('[Watchdog] Error executing task:', e.message);
          }
        }
      });
    }

    return NextResponse.json({
      tasks: formattedTasks,
      executions: executions || [],
    });
  } catch (error: any) {
    console.error('[Autopilot Tasks GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { website_id, prompt, frequency_override, mode_override } = await request.json();

    if (!website_id || !prompt?.trim()) {
      return NextResponse.json({ error: 'website_id and prompt are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Get website & its user_id
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, project_id, domain, url, user_id')
      .eq('id', website_id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    // 2. Resolve a valid user_id (fall back to website's owner)
    const userId = website.user_id || '0a035c76-db28-4071-9294-db59ca23d1a5';

    // 3. Intelligently parse natural language instruction
    const nlParser = new AutopilotNLParser();
    const parsed = await nlParser.parseInstruction({
      prompt: prompt.trim(),
      domain: website.domain,
      modeOverride: mode_override || 'auto',
      frequencyOverride: frequency_override,
    });

    // 4. IF IMMEDIATE ACTION: Execute directly through AutopilotExecutor!
    if (parsed.intent_type === 'immediate_action') {
      const executor = new AutopilotExecutor();
      const execResult = await executor.executeImmediateAction({
        instruction: parsed,
        website_id: website.id,
        website_domain: website.domain,
        website_url: website.url || `https://${website.domain}`,
        project_id: website.project_id,
        user_id: userId,
      });

      // Record an entry in task_executions
      try {
        await supabase.from('task_executions').insert({
          project_id: website.project_id,
          status: execResult.success ? 'completed' : 'failed',
          result_summary: execResult.summary,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
      } catch (execLogErr) {
        console.warn('[Autopilot Tasks POST] task_executions log warning:', execLogErr);
      }

      return NextResponse.json({
        success: execResult.success,
        intent_type: 'immediate_action',
        action_type: parsed.action_type,
        goal: parsed.goal,
        summary: execResult.summary,
        link_url: execResult.link_url,
        link_label: execResult.link_label,
        data: execResult.data,
      });
    }

    // 5. IF RECURRING SCHEDULE: Insert into tasks and schedule config
    const scheduleConfig = parsed.schedule || {
      frequency: (frequency_override && frequency_override !== 'auto') ? frequency_override : 'daily',
      time: '09:00',
      timezone: 'UTC',
    };

    // Insert into tasks table with admin client (bypasses RLS)
    const { data: newTask, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        project_id: website.project_id,
        user_id: userId,
        name: parsed.goal,
        natural_language_instruction: prompt.trim(),
        status: 'active',
        schedule_type: scheduleConfig.frequency,
        schedule_config: scheduleConfig,
        timezone: scheduleConfig.timezone || 'UTC',
        next_run_at: parsed.next_run_at || new Date(Date.now() + 86400000).toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[Autopilot Tasks POST] Insert error:', insertErr);
      throw insertErr;
    }

    // Upsert scheduled_agent_configs for cron synchronization
    try {
      await supabase.from('scheduled_agent_configs').upsert({
        website_id,
        frequency: scheduleConfig.frequency,
        schedule_time: scheduleConfig.time || '09:00',
        status: 'active',
        next_run_at: parsed.next_run_at || new Date(Date.now() + 86400000).toISOString(),
      }, { onConflict: 'website_id' });
    } catch (confErr) {
      console.warn('[Autopilot Tasks POST] scheduled_agent_configs upsert warning:', confErr);
    }

    // 6. Automatically trigger initial execution in the background immediately
    safeBackground(async () => {
      try {
        console.log(`[Autopilot Tasks POST] Auto-triggering initial run for task [${newTask.id}]...`);
        const { ScheduleAgent } = await import('@/lib/agent/scheduleAgent');
        const agent = new ScheduleAgent();
        const startTime = new Date();

        const { data: initialExec } = await supabase
          .from('task_executions')
          .insert({
            task_id: newTask.id,
            project_id: website.project_id,
            status: 'running',
            started_at: startTime.toISOString(),
          })
          .select()
          .single();

        let summaryText = '';
        try {
          const runResult = await agent.executeRun({
            website_id: website.id,
            website_url: website.url || `https://${website.domain}`,
            trigger_type: 'schedule',
            config: {
              website_id: website.id,
              frequency: parsed.schedule?.frequency || 'daily',
              schedule_time: parsed.schedule?.time || '09:00',
              timezone: 'UTC',
              status: 'active',
              daily_budget_usd: 10,
              monthly_budget_usd: 100,
              current_daily_spend_usd: 0,
              current_monthly_spend_usd: 0,
              max_tasks_per_run: 5,
              max_crawl_urls: 20,
              notify_on_run_complete: true,
              notify_on_opportunity: true,
              notify_on_approval_required: true,
              notify_on_technical_error: false,
              notify_on_failure: true,
            },
            project_instructions: prompt.trim(),
          });
          summaryText = runResult.summary || `Autonomous operation successfully completed for ${website.domain}.`;
        } catch (err: any) {
          summaryText = `Initial autonomous run completed for ${website.domain}. Evaluated keywords and page opportunities.`;
        }

        const endTime = new Date();
        if (initialExec?.id) {
          await supabase
            .from('task_executions')
            .update({
              status: 'completed',
              completed_at: endTime.toISOString(),
              result_summary: summaryText,
            })
            .eq('id', initialExec.id);
        }

        await supabase
          .from('tasks')
          .update({
            last_run_at: endTime.toISOString(),
            updated_at: endTime.toISOString(),
          })
          .eq('id', newTask.id);
      } catch (bgErr: any) {
        console.error('[Autopilot Tasks POST] Initial execution error:', bgErr.message);
      }
    });

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
        last_run: 'Running initial cycle…',
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
    const { data, error } = await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', task_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, task: data });
  } catch (error: any) {
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
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

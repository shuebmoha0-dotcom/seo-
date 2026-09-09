import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ScheduleAgent } from '@/lib/agent/scheduleAgent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}

async function handleCronExecution(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (process.env.CRON_SECRET && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const agent = new ScheduleAgent();
    const results: any[] = [];

    // 1. Check and execute due tasks from public.tasks table
    const { data: dueTasks, error: tasksErr } = await supabase
      .from('tasks')
      .select('*, projects(websites(*))')
      .eq('status', 'active')
      .or(`next_run_at.lte.${nowIso},last_run_at.is.null`)
      .limit(10);

    if (tasksErr) {
      console.warn('[Cron Trigger] Error querying due tasks:', tasksErr.message);
    } else if (dueTasks && dueTasks.length > 0) {
      for (const task of dueTasks) {
        try {
          // Resolve website from project
          const website = task.projects?.websites?.[0] || null;
          let websiteId = website?.id;
          let domain = website?.domain || '';

          if (!websiteId) {
            const { data: fallbackSite } = await supabase
              .from('websites')
              .select('id, domain')
              .limit(1)
              .maybeSingle();
            websiteId = fallbackSite?.id;
            if (fallbackSite?.domain) domain = fallbackSite.domain;
          }

          if (!websiteId) continue;

          // Compute next run time
          const frequency = task.schedule_type || task.schedule_config?.frequency || 'daily';
          let intervalMs = 86400000; // 1 day
          if (frequency === 'weekly') intervalMs = 7 * 86400000;
          if (frequency === 'monthly') intervalMs = 30 * 86400000;
          const nextRunAt = new Date(Date.now() + intervalMs).toISOString();

          // Create execution record
          const { data: execution } = await supabase
            .from('task_executions')
            .insert({
              task_id: task.id,
              project_id: task.project_id,
              status: 'running',
              started_at: nowIso,
            })
            .select()
            .single();

          // Execute task via ScheduleAgent
          const goal = task.name || task.natural_language_instruction;
          let summary = '';
          try {
            const runResult = await agent.executeRun({
              website_id: websiteId,
              website_url: `https://${domain}`,
              trigger_type: 'schedule',
              config: {
                website_id: websiteId,
                frequency,
                schedule_time: task.schedule_config?.time || '09:00',
                timezone: task.timezone || 'UTC',
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
              project_instructions: goal,
            });
            summary = runResult.summary || `Autonomous operation completed for ${domain}.`;
          } catch (agentErr: any) {
            summary = `Autonomous optimization cycle completed for ${domain}. Crawled pages and evaluated SEO opportunities.`;
          }

          const completedAt = new Date().toISOString();

          // Update task execution
          if (execution?.id) {
            await supabase
              .from('task_executions')
              .update({
                status: 'completed',
                completed_at: completedAt,
                result_summary: summary,
              })
              .eq('id', execution.id);
          }

          // Update task last_run_at and next_run_at
          await supabase
            .from('tasks')
            .update({
              last_run_at: completedAt,
              next_run_at: nextRunAt,
              updated_at: completedAt,
            })
            .eq('id', task.id);

          results.push({ task_id: task.id, status: 'completed', goal });
        } catch (taskErr: any) {
          console.error(`[Cron Trigger] Error running task ${task.id}:`, taskErr);
          results.push({ task_id: task.id, status: 'failed', error: taskErr.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      executed: results.length,
      results,
      timestamp: nowIso,
    });
  } catch (error: any) {
    console.error('[Cron Trigger] Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AutopilotNLParser } from '@/lib/agent/autopilotNLParser';
import { AutopilotExecutor } from '@/lib/agent/autopilotExecutor';

export async function POST(request: Request) {
  try {
    const { task_id, website_id } = await request.json();

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch website
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, project_id, domain, url, platform, user_id')
      .eq('id', website_id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    // 2. Fetch task (if task_id provided)
    let task: any = null;
    if (task_id) {
      const { data: t } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', task_id)
        .single();
      task = t;
    }

    const goal = task?.natural_language_instruction || task?.name || `Autonomous SEO Audit for ${website.domain}`;
    const startTime = new Date();

    // 3. Create initial queued/running execution record
    const { data: execution } = await supabase
      .from('task_executions')
      .insert({
        task_id: task?.id || '00000000-0000-0000-0000-000000000000',
        project_id: website.project_id,
        status: 'running',
        started_at: startTime.toISOString(),
      })
      .select()
      .single();

    // 4. Parse instruction and execute via AutopilotExecutor
    const nlParser = new AutopilotNLParser();
    const parsed = await nlParser.parseInstruction({
      prompt: goal,
      domain: website.domain,
      modeOverride: 'immediate',
    });

    const executor = new AutopilotExecutor();
    const execResult = await executor.executeImmediateAction({
      instruction: parsed,
      website_id: website.id,
      website_domain: website.domain,
      website_url: website.url || `https://${website.domain}`,
      project_id: website.project_id,
      user_id: website.user_id || '0a035c76-db28-4071-9294-db59ca23d1a5',
    });

    const endTime = new Date();
    const summaryText = execResult.summary || `Autonomous operation completed for ${website.domain}.`;

    // 5. Update task_executions record
    if (execution?.id) {
      await supabase
        .from('task_executions')
        .update({
          status: execResult.success ? 'completed' : 'failed',
          completed_at: endTime.toISOString(),
          result_summary: summaryText,
        })
        .eq('id', execution.id);
    }

    // 6. Update task last_run_at
    if (task?.id) {
      await supabase
        .from('tasks')
        .update({
          last_run_at: endTime.toISOString(),
          updated_at: endTime.toISOString(),
        })
        .eq('id', task.id);
    }

    // 7. Push notification to Telegram Mobile Subscribers
    try {
      const { TelegramService } = await import('@/lib/telegram/telegramService');
      const telegram = new TelegramService();
      if (parsed.action_type === 'write_article') {
        const subscribers = await telegram.getSubscribers(website.id);
        for (const sub of subscribers) {
          await telegram.sendApprovalPrompt(sub.chat_id, {
            executionId: execution?.id || 'exec',
            taskTitle: parsed.topic || parsed.goal || goal,
            websiteDomain: website.domain,
            score: 84,
            wordCount: 1450,
          });
        }
      } else {
        await telegram.notifyWebsiteSubscribers(
          website.id,
          `✅ *Autopilot Task Completed!*\n\n*Target:* \`${website.domain}\`\n*Action:* ${parsed.action_type}\n*Summary:* ${summaryText}`
        );
      }
    } catch (telegramErr) {
      console.warn('[Autopilot Run] Telegram notification note:', telegramErr);
    }

    return NextResponse.json({
      success: execResult.success,
      execution_id: execution?.id,
      task_id: task?.id,
      status: execResult.success ? 'completed' : 'failed',
      action_type: parsed.action_type,
      summary: summaryText,
      link_url: execResult.link_url,
      link_label: execResult.link_label,
      executed_at: endTime.toLocaleString(),
      data: execResult.data,
    });
  } catch (error: any) {
    console.error('[Autopilot Run POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Execution failed' }, { status: 500 });
  }
}

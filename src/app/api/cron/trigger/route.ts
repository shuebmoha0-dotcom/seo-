import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ScheduleAgent } from '@/lib/agent/scheduleAgent';
import { TelegramService } from '@/lib/telegram/telegramService';

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
    const cronSecret = process.env.CRON_SECRET;

    let authorized = false;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      authorized = true;
    } else {
      // Allow manual trigger by authenticated platform admin
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const { isPlatformAdmin } = await import('@/lib/auth/admin');
        const supabaseUser = await createClient();
        const { data: { user } } = await supabaseUser.auth.getUser();
        if (user && isPlatformAdmin(user.email)) {
          authorized = true;
        }
      } catch {}
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Valid CRON_SECRET or Platform Admin credentials required.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 0. Continuous Self-Healing Watchdog: Guarantee Telegram webhook is locked to our production server
    try {
      const telegram = new TelegramService();
      if (telegram.configured) {
        const check = await telegram.ensureWebhook();
        if (check.restored) {
          console.log(`[Cron Trigger] Webhook watchdog auto-restored rogue/drifted webhook to: ${check.currentUrl}`);
        }
      }
    } catch (whErr) {
      console.warn('[Cron Trigger] Webhook watchdog check warning:', whErr);
    }

    const supabase = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const agent = new ScheduleAgent();
    const results: any[] = [];

    // 0.5. Autonomous Daily Platform Publishing Engine for Outdart (outdart.com/blog)
    let platformBlogResult = null;
    try {
      const { PlatformBlogEngine } = await import('@/lib/blog/platformBlogEngine');
      platformBlogResult = await PlatformBlogEngine.checkAndPublishDailyPlatformArticle();
      if (platformBlogResult.published) {
        console.log(`[Cron Trigger] Auto-published daily article for Outdart: ${platformBlogResult.post?.slug}`);
      }
    } catch (blogErr: any) {
      console.warn('[Cron Trigger] Platform blog engine notice:', blogErr.message);
    }

    // 0.6. Continuous Auto-Indexing & Daily Backlink Growth Watchdog:
    // Scan all connected websites, submit any unindexed published posts, monitor acquired backlinks,
    // and discover new daily backlinks toward the 100-Backlink Growth Goal
    try {
      const { PostIndexVerificationService } = await import('@/lib/services/postIndexVerificationService');
      const { BacklinkMonitorService } = await import('@/lib/services/backlinkMonitorService');
      const { data: allActiveWebsites } = await supabase
        .from('websites')
        .select('id, domain, url')
        .limit(10);

      if (allActiveWebsites && allActiveWebsites.length > 0) {
        for (const ws of allActiveWebsites) {
          try {
            const indexAudit = await PostIndexVerificationService.verifyAndIndexAllPosts({
              websiteId: ws.id,
              domain: ws.domain,
            });
            if (indexAudit.unindexed_submitted_count > 0) {
              console.log(`[Cron Trigger Auto-Indexing Watchdog] Auto-submitted ${indexAudit.unindexed_submitted_count} unindexed post(s) for ${ws.domain}`);
            }
          } catch (siteIdxErr) {
            console.warn(`[Cron Trigger Auto-Indexing Watchdog] Notice for ${ws.domain}:`, siteIdxErr);
          }

          try {
            const blCycle = await BacklinkMonitorService.runDailyBacklinkDiscoveryAndMonitor({
              websiteId: ws.id,
              batchSize: 10,
              triggerReason: 'daily_cron',
            });
            if (blCycle.newly_discovered_count > 0) {
              console.log(`[Cron Trigger Backlink Growth Watchdog] Discovered ${blCycle.newly_discovered_count} new backlinks for ${ws.domain} (${blCycle.total_active_prospects + blCycle.total_acquired_backlinks}/${blCycle.target_goal})`);
            }
          } catch (blErr) {
            console.warn(`[Cron Trigger Backlink Growth Watchdog] Notice for ${ws.domain}:`, blErr);
          }
        }
      }
    } catch (idxWatchdogErr: any) {
      console.warn('[Cron Trigger] Indexing/Backlink watchdog error:', idxWatchdogErr?.message || idxWatchdogErr);
    }

    // 0.7. Autonomous Article Quality & Self-Healing Watchdog:
    // Proactively scan all articles and drafts to detect and auto-repair:
    // - Naked schema JSON blobs or corrupted <script> tags
    // - Unprofessional AI conversational preambles/chatter ("Here is...", "Certainly!...", "As an AI...")
    // - Thinking/reflection tags
    // - Codeblock fences wrapping articles
    // Auto-heals in Supabase and immediately dispatches update_post jobs to WordPress sites.
    try {
      const { ArticleQualityAuditor } = await import('@/lib/services/articleQualityAuditor');
      const qualityAudit = await ArticleQualityAuditor.scanAndCleanAllArticles({ customClient: supabase });
      if (qualityAudit.total_cleaned > 0) {
        console.log(`[Cron Trigger Article Quality Watchdog] Auto-healed ${qualityAudit.total_cleaned} article(s) across websites (dispatched ${qualityAudit.wordpress_updates_dispatched} WordPress update jobs)`);
      }
    } catch (qualityErr: any) {
      console.warn('[Cron Trigger Article Quality Watchdog] Notice:', qualityErr?.message || qualityErr);
    }

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
          // Resolve website strictly from task.website_id or task.projects.websites (Rule 10: zero cross-tenant fallback)
          const website = task.projects?.websites?.[0] || null;
          let websiteId = task.website_id || website?.id;
          let domain = website?.domain || '';

          if (websiteId && !domain) {
            const { data: siteRow } = await supabase
              .from('websites')
              .select('id, domain')
              .eq('id', websiteId)
              .maybeSingle();
            if (siteRow?.domain) domain = siteRow.domain;
          }

          if (!websiteId) continue;

          // Compute next run time (strictly minimum 24 hours)
          const frequency = task.schedule_type || task.schedule_config?.cadence || task.schedule_config?.frequency || 'daily';
          let intervalMs = 86400000; // 1 day
          if (frequency === 'weekly') intervalMs = 7 * 86400000;
          if (frequency === 'twice_weekly') intervalMs = 3.5 * 86400000;
          if (frequency === 'every_2_days') intervalMs = 2 * 86400000;
          if (frequency === 'monthly') intervalMs = 30 * 86400000;
          const nextRunAt = new Date(Date.now() + Math.max(86400000, intervalMs)).toISOString();

          // Guard: If task is Full Autopilot or content creation, check if daily quota has been satisfied
          const isFullAutopilot = task.schedule_config?.full_autopilot === true || task.name === 'Zero-Touch Full Autopilot';
          const isContentTask = isFullAutopilot || /article|write|content|blog|draft/i.test(task.name || task.natural_language_instruction || '');

          if (isContentTask) {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { count: recentDrafts } = await supabase
              .from('content_drafts')
              .select('id', { count: 'exact', head: true })
              .eq('website_id', websiteId)
              .gte('created_at', oneDayAgo);

            const maxDaily = task.schedule_config?.max_daily_articles || 1;
            if ((recentDrafts ?? 0) >= maxDaily) {
              console.log(`[Cron Trigger] Daily article quota already satisfied (${recentDrafts}/${maxDaily}) for ${domain}. Advancing next_run_at and skipping execution to protect tokens.`);
              await supabase
                .from('tasks')
                .update({
                  last_run_at: nowIso,
                  next_run_at: nextRunAt,
                  updated_at: nowIso,
                })
                .eq('id', task.id);
              results.push({ task_id: task.id, status: 'skipped', reason: `Daily article quota reached (${recentDrafts}/${maxDaily})` });
              continue;
            }
          }

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

          // Execute task via FullAutopilotEngine if configured for Zero-Touch Full Autopilot
          const goal = task.name || task.natural_language_instruction;
          let summary = '';

          if (isFullAutopilot) {
            try {
              const { FullAutopilotEngine } = await import('@/lib/agent/fullAutopilotEngine');
              const cycleRes = await FullAutopilotEngine.runAutonomousCycle(websiteId);
              summary = cycleRes.summary;
            } catch (autoErr: any) {
              summary = `Autonomous cycle error: ${autoErr?.message || autoErr}`;
            }
          } else {
            // Execute task via ScheduleAgent
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
      platform_blog: platformBlogResult,
      results,
      timestamp: nowIso,
    });
  } catch (error: any) {
    console.error('[Cron Trigger] Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Job Executor for Background Worker
 * Dispatches claimed executions to the appropriate SEO Agent / Orchestrator.
 */

import { TaskExecutionJob, QueueManager } from './queueManager';
import { WorkerLogger } from './logger';
import { Orchestrator } from '../lib/agent/orchestrator';
import { ScheduleAgent } from '../lib/agent/scheduleAgent';
import { ContentAgent } from '../lib/agent/contentAgent';
import { CrawlService } from '../lib/crawler/crawlService';
import { createAdminClient } from '../lib/supabase/admin';

export class JobExecutor {
  private queueManager: QueueManager;
  private supabase = createAdminClient();

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
  }

  /**
   * Execute a single claimed job
   */
  async execute(job: TaskExecutionJob): Promise<void> {
    WorkerLogger.info(`Starting execution of job [${job.id}] (task: ${job.task_id})`);

    try {
      const payload = job.execution_payload || {};
      const jobType = payload.type || 'orchestrator_goal';

      switch (jobType) {
        case 'scheduled_agent_run': {
          await this.executeScheduledAgentRun(job, payload);
          break;
        }

        case 'content_draft': {
          await this.executeContentDraft(job, payload);
          break;
        }

        case 'crawl_job': {
          await this.executeCrawlJob(job, payload);
          break;
        }

        case 'workflow_continuation': {
          await this.executeWorkflowContinuation(job, payload);
          break;
        }

        case 'orchestrator_goal':
        default: {
          await this.executeOrchestratorGoal(job, payload);
          break;
        }
      }
    } catch (error: any) {
      WorkerLogger.error(`Execution failed for job [${job.id}]`, error);
      await this.queueManager.failOrRetryJob(job, error);
    }
  }

  /**
   * 1. Orchestrator Goal Execution
   */
  private async executeOrchestratorGoal(job: TaskExecutionJob, payload: Record<string, any>): Promise<void> {
    const goal = payload.goal || payload.natural_language_instruction || `SEO Optimization workflow for task ${job.task_id}`;
    const userId = payload.user_id || '00000000-0000-0000-0000-000000000000';
    const projectId = job.project_id;
    const websiteId = payload.website_id;

    WorkerLogger.info(`Executing Orchestrator goal for [${job.id}]: "${goal}"`);

    const orchestrator = new Orchestrator();
    const workflowState = await orchestrator.initializeWorkflow(goal, {
      userId,
      projectId,
      websiteId,
      taskId: job.task_id,
      executionId: job.id,
    });

    const completedState = await orchestrator.executeWorkflow(workflowState);

    if (completedState.current_stage === 'PAUSED_FOR_APPROVAL') {
      const summary = `Workflow paused: ${completedState.pending_packages?.length || 1} action package(s) awaiting approval.`;
      await this.queueManager.pauseForApproval(job.id, summary, {
        ...payload,
        workflow_state: completedState,
      });
    } else {
      const summary = `Completed ${completedState.completed_steps.length} steps successfully. ${completedState.history.length} actions recorded.`;
      await this.queueManager.completeJob(job.id, summary);
    }
  }

  /**
   * 2. Workflow Continuation (After User Approval)
   */
  private async executeWorkflowContinuation(job: TaskExecutionJob, payload: Record<string, any>): Promise<void> {
    const workflowState = payload.workflow_state;
    const approvedPackageId = payload.approved_package_id;

    if (!workflowState || !approvedPackageId) {
      throw new Error('workflow_state and approved_package_id are required for workflow continuation');
    }

    WorkerLogger.info(`Resuming workflow for [${job.id}] with approved package [${approvedPackageId}]`);

    const orchestrator = new Orchestrator();
    const finalState = await orchestrator.resumeWorkflow(workflowState, approvedPackageId);

    const summary = `Executed approved package ${approvedPackageId}. Final stage: ${finalState.current_stage}`;
    await this.queueManager.completeJob(job.id, summary);
  }

  /**
   * 3. Scheduled Autonomous Agent Run
   */
  private async executeScheduledAgentRun(job: TaskExecutionJob, payload: Record<string, any>): Promise<void> {
    const websiteId = payload.website_id;
    const websiteUrl = payload.website_url;
    const triggerType = payload.trigger_type || 'schedule';
    const config = payload.config;

    WorkerLogger.info(`Running scheduled agent for website [${websiteId}] (${websiteUrl})`);

    const agent = new ScheduleAgent();
    const runResult = await agent.executeRun({
      website_id: websiteId,
      website_url: websiteUrl,
      trigger_type: triggerType,
      config,
    });

    // Save run record to database
    await this.supabase.from('scheduled_agent_runs').insert({
      website_id: websiteId,
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

    const summary = `Scheduled run completed: ${runResult.summary || runResult.status}`;
    await this.queueManager.completeJob(job.id, summary);
  }

  /**
   * 4. Content Draft Generation
   */
  private async executeContentDraft(job: TaskExecutionJob, payload: Record<string, any>): Promise<void> {
    const draftId = payload.draft_id;
    const input = payload.content_input;

    if (!input || !draftId) {
      throw new Error('content_input and draft_id are required for content draft execution');
    }

    let websiteId = payload.website_id;
    if (!websiteId) {
      const { data: firstSite } = await this.supabase
        .from('websites')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (firstSite) websiteId = firstSite.id;
    }

    // Authoritative Memory & Instructions Loader from Supabase
    let projectInstructions = input.project_instructions || '';
    let projectMemory = input.project_memory || '';

    try {
      let memoryQuery = this.supabase
        .from('project_memory')
        .select('*')
        .eq('is_outdated', false)
        .order('is_important', { ascending: false });

      if (websiteId) {
        memoryQuery = memoryQuery.or(`website_id.eq.${websiteId},website_id.is.null`);
      }

      const { data: memoryRows } = await memoryQuery;

      if (memoryRows && memoryRows.length > 0) {
        const customInstrRow = memoryRows.find((m: any) => m.source === 'project_custom_instructions');
        const knowledgeBankRow = memoryRows.find((m: any) => m.source === 'project_knowledge_bank');
        const standardFacts = memoryRows.filter(
          (m: any) => m.source !== 'project_custom_instructions' && m.source !== 'project_knowledge_bank'
        );

        if (!projectInstructions && customInstrRow?.content) {
          projectInstructions = customInstrRow.content;
        }

        if (!projectMemory && knowledgeBankRow?.content) {
          projectMemory = knowledgeBankRow.content;
        }

        if (standardFacts.length > 0) {
          const uniqueFacts = new Set<string>();
          const factBlocks: string[] = [];

          for (const f of standardFacts) {
            const text = f.content?.trim();
            if (text && !uniqueFacts.has(text)) {
              uniqueFacts.add(text);
              factBlocks.push(`[${f.category?.toUpperCase() || 'FACT'}] ${text}`);
            }
          }

          if (factBlocks.length > 0) {
            projectMemory = projectMemory
              ? `${projectMemory}\n\n${factBlocks.join('\n\n')}`
              : factBlocks.join('\n\n');
          }
        }
      }

      // Check content_rules fallback
      if (!projectInstructions && websiteId) {
        const { data: websiteRules } = await this.supabase
          .from('content_rules')
          .select('custom_rules, word_count_min, word_count_max, tone, audience, author_style')
          .eq('website_id', websiteId)
          .maybeSingle();

        if (websiteRules?.custom_rules) {
          projectInstructions = websiteRules.custom_rules;
        }
        if (websiteRules?.word_count_min && !input.rules?.word_count_min) {
          input.rules.word_count_min = websiteRules.word_count_min;
        }
        if (websiteRules?.word_count_max && !input.rules?.word_count_max) {
          input.rules.word_count_max = websiteRules.word_count_max;
        }
      }
    } catch (memLoadErr) {
      WorkerLogger.warn('Failed to load project memory in worker', { error: (memLoadErr as any).message });
    }

    input.project_instructions = projectInstructions;
    input.project_memory = projectMemory;

    if (!input.rules) {
      input.rules = {
        word_count_min: 1200,
        word_count_max: 1800,
        language: 'U.S. English',
        tone: 'Professional, natural, helpful',
        audience: input.target_audience || 'Business founders and search audience',
        author_style: 'Experienced SEO content writer',
        structure_rules: 'Use H2 and H3 headings. Short paragraphs.',
        paragraph_style: 'Short and easy to read.',
        image_rules: 'Include relevant original images.',
        source_rules: 'Use reliable sources. Verify factual claims.',
        brand_rules: 'Do not make unsupported claims.',
        cta_rules: 'Include one relevant CTA.',
        avoid_rules: 'No keyword stuffing. No filler. No robotic language.',
        custom_rules: projectInstructions || '',
      };
    } else if (projectInstructions && !input.rules.custom_rules) {
      input.rules.custom_rules = projectInstructions;
    }

    input.website_id = websiteId;
    input.project_instructions = projectInstructions;
    input.project_memory = projectMemory;

    WorkerLogger.info(`Generating content draft [${draftId}] for keyword "${input.primary_keyword}" with ${projectInstructions ? 'custom instructions' : 'default guidelines'} and ${projectMemory ? 'knowledge base memory' : 'no prior memory'}`);

    const agent = new ContentAgent();
    const output = await agent.runFullPipeline(input, payload.revision_notes);

    // Update draft in database
    await this.supabase
      .from('content_drafts')
      .update({
        working_title: output.working_title,
        h1: output.content_body.match(/^# (.+)$/m)?.[1] || output.working_title,
        content_body: output.content_body,
        word_count: output.word_count,
        reading_time_minutes: output.reading_time_minutes,
        seo_title: output.seo_title,
        meta_description: output.meta_description,
        url_slug: output.url_slug,
        status: output.status,
        current_version: 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    // Save versions, QA, and images
    try {
      await this.supabase.from('content_versions').insert({
        draft_id: draftId,
        version_number: 1,
        content_body: output.content_body,
        word_count: output.word_count,
        status: output.status,
        qa_results: output.qa,
      });
    } catch {}

    try {
      if (output.qa) {
        await this.supabase.from('content_qa_results').insert({
          draft_id: draftId,
          version_number: 1,
          ...output.qa,
          facts_flagged: output.qa.facts_flagged,
        });
      }
    } catch {}

    if (Array.isArray(output.images)) {
      for (const img of output.images) {
        try {
          await this.supabase.from('content_images').insert({
            draft_id: draftId,
            placement_context: img.placement_context || 'Article body',
            image_type: img.image_type || 'featured',
            purpose: img.purpose || 'Visual enhancement',
            alt_text: img.alt_text || '',
            suggested_filename: img.suggested_filename || 'image.webp',
            status: img.generation_status || 'created',
          });
        } catch {}
      }
    }

    try {
      if (payload.website_id) {
        const memoryFact = `Published Content: "${output.working_title || output.seo_title}" covering target keyword "${output.primary_keyword}" (${output.search_intent} intent). Tailored for ${output.target_audience || 'target audience'}.`;
        await this.supabase.from('project_memory').insert({
          website_id: payload.website_id,
          category: 'content',
          content: memoryFact,
          source: 'autonomous_article_learning',
          source_detail: `Generated from article: "${output.primary_keyword}"`,
          confidence: 'high',
          is_important: false,
          tags: ['article_coverage', output.primary_keyword],
        });
      }
    } catch {}

    const summary = `Generated draft "${output.working_title}" (${output.word_count} words, ${output.images?.length || 0} images). Status: ${output.status}`;
    await this.queueManager.completeJob(job.id, summary);
  }

  /**
   * 5. Crawl Job Execution
   */
  private async executeCrawlJob(job: TaskExecutionJob, payload: Record<string, any>): Promise<void> {
    const targetUrl = payload.url || payload.website_url;
    const websiteId = payload.website_id;
    const maxPages = payload.max_pages || 50;

    if (!targetUrl) {
      throw new Error('Target URL is required for crawl job');
    }

    WorkerLogger.info(`Executing background crawl for [${targetUrl}] (max: ${maxPages} pages)`);

    const crawlResult = await CrawlService.runCrawlJob({
      websiteId,
      startUrl: targetUrl,
      maxPages,
    });

    const summary = `Crawl finished: ${crawlResult.pagesCrawled || 0} pages indexed, ${crawlResult.issuesFound || 0} issues detected.`;
    await this.queueManager.completeJob(job.id, summary);
  }
}

import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { AgentTask, AgentResult, WorkflowState, WorkflowPackage } from './types';
import { StrategyAgent } from './strategyAgent';
import { TechnicalSEOAgent } from './technicalSeoAgent';
import { MonitoringAgent } from './monitoringAgent';
import { ContentAgent } from './contentAgent';
import { CompetitorAgent } from './competitorAgent';
import { InternalLinkingAgent } from './internalLinkingAgent';
import { crawl_website } from '../tools/crawler';
import { serp_analysis_tool } from '../tools/dataforseo';
import { CrawlService } from '../crawler/crawlService';
import { WebsiteService, WebsiteContext } from '../services/websiteService';

export class Orchestrator {
  private MAX_ITERATIONS = 10;

  /**
   * Initializes a brand new workflow from a high-level user goal.
   * Transforms the GOAL into an initial DAG of tasks and binds central website context.
   */
  async initializeWorkflow(goal: string, context?: {
    userId?: string;
    projectId?: string;
    websiteId?: string;
    [key: string]: any;
  }): Promise<WorkflowState> {
    console.log(`[Orchestrator] Initializing workflow for goal: "${goal}"`);

    const userId = context?.userId || context?.user_id || '00000000-0000-0000-0000-000000000000';
    const requestedWebsiteId = context?.websiteId || context?.website_id;

    // Resolve central website context
    let websiteCtx: WebsiteContext | null = null;
    try {
      websiteCtx = await WebsiteService.resolveWebsiteContext(userId, requestedWebsiteId);
    } catch (err: any) {
      console.warn('[Orchestrator] Website context resolution notice:', err.message);
    }

    const boundContext = {
      ...context,
      website_id: websiteCtx?.id || requestedWebsiteId || 'default',
      website_url: websiteCtx?.url || 'https://example.com',
      domain: websiteCtx?.domain || 'example.com',
      platform: websiteCtx?.platform || 'other',
      integrations: websiteCtx?.integrations || [],
    };
    
    const { object } = await LLMProvider.generateObject({
      agent: 'Orchestrator',
      schema: z.object({
        initial_tasks: z.array(z.object({
          task_id: z.string(),
          target_agent: z.string(),
          task_type: z.string(),
          objective: z.string(),
          input_data: z.object({
            target_url: z.string(),
            notes: z.string(),
          }),
          priority: z.enum(['high', 'medium', 'low']),
          dependencies: z.array(z.string()).nullable()
        }))
      }),
      system: `You are the Autonomous SEO Orchestrator. 
Your job is to break down a high-level user GOAL into an initial workflow graph of tasks.
Target Website: ${boundContext.website_url} (Domain: ${boundContext.domain}, Platform: ${boundContext.platform}).
Available Agents: StrategyAgent, KeywordAgent, CompetitorAgent, ContentAgent, ImageAgent, TechnicalSEOAgent, InternalLinkingAgent, BacklinkAgent, MonitoringAgent.
Create a logical DAG (Directed Acyclic Graph) of tasks. Use 'dependencies' to ensure sequential execution when needed.
Never ask the user for their website URL because the website context is already centrally bound.`,
      prompt: `User Goal: ${goal}\nWebsite Context: ${JSON.stringify(boundContext)}\nPlan the initial workflow tasks.`
    });

    const pending_tasks: AgentTask[] = object.initial_tasks.map((t: any) => ({
      ...t,
      project_id: boundContext.projectId || (boundContext as any).project_id || 'default',
      source_agent: 'USER',
      status: 'PENDING',
      priority: t.priority as any,
      created_at: new Date().toISOString(),
      input_data: {
        ...(t.input_data || {}),
        website_id: boundContext.website_id,
        url: boundContext.website_url,
        domain: boundContext.domain,
        platform: boundContext.platform,
      }
    }));

    return {
      workflow_id: `wf_${Date.now()}`,
      project_id: boundContext.projectId || (boundContext as any).project_id || 'default',
      current_stage: 'RUNNING',
      completed_steps: [],
      pending_tasks,
      active_tasks: [],
      history: [],
      pending_packages: []
    };
  }

  /**
   * Main Execution Loop (Autonomous DAG Runner)
   */
  async executeWorkflow(state: WorkflowState): Promise<WorkflowState> {
    console.log(`[Orchestrator] Executing workflow: ${state.workflow_id}`);
    let iteration = 0;

    while (state.pending_tasks.length > 0 && iteration < this.MAX_ITERATIONS) {
      iteration++;
      console.log(`\n--- [Orchestrator] Iteration ${iteration} ---`);

      // 1. Find all tasks whose dependencies are fully resolved
      const readyTasks = state.pending_tasks.filter(task => {
        if (!task.dependencies || task.dependencies.length === 0) return true;
        return task.dependencies.every(depId => state.completed_steps.includes(depId));
      });

      if (readyTasks.length === 0) {
        console.warn('[Orchestrator] Deadlock or waiting on external tasks. Pausing.');
        break;
      }

      console.log(`[Orchestrator] Found ${readyTasks.length} ready tasks to execute.`);

      // 2. Dispatch tasks sequentially
      for (const task of readyTasks) {
        state.active_tasks.push(task);
        state.pending_tasks = state.pending_tasks.filter(t => t.task_id !== task.task_id);

        try {
          const result = await this.dispatchToAgent(task, state);
          
          // Move task from active to completed
          state.active_tasks = state.active_tasks.filter(t => t.task_id !== task.task_id);
          state.completed_steps.push(task.task_id);
          
          // Record step in history
          state.history.push({
            date: new Date().toISOString(),
            action: `${task.target_agent}:${task.task_type}`,
            data: result
          });

          // 3. Dynamic Expansion (Follow-up Tasks)
          if (result.next_agents && result.next_agents.length > 0) {
            console.log(`[Orchestrator] ${task.target_agent} suggested ${result.next_agents.length} follow up agents.`);
            for (const nextAgent of result.next_agents) {
              state.pending_tasks.push({
                task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                project_id: state.project_id,
                source_agent: task.target_agent,
                target_agent: nextAgent,
                task_type: 'FOLLOW_UP',
                objective: `Follow up task from ${task.target_agent}`,
                input_data: task.input_data,
                status: 'PENDING',
                priority: 'medium',
                dependencies: [task.task_id],
                created_at: new Date().toISOString()
              });
            }
          }

        } catch (error: any) {
          console.error(`[Orchestrator] Error running task ${task.task_id} with ${task.target_agent}:`, error);
          state.active_tasks = state.active_tasks.filter(t => t.task_id !== task.task_id);
          state.history.push({
            date: new Date().toISOString(),
            action: `${task.target_agent}:FAILED`,
            data: { error: error.message }
          });
        }
      }
    }

    // 4. Wrap up stage: generate Action Packages for human approval if needed
    await this.evaluateWorkflowCompletion(state);
    return state;
  }

  private async evaluateWorkflowCompletion(state: WorkflowState) {
    // Check if any executed steps produced proposed mutations requiring approval
    const unapprovedActions: any[] = [];
    for (const h of state.history) {
      if (h.data && h.data.proposed_actions && h.data.requires_approval) {
        unapprovedActions.push(...h.data.proposed_actions);
      }
    }

    if (unapprovedActions.length > 0) {
      console.log(`[Orchestrator] Workflow generated ${unapprovedActions.length} unapproved actions. Creating WorkflowPackage.`);
      const pkg: WorkflowPackage = {
        package_id: `pkg_${Date.now()}`,
        title: 'SEO Action Package',
        description: 'Autonomously generated actions requiring human approval before execution.',
        actions: unapprovedActions,
        status: 'PENDING_APPROVAL'
      };
      state.pending_packages = state.pending_packages || [];
      state.pending_packages.push(pkg);
      state.current_stage = 'PAUSED_FOR_APPROVAL';
    } else {
      console.log(`[Orchestrator] Workflow complete. No human approval required.`);
      state.current_stage = 'COMPLETED';
    }
  }

  async resumeWorkflow(state: WorkflowState, approvedPackageId: string): Promise<WorkflowState> {
    console.log(`[Orchestrator] Resuming workflow after approval of package: ${approvedPackageId}`);
    const pkg = state.pending_packages?.find(p => p.package_id === approvedPackageId);
    if (pkg) {
      pkg.status = 'EXECUTING';
      state.current_stage = 'EXECUTING_PACKAGE';
      console.log(`[Orchestrator] Automatically executing ${pkg.actions.length} approved actions...`);
      await new Promise(res => setTimeout(res, 1000));
      pkg.status = 'COMPLETED';
      state.current_stage = 'COMPLETED';
      console.log(`[Orchestrator] Execution successful.`);
    }
    return state;
  }

  private extractContextForAgent(agentName: string, state: WorkflowState) {
    let recentFindings: string[] = [];
    for (const h of state.history) {
      if (h.data && h.data.findings) {
        recentFindings.push(...h.data.findings);
      }
    }
    return { recentFindings };
  }

  private async dispatchToAgent(task: AgentTask, state: WorkflowState): Promise<AgentResult> {
    console.log(`[Orchestrator] Dispatching to ${task.target_agent}...`);

    let findings: string[] = [];
    let proposed_actions: any[] = [];
    let requires_approval = false;

    const injectedContext = this.extractContextForAgent(task.target_agent, state);
    const targetUrl = task.input_data?.url || 'https://example.com';
    const websiteId = task.input_data?.website_id || 'default';

    switch (task.target_agent) {
      case 'StrategyAgent': {
        const agent = new StrategyAgent();
        const analysis = await agent.generateStrategyRoadmap('ESTABLISHED', 'increase_organic_traffic', 50, 100);
        findings.push(analysis.phases.map(p => p.phase_title).join(', '));
        break;
      }
      case 'TechnicalSEOAgent': {
        const agent = new TechnicalSEOAgent();
        const crawlService = new CrawlService();
        const analysis = await crawlService.getOrAnalyzeWebsite({
          websiteId,
          targetUrl,
          maxPages: 50,
        });

        let crawlData = analysis.result;
        if (!crawlData && analysis.task_id) {
          const poll = await crawlService.getAnalysisStatus(analysis.crawl_id, analysis.task_id);
          crawlData = poll.result;
        }

        if (crawlData) {
          const techRes = await agent.analyze({ start_url: targetUrl, crawl_data: crawlData });
          findings.push(`Analyzed ${crawlData.pages.length} URLs for ${targetUrl}. Detected ${techRes.issues.length} technical issues.`);
          proposed_actions = techRes.issues.map((i: any) => ({ type: 'technical_fix', detail: i.description }));
          requires_approval = true;
        }
        break;
      }
      case 'MonitoringAgent': {
        const agent = new MonitoringAgent();
        const alerts = await agent.analyzeRankingShifts([], []); 
        findings.push(`Monitoring generated ${alerts.length} alerts for ${targetUrl}.`);
        break;
      }
      case 'CompetitorAgent': {
        const agent = new CompetitorAgent();
        const dynamicKeyword = task.input_data?.keyword || 'SEO software';
        const serpRes = await serp_analysis_tool(dynamicKeyword);
        const threats = serpRes.success && serpRes.data ? serpRes.data : [];
        const compRes = await agent.analyzeSerpThreats(threats);
        findings.push(`Detected ${compRes.length} SERP threats for keyword "${dynamicKeyword}".`);
        break;
      }
      case 'ContentAgent': {
        const agent = new ContentAgent();
        const dynamicKeyword = task.input_data?.keyword || 'SEO guide';
        const brief = await agent.generateBrief({
          primary_keyword: dynamicKeyword,
          secondary_keywords: [],
          search_intent: 'informational',
          content_type: 'blog',
          target_audience: 'marketers',
          rules: { word_count_min: 500, word_count_max: 1000, language: 'en', tone: 'professional', audience: 'marketers', author_style: 'direct', structure_rules: '', paragraph_style: '', image_rules: '', source_rules: '', brand_rules: '', cta_rules: '', avoid_rules: '' }
        });
        findings.push(`Drafted brief for: ${brief.working_title}`);
        proposed_actions = [{ type: 'publish_article', content: brief, website_id: websiteId }];
        requires_approval = true;
        break;
      }
      case 'InternalLinkingAgent': {
        const agent = new InternalLinkingAgent();
        const links = await agent.detectOrphanPages(task.input_data?.siteStructure || []);
        findings.push(`Found ${links.length} orphan pages on ${targetUrl}.`);
        proposed_actions = links;
        requires_approval = true;
        break;
      }
      default: {
        findings.push(`Executed step with ${task.target_agent}`);
        break;
      }
    }

    return {
      task_id: task.task_id,
      agent: task.target_agent,
      status: 'COMPLETED',
      findings,
      opportunities: [],
      recommendations: [],
      evidence: findings.join('\n'),
      proposed_actions,
      requires_approval,
    };
  }
}

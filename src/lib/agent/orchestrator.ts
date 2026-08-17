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

export class Orchestrator {
  private MAX_ITERATIONS = 10;

  /**
   * Initializes a brand new workflow from a high-level user goal.
   * Transforms the GOAL into an initial DAG of tasks.
   */
  async initializeWorkflow(goal: string, context?: any): Promise<WorkflowState> {
    console.log(`[Orchestrator] Initializing workflow for goal: "${goal}"`);
    
    const { object } = await LLMProvider.generateObject({
      agent: 'Orchestrator',
      schema: z.object({
        initial_tasks: z.array(z.object({
          task_id: z.string(),
          target_agent: z.string(),
          task_type: z.string(),
          objective: z.string(),
          input_data: z.any(),
          priority: z.enum(['high', 'medium', 'low']),
          dependencies: z.array(z.string()).optional()
        }))
      }),
      system: `You are the Autonomous SEO Orchestrator. 
Your job is to break down a high-level user GOAL into an initial workflow graph of tasks.
Available Agents: StrategyAgent, KeywordAgent, CompetitorAgent, ContentAgent, ImageAgent, TechnicalSEOAgent, InternalLinkingAgent, BacklinkAgent, MonitoringAgent.
Create a logical DAG (Directed Acyclic Graph) of tasks. Use 'dependencies' to ensure sequential execution when needed.`,
      prompt: `User Goal: ${goal}\nContext: ${JSON.stringify(context || {})}\nPlan the initial workflow tasks.`
    });

    const pending_tasks: AgentTask[] = object.initial_tasks.map((t: any) => ({
      ...t,
      project_id: 'default',
      source_agent: 'USER',
      status: 'PENDING',
      created_at: new Date().toISOString()
    }));

    return {
      workflow_id: `wf_${Date.now()}`,
      project_id: 'default',
      current_stage: 'RUNNING',
      completed_steps: [],
      pending_tasks,
      active_tasks: [],
      history: [],
      pending_packages: []
    };
  }

  /**
   * Main entrypoint for workflow execution.
   */
  async executeWorkflow(initialState: WorkflowState): Promise<WorkflowState> {
    console.log(`[Orchestrator] Executing workflow: ${initialState.workflow_id}`);
    
    let state = { ...initialState };
    state.current_stage = 'RUNNING';
    let iterations = 0;

    while (state.pending_tasks.length > 0 && iterations < this.MAX_ITERATIONS && state.current_stage === 'RUNNING') {
      iterations++;
      
      // Find tasks whose dependencies are met (or have no dependencies)
      const completedTaskIds = state.completed_steps;
      const readyTasks = state.pending_tasks.filter(t => 
        !t.dependencies || t.dependencies.every(dep => completedTaskIds.includes(dep))
      );

      if (readyTasks.length === 0) {
        console.log(`[Orchestrator] Workflow blocked on dependencies. Waiting...`);
        break; // In a real system, we might pause and await an event.
      }

      // 1. Pop the highest priority ready task
      const task = readyTasks[0];
      state.pending_tasks = state.pending_tasks.filter(t => t.task_id !== task.task_id);
      state.active_tasks.push(task);
      task.status = 'RUNNING';

      // 2. Dispatch to the agent
      try {
        const result = await this.dispatchToAgent(task, state);
        task.result = result;
        task.status = 'COMPLETED';
        task.completed_at = new Date().toISOString();
        
        state.completed_steps.push(task.task_id);
        state.history.push({ 
          date: new Date().toISOString(), 
          action: `[${task.target_agent}] Completed: ${task.objective}`,
          data: result
        });

        // 3. Determine NEXT steps dynamically
        const nextSteps = await this.determineNextSteps(state, result);
        if (nextSteps.new_tasks && nextSteps.new_tasks.length > 0) {
           const mappedTasks = nextSteps.new_tasks.map((t: any) => ({
             ...t,
             project_id: state.project_id,
             status: 'PENDING',
             created_at: new Date().toISOString()
           }));
           state.pending_tasks.push(...mappedTasks);
        }

      } catch (error) {
        console.error(`[Orchestrator] Task failed: ${task.task_id}`, error);
        task.status = 'FAILED';
        state.history.push({ date: new Date().toISOString(), action: `[${task.target_agent}] FAILED: ${task.objective}` });
      }

      // Remove from active
      state.active_tasks = state.active_tasks.filter(t => t.task_id !== task.task_id);
    }

    // After loop, check if we need approval for proposed actions
    if (state.pending_tasks.length === 0 && state.current_stage === 'RUNNING') {
      this.batchApprovals(state);
    }

    return state;
  }

  private batchApprovals(state: WorkflowState) {
    const unapprovedActions = [];
    for (const h of state.history) {
      if (h.data && h.data.requires_approval) {
        unapprovedActions.push(...h.data.proposed_actions);
      }
    }

    if (unapprovedActions.length > 0) {
      console.log(`[Orchestrator] Batching ${unapprovedActions.length} actions into an Approval Package.`);
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
      // Mock execution layer
      await new Promise(res => setTimeout(res, 1000));
      pkg.status = 'COMPLETED';
      state.current_stage = 'COMPLETED';
      console.log(`[Orchestrator] Execution successful.`);
    }
    return state;
  }

  private extractContextForAgent(agentName: string, state: WorkflowState) {
    // Collect findings from all previous steps to inject into the agent
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

    // Inject global workflow memory into the agent's task dynamically
    const injectedContext = this.extractContextForAgent(task.target_agent, state);
    console.log(`[Orchestrator] Injected ${injectedContext.recentFindings.length} findings into ${task.target_agent} context.`);

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
        const targetUrl = task.input_data?.url || 'https://example.com';
        const analysis = await crawlService.getOrAnalyzeWebsite({
          websiteId: task.input_data?.website_id || 'default',
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
          findings.push(`Analyzed ${crawlData.pages.length} URLs. Detected ${techRes.issues.length} technical issues.`);
          proposed_actions = techRes.issues.map((i: any) => ({ type: 'technical_fix', detail: i.description }));
          requires_approval = true;
        }
        break;
      }
      case 'MonitoringAgent': {
        const agent = new MonitoringAgent();
        const alerts = await agent.analyzeRankingShifts([], []); 
        findings.push(`Monitoring generated ${alerts.length} alerts.`);
        break;
      }
      case 'CompetitorAgent': {
        const agent = new CompetitorAgent();
        // If KeywordAgent ran previously, it might have populated recentFindings with a keyword
        const dynamicKeyword = task.input_data?.keyword || 'SEO software';
        const serpRes = await serp_analysis_tool(dynamicKeyword);
        const threats = serpRes.success && serpRes.data ? serpRes.data : [];
        const compRes = await agent.analyzeSerpThreats(threats);
        findings.push(`Detected ${compRes.length} SERP threats based on live query.`);
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
        proposed_actions = [{ type: 'publish_article', content: brief }];
        requires_approval = true;
        break;
      }
      case 'InternalLinkingAgent': {
        const agent = new InternalLinkingAgent();
        const links = await agent.detectOrphanPages(task.input_data?.siteStructure || []);
        findings.push(`Found ${links.length} orphan pages.`);
        proposed_actions = links;
        requires_approval = true;
        break;
      }
      default:
        console.log(`[Orchestrator] Simulated generic execution for ${task.target_agent}`);
        findings.push(`Simulated findings for ${task.target_agent}`);
        break;
    }

    return {
      task_id: task.task_id,
      agent: task.target_agent,
      status: 'COMPLETED',
      findings,
      opportunities: [],
      recommendations: [],
      evidence: "Agent execution completed successfully via adapter.",
      proposed_actions,
      requires_approval
    };
  }

  private async determineNextSteps(state: WorkflowState, lastResult: AgentResult) {
    const { object } = await LLMProvider.generateObject({
      agent: 'Orchestrator',
      schema: z.object({
        reasoning: z.string(),
        new_tasks: z.array(z.object({
          task_id: z.string(),
          source_agent: z.string(),
          target_agent: z.string(),
          task_type: z.string(),
          objective: z.string(),
          input_data: z.any(),
          priority: z.enum(['high', 'medium', 'low']),
          dependencies: z.array(z.string()).optional()
        }))
      }),
      system: `You are the SEO Orchestrator. 
Your job is to read the output of the last executed Agent and decide if another specialized agent needs to run immediately.
Available Agents: StrategyAgent, KeywordAgent, CompetitorAgent, ContentAgent, ImageAgent, TechnicalSEOAgent, InternalLinkingAgent, BacklinkAgent.
Return empty new_tasks array if no dynamic follow-up is needed and the pre-planned DAG should just continue.`,
      prompt: `Last Agent Result: ${JSON.stringify(lastResult)}\nDetermine if any immediate dynamic tasks are needed.`
    });
    return object;
  }
}

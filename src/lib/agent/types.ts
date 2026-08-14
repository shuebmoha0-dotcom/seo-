export type Priority = 'high' | 'medium' | 'low';
export type Confidence = 'high' | 'medium' | 'low';
export type Effort = 'high' | 'medium' | 'low';
export type Risk = 'high' | 'medium' | 'low';

export interface SEOOpportunity {
  problem: string;
  evidence: string;
  recommended_action: string;
  expected_impact: string;
  confidence: Confidence;
  effort: Effort;
  risk: Risk;
  priority: Priority;
}

// Generic Actions the LLM can decide to take
export type GenericActionType = 
  | 'update_title'
  | 'update_meta_description'
  | 'update_content'
  | 'add_internal_link'
  | 'create_content'
  | 'create_schema'
  | 'update_robots_txt'
  | 'update_canonical';

export interface GenericAction {
  type: GenericActionType;
  target_url: string; // The URL of the page to modify
  payload: Record<string, any>; // Type-specific payload
}

export interface UpdateTitleAction extends GenericAction {
  type: 'update_title';
  payload: {
    old_title: string;
    new_title: string;
  };
}

export interface UpdateMetaAction extends GenericAction {
  type: 'update_meta_description';
  payload: {
    old_meta: string;
    new_meta: string;
  };
}

// Execution layer interface (implemented by GitHub connector, etc.)
export interface PlatformConnector {
  // Returns true if the connector supports the framework
  identify_framework(files: string[]): Promise<string | null>;
  
  // Gets the content of a page/route from source code
  get_page_source(url_path: string): Promise<string | null>;
  
  // Translates a generic action to file modifications
  translate_action_to_diff(action: GenericAction): Promise<{
    file_path: string;
    diff_before: string;
    diff_after: string;
  }[]>;
  
  // Creates a branch, commits the diffs, and opens a PR
  execute_changes(
    branch_name: string, 
    changes: { file_path: string; new_content: string }[],
    pr_title: string,
    pr_body: string
  ): Promise<{ pr_url: string; pr_number: number }>;
}

export interface SEODataConnector {
  get_serp_results(keyword: string, location?: string): Promise<any>;
  get_keyword_metrics(keyword: string): Promise<{ volume: number; difficulty: number }>;
}

export interface SearchConsoleConnector {
  get_page_metrics(url: string, start_date: string, end_date: string): Promise<any>;
  get_query_metrics(query: string, start_date: string, end_date: string): Promise<any>;
}

// ─── Orchestration Types ────────────────────────────────────────────────────────

export type TaskStatus = 'PENDING' | 'RUNNING' | 'WAITING' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AgentTask {
  task_id: string;
  project_id: string;
  parent_task_id?: string;
  dependencies?: string[]; // IDs of tasks that must complete before this runs
  source_agent: string;
  target_agent: string;
  task_type: string;
  objective: string;
  input_data: any;
  priority: Priority;
  status: TaskStatus;
  created_at: string;
  completed_at?: string;
  result?: AgentResult;
}

export interface AgentResult {
  task_id: string;
  agent: string;
  status: TaskStatus;
  findings: string[];
  opportunities: any[];
  recommendations: string[];
  evidence: string;
  proposed_actions: any[];
  next_agents?: string[];
  requires_approval: boolean;
}

export interface WorkflowPackage {
  package_id: string;
  title: string;
  description: string;
  actions: any[];
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTING' | 'COMPLETED';
}

export type WorkflowEvent = 
  | 'PROJECT_CREATED'
  | 'WEBSITE_CRAWLED'
  | 'KEYWORD_RESEARCH_COMPLETED'
  | 'COMPETITOR_ANALYSIS_COMPLETED'
  | 'STRATEGY_UPDATED'
  | 'CONTENT_DRAFT_COMPLETED'
  | 'IMAGE_GENERATED'
  | 'TECHNICAL_ISSUE_FOUND'
  | 'INTERNAL_LINK_OPPORTUNITY_FOUND'
  | 'BACKLINK_OPPORTUNITY_FOUND'
  | 'ACTION_PROPOSED'
  | 'APPROVAL_REQUESTED'
  | 'ACTION_APPROVED'
  | 'ACTION_EXECUTED'
  | 'ACTION_VERIFIED'
  | 'RANKING_CHANGED'
  | 'TRAFFIC_CHANGED'
  | 'COMPETITOR_CHANGED';

export interface WorkflowState {
  workflow_id: string;
  project_id: string;
  current_stage: 'INITIALIZING' | 'RUNNING' | 'PAUSED_FOR_APPROVAL' | 'EXECUTING_PACKAGE' | 'COMPLETED' | 'FAILED' | 'IDLE' | 'DAILY_MONITORING';
  completed_steps: string[];
  pending_tasks: AgentTask[];
  active_tasks: AgentTask[];
  history: { date: string; action: string; data?: any }[];
  pending_packages?: WorkflowPackage[];
}

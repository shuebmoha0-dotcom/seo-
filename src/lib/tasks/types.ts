export interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // e.g., "09:00"
  timezone: string;
  day_of_week?: string; // e.g., "Monday"
  day_of_month?: number; // e.g., 1
}

export interface RecurringTask {
  task_id: string;
  project_id: string;
  user_id: string;
  original_prompt: string;
  goal: string;
  schedule: RecurringSchedule;
  status: 'active' | 'paused' | 'failed';
  next_run_at: string;
  last_run_at?: string;
  workflow_definition?: string | null;
  approval_policy: 'required_for_publish' | 'autonomous';
  execution_history: TaskExecutionRecord[];
}

export interface TaskExecutionRecord {
  run_id: string;
  date: string;
  status: 'completed' | 'failed' | 'awaiting_approval' | 'executing';
  workflow_id: string;
  summary?: string;
}

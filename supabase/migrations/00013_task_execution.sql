-- Migration 00013: Tasks + Execution Model

-- ─────────────────────────────────────────────
-- 1. TASKS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  natural_language_instruction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'failed', 'completed', 'archived')),
  schedule_type TEXT NOT NULL DEFAULT 'once' CHECK (schedule_type IN ('once', 'daily', 'weekly', 'monthly', 'custom')),
  schedule_config JSONB DEFAULT '{}',
  -- e.g. { "time": "09:00", "day_of_week": "Monday", "timezone": "UTC" }
  timezone TEXT NOT NULL DEFAULT 'UTC',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_next_run_at ON public.tasks(next_run_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tasks"
  ON public.tasks FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. TASK EXECUTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled'
  )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  result_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON public.task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_project_id ON public.task_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON public.task_executions(status);

ALTER TABLE public.task_executions ENABLE ROW LEVEL SECURITY;

-- Users can see executions of their own tasks
CREATE POLICY "Users view own task executions"
  ON public.task_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_executions.task_id
      AND tasks.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 3. AGENT EXECUTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_execution_id UUID REFERENCES public.task_executions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  -- e.g. Orchestrator, ContentAgent, KeywordAgent
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 1,
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_executions_task_execution_id ON public.agent_executions(task_execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_project_id ON public.agent_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_type ON public.agent_executions(agent_type);

ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agent executions"
  ON public.agent_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = agent_executions.project_id
      AND projects.user_id = auth.uid()
    )
  );

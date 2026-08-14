-- Migration: Scheduled Autonomous SEO Agent Schema

-- 1. Schedule Configuration per Website
CREATE TABLE IF NOT EXISTS public.scheduled_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,

  -- Schedule settings
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'custom', 'every_12_hours')),
  schedule_time TEXT DEFAULT '09:00',     -- HH:MM in 24h format
  custom_cron TEXT,                        -- Optional 5-field cron expression for custom mode
  timezone TEXT DEFAULT 'America/New_York',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,

  -- Budget and cost limits
  daily_budget_usd NUMERIC(8,2) DEFAULT 10.00,
  monthly_budget_usd NUMERIC(8,2) DEFAULT 100.00,
  current_daily_spend_usd NUMERIC(8,4) DEFAULT 0.0,
  current_monthly_spend_usd NUMERIC(8,4) DEFAULT 0.0,
  max_tasks_per_run INTEGER DEFAULT 5,
  max_crawl_urls INTEGER DEFAULT 100,

  -- Notification settings
  notify_on_run_complete BOOLEAN DEFAULT true,
  notify_on_opportunity BOOLEAN DEFAULT true,
  notify_on_approval_required BOOLEAN DEFAULT true,
  notify_on_technical_error BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id)
);

-- 2. Scheduled Agent Runs (Run History & Audit Log)
CREATE TABLE IF NOT EXISTS public.scheduled_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,

  trigger_type TEXT DEFAULT 'schedule' CHECK (trigger_type IN ('schedule', 'manual_run_now', 'retry')),

  -- Run lifecycle state
  status TEXT DEFAULT 'running' CHECK (status IN (
    'running', 'completed', 'no_action_needed', 'waiting_approval', 'failed', 'budget_exceeded'
  )),

  -- Timestamps
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,

  -- Observation & Analysis Stats
  pages_analyzed INTEGER DEFAULT 0,
  queries_checked INTEGER DEFAULT 0,
  ranking_changes_detected INTEGER DEFAULT 0,
  opportunities_found INTEGER DEFAULT 0,

  -- Actions
  actions_prepared INTEGER DEFAULT 0,
  actions_approved INTEGER DEFAULT 0,
  actions_executed INTEGER DEFAULT 0,
  actions_verified INTEGER DEFAULT 0,

  -- Costs
  estimated_cost_usd NUMERIC(8,4) DEFAULT 0.0,

  -- Detailed Output & State
  summary TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  multi_phase_state JSONB DEFAULT '{}', -- Tracks multi-day workflows (Day 1 Research → Day 2 Draft etc.)

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Daily Intelligence (Snapshot of detected changes per run)
CREATE TABLE IF NOT EXISTS public.daily_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.scheduled_agent_runs(id) ON DELETE CASCADE,

  -- Category snapshots
  website_changes JSONB DEFAULT '{}',     -- new/deleted pages, title edits, technical errors
  seo_changes JSONB DEFAULT '{}',         -- ranking shifts, CTR changes, impression surges
  competitor_changes JSONB DEFAULT '{}',  -- new competitor pages, rank changes
  backlink_changes JSONB DEFAULT '{}',    -- new/lost backlinks
  aeo_changes JSONB DEFAULT '{}',         -- AI citation visibility

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Notifications Log
CREATE TABLE IF NOT EXISTS public.agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.scheduled_agent_runs(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'run_complete', 'opportunity_found', 'approval_required',
    'technical_alert', 'execution_success', 'execution_failed', 'integration_issue'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.scheduled_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_notifications ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_website ON public.scheduled_agent_runs(website_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_status ON public.scheduled_agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_daily_intelligence_run ON public.daily_intelligence(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_website ON public.agent_notifications(website_id);

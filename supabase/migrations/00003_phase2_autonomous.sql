-- Migration: Phase 2 Controlled Autonomous Execution Schema Extension

-- 1. Permission Settings & Configurable Limits Table
CREATE TABLE IF NOT EXISTS public.permission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  permission_level INTEGER NOT NULL DEFAULT 1 CHECK (permission_level BETWEEN 0 AND 4),
  -- Level 0: Read-only
  -- Level 1: Low-risk SEO changes (Meta, Title, Alt text, Internal links)
  -- Level 2: Content modifications (Content updates, Schema, Articles)
  -- Level 3: Publishing
  -- Level 4: High-risk actions (URL changes, Redirects, Deleting content) - NEVER autonomous
  max_actions_per_run INTEGER DEFAULT 5,
  max_content_changes_per_day INTEGER DEFAULT 10,
  max_articles_per_day INTEGER DEFAULT 2,
  max_execution_cost NUMERIC DEFAULT 10.00,
  max_runtime_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id)
);

-- 2. Pre-change Content Snapshots for Rollback Table
CREATE TABLE IF NOT EXISTS public.rollbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.seo_opportunities(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  target_url TEXT NOT NULL,
  content_before TEXT NOT NULL,
  content_after TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'rolled_back'
  rolled_back_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Agent State Machine Audit Trail Logs Table
CREATE TABLE IF NOT EXISTS public.agent_state_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  state TEXT NOT NULL, -- 'OBSERVE', 'ANALYZE', 'PRIORITIZE', 'PLAN', 'PERMISSION_CHECK', 'EXECUTE', 'VERIFY', 'LEARN'
  step_description TEXT NOT NULL,
  metadata JSONB,
  status TEXT DEFAULT 'completed', -- 'completed', 'failed', 'gated'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.permission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_state_logs ENABLE ROW LEVEL SECURITY;

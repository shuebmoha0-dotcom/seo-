-- Migration: Central Strategy Agent Schema Extension

-- 1. Business Goals Table
CREATE TABLE IF NOT EXISTS public.business_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  primary_goal TEXT NOT NULL CHECK (primary_goal IN (
    'increase_organic_traffic', 
    'generate_qualified_leads', 
    'increase_organic_signups', 
    'build_topical_authority', 
    'aeo_ai_search_visibility',
    'improve_organic_conversion'
  )),
  target_audience TEXT,
  target_market TEXT,
  monthly_budget_credits INTEGER DEFAULT 500,
  autonomy_level TEXT DEFAULT 'human_approval', -- 'autonomous', 'human_approval', 'strict_review'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id)
);

-- 2. Project Strategic Memory Table
CREATE TABLE IF NOT EXISTS public.project_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'win', 'failure', 'lesson_learned', 'rejected_opportunity', 'keyword_intent_map'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Multi-Phase Strategic Plans Table
CREATE TABLE IF NOT EXISTS public.strategic_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  website_maturity TEXT NOT NULL, -- 'NEW', 'ESTABLISHED'
  phases JSONB NOT NULL, -- Array of phases (Phase 1 Fix Indexability, Phase 2 Core Pages, etc.)
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'adapted'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sub-Agent Delegations Table
CREATE TABLE IF NOT EXISTS public.agent_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  target_agent TEXT NOT NULL, -- 'Keyword Agent', 'Competitor Agent', 'Content Agent', 'Technical SEO Agent', 'On-Page SEO Agent', 'Backlink Agent', 'AEO Agent'
  task_title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  priority_score NUMERIC NOT NULL,
  requires_approval BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'queued', -- 'queued', 'executing', 'completed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_delegations ENABLE ROW LEVEL SECURITY;

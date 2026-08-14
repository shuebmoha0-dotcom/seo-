-- Migration: Project Memory System

-- 1. Project Memory Table
CREATE TABLE IF NOT EXISTS public.project_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,

  -- Memory content
  category TEXT NOT NULL CHECK (category IN (
    'company', 'product', 'audience', 'brand', 'content_strategy',
    'seo_strategy', 'competitors', 'keywords', 'content',
    'preferences', 'decisions', 'experiments', 'technical', 'workflow'
  )),
  content TEXT NOT NULL,
  source TEXT NOT NULL, -- Where this memory came from (e.g. 'user_instruction', 'agent_discovery', 'keyword_analysis')
  source_detail TEXT, -- More specific source (e.g. the message or agent action that generated it)

  -- Confidence and importance
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  is_important BOOLEAN DEFAULT false,
  is_outdated BOOLEAN DEFAULT false,
  outdated_reason TEXT,
  superseded_by UUID REFERENCES public.project_memory(id),

  -- Tags for selective retrieval
  tags TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Memory Activity Log (for "Agent learned" feed)
CREATE TABLE IF NOT EXISTS public.memory_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES public.project_memory(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('learned', 'updated', 'deleted', 'marked_important', 'user_added', 'user_edited', 'outdated')),
  summary TEXT NOT NULL, -- Human-readable summary e.g. "Agent learned: Your primary audience is SaaS founders."
  triggered_by TEXT DEFAULT 'agent' CHECK (triggered_by IN ('agent', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_activity ENABLE ROW LEVEL SECURITY;

-- Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_project_memory_website ON public.project_memory(website_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_category ON public.project_memory(category);
CREATE INDEX IF NOT EXISTS idx_project_memory_tags ON public.project_memory USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memory_activity_website ON public.memory_activity(website_id);

-- Migration: Keyword Research Agent Schema Extension

-- 1. Keyword Clusters Table
CREATE TABLE IF NOT EXISTS public.keyword_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,
  primary_keyword TEXT NOT NULL,
  secondary_keywords TEXT[] DEFAULT '{}',
  supporting_queries TEXT[] DEFAULT '{}',
  related_entities TEXT[] DEFAULT '{}',
  search_intent TEXT NOT NULL CHECK (search_intent IN (
    'informational', 'commercial_investigation', 'transactional', 
    'navigational', 'local', 'comparison', 'problem_solution'
  )),
  recommended_content_type TEXT NOT NULL CHECK (recommended_content_type IN (
    'blog_article', 'landing_page', 'product_page', 'feature_page',
    'comparison_page', 'use_case_page', 'integration_page', 'guide', 'faq', 'other'
  )),
  existing_url TEXT, -- If existing page already covers intent
  status TEXT DEFAULT 'discovered', -- 'discovered', 'approved', 'rejected', 'content_created'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Keyword Opportunities Table
CREATE TABLE IF NOT EXISTS public.keyword_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES public.keyword_clusters(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  search_intent TEXT NOT NULL,
  content_type TEXT NOT NULL,
  search_volume INTEGER,             -- NULL if unavailable
  keyword_difficulty INTEGER,        -- NULL if unavailable
  cpc NUMERIC,                       -- NULL if unavailable
  business_relevance INTEGER CHECK (business_relevance BETWEEN 0 AND 100),
  competition TEXT CHECK (competition IN ('low', 'medium', 'high')),
  current_position INTEGER,          -- NULL if not ranking
  current_url TEXT,                  -- Existing page if any
  recommended_action TEXT CHECK (recommended_action IN (
    'create_new_page', 'optimize_existing', 'merge', 'redirect', 'monitor', 'skip'
  )),
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  evidence TEXT,
  cannibalization_warning BOOLEAN DEFAULT FALSE,
  cannibalization_competing_url TEXT,
  data_available BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'brief_created'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Content Briefs Table
CREATE TABLE IF NOT EXISTS public.content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES public.keyword_clusters(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.keyword_opportunities(id) ON DELETE SET NULL,
  primary_keyword TEXT NOT NULL,
  secondary_keywords TEXT[] DEFAULT '{}',
  search_intent TEXT NOT NULL,
  target_audience TEXT,
  content_type TEXT NOT NULL,
  recommended_title TEXT NOT NULL,
  h1 TEXT NOT NULL,
  h2_h3_structure JSONB NOT NULL, -- Array of {level, heading, notes}
  questions_to_answer TEXT[] DEFAULT '{}',
  important_entities TEXT[] DEFAULT '{}',
  competitor_observations TEXT,
  content_gaps TEXT,
  internal_linking_opportunities TEXT[] DEFAULT '{}',
  recommended_word_count_min INTEGER DEFAULT 800,
  recommended_word_count_max INTEGER DEFAULT 1800,
  cta_recommendation TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'sent_to_content_agent', 'content_created'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.keyword_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;

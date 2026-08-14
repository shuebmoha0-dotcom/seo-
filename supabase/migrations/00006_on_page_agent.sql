-- Migration: On-Page SEO Agent Schema

-- 1. On-Page Analysis Table
CREATE TABLE IF NOT EXISTS public.on_page_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Crawled page data
  page_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  h2s TEXT[],
  h3s TEXT[],
  word_count INTEGER,
  canonical_url TEXT,
  url_slug TEXT,
  robots_meta TEXT,

  -- Target intent inputs
  target_keyword TEXT,
  secondary_keywords TEXT[],
  search_intent TEXT,
  content_type TEXT,

  -- Scores (diagnostic only, not ranking guarantees)
  intent_alignment_score INTEGER,     -- 0-100
  content_coverage_score INTEGER,     -- 0-100
  technical_score INTEGER,            -- 0-100
  metadata_score INTEGER,             -- 0-100
  linking_score INTEGER,              -- 0-100
  overall_diagnostic INTEGER,         -- 0-100

  -- Detected schema
  existing_schema JSONB,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzed', 'optimizing', 'needs_content_agent', 'ready', 'approved')),
  requires_content_agent BOOLEAN DEFAULT false,
  requires_image_agent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. On-Page Recommendations Table
CREATE TABLE IF NOT EXISTS public.on_page_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.on_page_analyses(id) ON DELETE CASCADE,

  -- Recommendation metadata
  category TEXT NOT NULL CHECK (category IN (
    'title', 'meta_description', 'h1', 'headings', 'content_gap',
    'keyword_optimization', 'internal_links', 'external_links',
    'images', 'url', 'schema', 'canonical', 'search_intent',
    'readability', 'featured_snippet', 'faq'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),

  -- Issue and fix
  issue TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  current_value TEXT,
  suggested_value TEXT,
  reasoning TEXT NOT NULL,

  -- Execution
  requires_approval BOOLEAN DEFAULT false,
  auto_applicable BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'applied', 'rejected', 'skipped')),
  applied_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. On-Page QA Checks Table
CREATE TABLE IF NOT EXISTS public.on_page_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.on_page_analyses(id) ON DELETE CASCADE,

  -- QA checklist
  target_keyword_in_title BOOLEAN,
  target_keyword_in_h1 BOOLEAN,
  target_keyword_in_intro BOOLEAN,
  meta_description_exists BOOLEAN,
  meta_description_length_ok BOOLEAN,
  single_h1 BOOLEAN,
  logical_heading_structure BOOLEAN,
  no_keyword_stuffing BOOLEAN,
  internal_links_present BOOLEAN,
  images_have_alt_text BOOLEAN,
  canonical_correct BOOLEAN,
  schema_present BOOLEAN,
  content_covers_intent BOOLEAN,
  readability_ok BOOLEAN,
  url_clean BOOLEAN,

  -- Flags
  flagged_issues TEXT[],
  overall_status TEXT CHECK (overall_status IN ('pass', 'needs_revision', 'needs_content_agent')),
  qa_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.on_page_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.on_page_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.on_page_qa ENABLE ROW LEVEL SECURITY;

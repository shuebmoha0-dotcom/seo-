-- Migration: Content Agent Schema

-- 1. Content Rules Table (per-website user-defined rules)
CREATE TABLE IF NOT EXISTS public.content_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  word_count_min INTEGER DEFAULT 900,
  word_count_max INTEGER DEFAULT 1500,
  language TEXT DEFAULT 'U.S. English',
  tone TEXT DEFAULT 'Professional, natural, helpful',
  audience TEXT DEFAULT 'SaaS founders and marketing teams',
  author_style TEXT DEFAULT 'Experienced SEO content writer',
  structure_rules TEXT DEFAULT 'Use H2 and H3 headings. Short paragraphs.',
  paragraph_style TEXT DEFAULT 'Short, easy to read, max 3 sentences.',
  image_rules TEXT DEFAULT 'Include relevant original images for key concepts.',
  source_rules TEXT DEFAULT 'Use reliable sources. Verify factual claims.',
  brand_rules TEXT DEFAULT 'Do not make unsupported claims about the product.',
  cta_rules TEXT DEFAULT 'Include one relevant CTA per article.',
  avoid_rules TEXT DEFAULT 'No keyword stuffing. No filler. No robotic language. No fake statistics.',
  custom_rules TEXT, -- Free-form additional rules
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Content Drafts Table
CREATE TABLE IF NOT EXISTS public.content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  opportunity_id UUID, -- References keyword opportunity if from keyword agent
  primary_keyword TEXT NOT NULL,
  secondary_keywords TEXT[] DEFAULT '{}',
  search_intent TEXT NOT NULL,
  content_type TEXT NOT NULL,
  target_audience TEXT,
  working_title TEXT NOT NULL,
  h1 TEXT,
  content_body TEXT,
  word_count INTEGER,
  reading_time_minutes INTEGER,
  seo_title TEXT,
  meta_description TEXT,
  url_slug TEXT,
  status TEXT DEFAULT 'brief_pending' CHECK (status IN (
    'brief_pending',    -- Brief created, not yet written
    'writing',          -- AI is generating
    'qa_pending',       -- Draft written, QA not yet run
    'needs_revision',   -- QA failed or human requested revision
    'ready_for_approval', -- QA passed, waiting for human
    'approved',         -- Human approved
    'rejected',         -- Human rejected
    'published'         -- Published
  )),
  current_version INTEGER DEFAULT 1,
  revision_notes TEXT,   -- From human or QA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Content Versions Table
CREATE TABLE IF NOT EXISTS public.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.content_drafts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_body TEXT NOT NULL,
  word_count INTEGER,
  status TEXT NOT NULL,
  revision_notes TEXT,
  qa_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Content QA Results Table
CREATE TABLE IF NOT EXISTS public.content_qa_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.content_drafts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  -- Checklist results
  intent_match BOOLEAN,
  primary_keyword_present BOOLEAN,
  secondary_keywords_present BOOLEAN,
  word_count_pass BOOLEAN,
  style_pass BOOLEAN,
  heading_structure_pass BOOLEAN,
  no_keyword_stuffing BOOLEAN,
  no_filler BOOLEAN,
  cta_present BOOLEAN,
  internal_links_present BOOLEAN,
  images_specified BOOLEAN,
  alt_text_present BOOLEAN,
  product_accuracy_pass BOOLEAN,
  facts_flagged TEXT[], -- List of flagged claims
  overall_status TEXT CHECK (overall_status IN ('pass', 'needs_revision')),
  qa_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Content Image Requirements Table
CREATE TABLE IF NOT EXISTS public.content_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.content_drafts(id) ON DELETE CASCADE,
  placement_context TEXT NOT NULL, -- Where in article (after which heading)
  image_type TEXT NOT NULL, -- 'featured', 'diagram', 'screenshot', 'chart', 'illustration'
  purpose TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  suggested_filename TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'created', 'approved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.content_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_qa_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_images ENABLE ROW LEVEL SECURITY;

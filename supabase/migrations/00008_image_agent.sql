-- Migration: Image Agent Schema

-- 1. Image Plans (one per article/page session)
CREATE TABLE IF NOT EXISTS public.image_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  content_draft_id UUID,
  article_url TEXT,
  article_title TEXT NOT NULL,
  content_type TEXT,
  target_keyword TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN (
    'planning', 'generating', 'qa', 'pending_approval', 'approved', 'published', 'needs_revision'
  )),
  total_images_planned INTEGER DEFAULT 0,
  total_images_ready INTEGER DEFAULT 0,
  project_instructions TEXT,
  visual_style_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Individual Image Assets
CREATE TABLE IF NOT EXISTS public.image_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.image_plans(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  image_type TEXT NOT NULL CHECK (image_type IN (
    'featured', 'illustration', 'diagram', 'workflow', 'infographic',
    'comparison', 'chart', 'screenshot', 'product_screenshot',
    'step_by_step', 'conceptual', 'data_visualization'
  )),
  purpose TEXT NOT NULL,
  placement TEXT NOT NULL,
  placement_order INTEGER DEFAULT 0,
  visual_description TEXT NOT NULL,
  aspect_ratio TEXT DEFAULT '16:9',
  dimensions TEXT,
  generation_method TEXT DEFAULT 'ai_generated' CHECK (generation_method IN (
    'ai_generated', 'media_library', 'licensed_source', 'programmatic', 'existing_asset', 'screenshot_required'
  )),
  generation_prompt TEXT,
  source_url TEXT,
  source_license TEXT,
  filename TEXT,
  alt_text TEXT,
  caption TEXT,
  file_format TEXT DEFAULT 'webp',
  file_size_kb INTEGER,
  width_px INTEGER,
  height_px INTEGER,
  stored_path TEXT,
  qa_passed BOOLEAN,
  qa_notes TEXT,
  qa_checks JSONB,
  status TEXT DEFAULT 'planning' CHECK (status IN (
    'planning', 'prompt_ready', 'generating', 'generated',
    'qa_passed', 'qa_failed', 'pending_approval',
    'approved', 'rejected', 'needs_regeneration', 'published'
  )),
  rejection_reason TEXT,
  regeneration_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.image_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_image_plans_website ON public.image_plans(website_id);
CREATE INDEX IF NOT EXISTS idx_image_assets_plan ON public.image_assets(plan_id);

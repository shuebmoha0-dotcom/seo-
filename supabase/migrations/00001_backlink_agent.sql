-- Migration: Backlink Agent Schema Extension

-- 1. Backlink Prospects Table
CREATE TABLE IF NOT EXISTS public.backlink_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  prospect_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  category TEXT NOT NULL, -- 'competitor_gap', 'resource_page', 'unlinked_mention', 'broken_link', 'guest_contribution'
  relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 100),
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  opportunity_score INTEGER CHECK (opportunity_score BETWEEN 0 AND 100),
  risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  outreach_priority TEXT CHECK (outreach_priority IN ('high', 'medium', 'low')),
  contact_page TEXT,
  editor_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, prospect_url)
);

-- 2. Backlink Pipeline Table
CREATE TABLE IF NOT EXISTS public.backlink_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.backlink_prospects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN (
    'IDENTIFIED', 'QUALIFIED', 'OUTREACH_DRAFTED', 'APPROVED', 
    'CONTACTED', 'REPLIED', 'NEGOTIATING', 'LINK_ACQUIRED', 
    'LINK_VERIFIED', 'LINK_LOST'
  )),
  outreach_subject TEXT,
  outreach_message TEXT,
  user_approved BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Acquired Backlinks Table
CREATE TABLE IF NOT EXISTS public.acquired_backlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  linking_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  is_dofollow BOOLEAN DEFAULT TRUE,
  http_status INTEGER DEFAULT 200,
  verification_status TEXT DEFAULT 'verified', -- 'verified', 'missing', 'attributes_changed'
  first_discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, linking_url, target_url)
);

-- 4. Linkable Assets Recommendations Table
CREATE TABLE IF NOT EXISTS public.linkable_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- 'original_research', 'industry_statistics', 'free_tool', 'calculator', 'template', 'guide'
  rationale TEXT NOT NULL,
  competitor_link_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'recommended', -- 'recommended', 'in_production', 'published'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.backlink_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlink_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acquired_backlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkable_assets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can access their backlink prospects" ON public.backlink_prospects FOR ALL USING (
  EXISTS (SELECT 1 FROM public.websites WHERE websites.id = backlink_prospects.website_id AND websites.user_id = auth.uid())
);

-- Migration 00016: Competitors Intelligence Schema

CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  type TEXT DEFAULT 'Direct' CHECK (type IN ('Direct', 'Content', 'Indirect', 'Organic')),
  overlap_score NUMERIC DEFAULT 0,
  overlap_keywords INTEGER DEFAULT 0,
  total_keywords INTEGER DEFAULT 0,
  trend NUMERIC DEFAULT 0,
  strengths TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ignored', 'analyzing')),
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, domain)
);

CREATE TABLE IF NOT EXISTS public.competitor_threats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  competitor_domain TEXT NOT NULL,
  competitor_movement TEXT NOT NULL,
  customer_movement TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('Critical', 'Moderate', 'Low')),
  analysis TEXT NOT NULL,
  recommended_response TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'addressed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.content_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('Missing Topic', 'Long-Tail', 'Content Depth', 'Format Gap')),
  search_volume INTEGER,
  difficulty TEXT CHECK (difficulty IN ('Very Low', 'Low', 'Medium', 'High', 'Very High')),
  competitor_domain TEXT NOT NULL,
  note TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'brief_created', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own competitors" ON public.competitors FOR ALL
  USING (EXISTS (SELECT 1 FROM public.websites WHERE websites.id = competitors.website_id AND websites.user_id = auth.uid()));

CREATE POLICY "Users access own competitor threats" ON public.competitor_threats FOR ALL
  USING (EXISTS (SELECT 1 FROM public.websites WHERE websites.id = competitor_threats.website_id AND websites.user_id = auth.uid()));

CREATE POLICY "Users access own content gaps" ON public.content_gaps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.websites WHERE websites.id = content_gaps.website_id AND websites.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_competitors_website_id ON public.competitors(website_id);
CREATE INDEX IF NOT EXISTS idx_competitor_threats_website_id ON public.competitor_threats(website_id);
CREATE INDEX IF NOT EXISTS idx_content_gaps_website_id ON public.content_gaps(website_id);

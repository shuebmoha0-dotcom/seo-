-- Migration: Technical SEO Agent Schema

-- 1. Crawl Sessions
CREATE TABLE IF NOT EXISTS public.technical_crawls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,

  -- Crawl configuration
  start_url TEXT NOT NULL,
  site_tech TEXT DEFAULT 'unknown' CHECK (site_tech IN (
    'nextjs', 'react', 'astro', 'nuxt', 'static_html',
    'webflow', 'wordpress', 'shopify', 'headless_cms', 'custom', 'unknown'
  )),
  crawl_depth INTEGER DEFAULT 3,
  max_urls INTEGER DEFAULT 500,
  crawl_mode TEXT DEFAULT 'full' CHECK (crawl_mode IN ('full', 'incremental', 'targeted')),

  -- Results
  total_urls_found INTEGER DEFAULT 0,
  total_urls_crawled INTEGER DEFAULT 0,
  urls_200 INTEGER DEFAULT 0,
  urls_301 INTEGER DEFAULT 0,
  urls_302 INTEGER DEFAULT 0,
  urls_404 INTEGER DEFAULT 0,
  urls_5xx INTEGER DEFAULT 0,
  urls_noindex INTEGER DEFAULT 0,
  urls_indexed INTEGER DEFAULT 0,
  urls_orphaned INTEGER DEFAULT 0,
  broken_internal_links INTEGER DEFAULT 0,

  -- Scores (diagnostic)
  crawlability_score INTEGER,
  indexability_score INTEGER,
  technical_health_score INTEGER,

  -- State
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'partial'
  )),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Individual URLs crawled
CREATE TABLE IF NOT EXISTS public.crawled_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id UUID NOT NULL REFERENCES public.technical_crawls(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,

  url TEXT NOT NULL,
  status_code INTEGER,
  redirect_target TEXT,
  canonical_url TEXT,
  canonical_is_self BOOLEAN,
  robots_directive TEXT,       -- index/noindex/nofollow etc
  in_sitemap BOOLEAN DEFAULT false,
  is_indexable BOOLEAN DEFAULT true,
  has_hreflang BOOLEAN DEFAULT false,

  -- Content signals
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  word_count INTEGER,

  -- Links
  internal_links_in INTEGER DEFAULT 0,   -- links pointing TO this page
  internal_links_out INTEGER DEFAULT 0,  -- links FROM this page
  external_links_out INTEGER DEFAULT 0,
  is_orphan BOOLEAN DEFAULT false,

  -- Performance (if available)
  lcp_ms INTEGER,
  cls_score NUMERIC(4,3),
  inp_ms INTEGER,

  -- Structured data
  has_schema BOOLEAN DEFAULT false,
  schema_types TEXT[],

  -- Flags
  has_duplicate_title BOOLEAN DEFAULT false,
  has_duplicate_meta BOOLEAN DEFAULT false,
  has_thin_content BOOLEAN DEFAULT false,

  crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Technical Issues
CREATE TABLE IF NOT EXISTS public.technical_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id UUID REFERENCES public.technical_crawls(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,

  -- Issue classification
  category TEXT NOT NULL CHECK (category IN (
    'crawlability', 'indexability', 'redirects', 'broken_links',
    'canonicals', 'sitemap', 'robots', 'performance', 'structured_data',
    'duplicates', 'orphan_pages', 'javascript', 'hreflang',
    'security', 'mobile', 'pagination', 'internal_links', 'other'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  issue_type TEXT NOT NULL,      -- machine-readable key e.g. 'broken_internal_link'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT,                 -- specific data supporting the finding

  -- Affected pages
  affected_urls TEXT[],
  affected_url_count INTEGER DEFAULT 0,
  sample_url TEXT,

  -- Impact & effort
  seo_impact TEXT,
  business_impact TEXT,
  recommended_fix TEXT NOT NULL,
  estimated_effort TEXT CHECK (estimated_effort IN ('minutes', 'hours', 'days', 'weeks')),
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  automation_level TEXT DEFAULT 'manual' CHECK (automation_level IN (
    'auto', 'semi_auto', 'manual', 'requires_approval'
  )),

  -- Fix tracking
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'fixed', 'verified', 'failed', 'wont_fix', 'acknowledged'
  )),
  fix_applied_at TIMESTAMPTZ,
  fix_verified_at TIMESTAMPTZ,
  fix_notes TEXT,
  pr_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.technical_crawls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawled_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_issues ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_technical_crawls_website ON public.technical_crawls(website_id);
CREATE INDEX IF NOT EXISTS idx_crawled_urls_crawl ON public.crawled_urls(crawl_id);
CREATE INDEX IF NOT EXISTS idx_crawled_urls_status ON public.crawled_urls(status_code);
CREATE INDEX IF NOT EXISTS idx_technical_issues_crawl ON public.technical_issues(crawl_id);
CREATE INDEX IF NOT EXISTS idx_technical_issues_severity ON public.technical_issues(severity);
CREATE INDEX IF NOT EXISTS idx_technical_issues_status ON public.technical_issues(status);

-- Initial Schema for Autonomous AI SEO Agent

-- Users (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Websites
CREATE TABLE IF NOT EXISTS public.websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  framework TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

-- Connections (OAuth Integrations - Encrypted tokens should be handled at app layer or via Vault)
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'github'
  access_token TEXT,
  refresh_token TEXT,
  provider_account_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Repositories
CREATE TABLE IF NOT EXISTS public.repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'github',
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id)
);

-- Pages
CREATE TABLE IF NOT EXISTS public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  content_hash TEXT,
  canonical_url TEXT,
  status_code INTEGER,
  indexability_signals JSONB, -- { is_indexable: true, reason: 'robots.txt' }
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, path)
);

-- Keywords
CREATE TABLE IF NOT EXISTS public.keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  volume INTEGER,
  difficulty INTEGER,
  intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, term)
);

-- Search Console Data
CREATE TABLE IF NOT EXISTS public.search_console_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  query TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  position NUMERIC DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, page_id, query, date)
);

-- Agent Runs
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  logs JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO Opportunities
CREATE TABLE IF NOT EXISTS public.seo_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  problem TEXT NOT NULL,
  evidence TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  expected_impact TEXT NOT NULL,
  confidence TEXT NOT NULL, -- high, medium, low
  effort TEXT NOT NULL, -- high, medium, low
  risk TEXT NOT NULL, -- high, medium, low
  priority TEXT NOT NULL, -- high, medium, low
  status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval, approved, rejected, implemented
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pull Requests
CREATE TABLE IF NOT EXISTS public.pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.seo_opportunities(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  pr_url TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, merged, closed
  branch_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Changes (Diffs)
CREATE TABLE IF NOT EXISTS public.content_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.seo_opportunities(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  diff_before TEXT NOT NULL,
  diff_after TEXT NOT NULL,
  action_type TEXT NOT NULL, -- update_title, update_meta, etc
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_console_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_changes ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies (for brevity, assuming app uses service role for background tasks, and user role for UI)
-- User can read/write their own data
CREATE POLICY "Users can manage their own websites" ON public.websites FOR ALL USING (auth.uid() = user_id);
-- Other policies would follow the same pattern...

-- Migration: 00017_wordpress_outbound.sql
-- Outbound Reverse-Connection WordPress Architecture (Plugin -> SaaS)

-- 1. Outbound WordPress Sites Registry
CREATE TABLE IF NOT EXISTS public.wordpress_outbound_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  site_name TEXT,
  hmac_secret_hash TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['site:read', 'content:read', 'content:write', 'media:read', 'media:write', 'seo:read'],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'unconfigured')),
  wp_version TEXT,
  php_version TEXT,
  plugin_version TEXT,
  seo_plugins JSONB DEFAULT '{}'::jsonb,
  last_ping_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wp_outbound_sites_website_id ON public.wordpress_outbound_sites(website_id);
CREATE INDEX IF NOT EXISTS idx_wp_outbound_sites_site_url ON public.wordpress_outbound_sites(site_url);

-- 2. WordPress Asynchronous Job Queue
CREATE TABLE IF NOT EXISTS public.wordpress_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.wordpress_outbound_sites(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT,
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error JSONB,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wp_jobs_site_status ON public.wordpress_jobs(site_id, status);
CREATE INDEX IF NOT EXISTS idx_wp_jobs_website_id ON public.wordpress_jobs(website_id);
CREATE INDEX IF NOT EXISTS idx_wp_jobs_idempotency ON public.wordpress_jobs(site_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wp_jobs_created_at ON public.wordpress_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE public.wordpress_outbound_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordpress_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wordpress_outbound_sites' AND policyname = 'Service role full access on wordpress_outbound_sites'
  ) THEN
    CREATE POLICY "Service role full access on wordpress_outbound_sites"
      ON public.wordpress_outbound_sites FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wordpress_jobs' AND policyname = 'Service role full access on wordpress_jobs'
  ) THEN
    CREATE POLICY "Service role full access on wordpress_jobs"
      ON public.wordpress_jobs FOR ALL USING (true);
  END IF;
END $$;

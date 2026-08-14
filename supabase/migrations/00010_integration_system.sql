-- Migration: Integration System

-- 1. Integrations table — one row per connected service per website
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,

  -- Provider identity
  provider TEXT NOT NULL CHECK (provider IN (
    'google_search_console', 'google_analytics', 'dataforseo',
    'wordpress', 'github', 'crawler', 'webflow', 'shopify',
    'gitlab', 'ghost', 'contentful', 'sanity', 'wix', 'custom'
  )),

  -- Display
  display_name TEXT,
  icon_url TEXT,

  -- Connection config (non-sensitive, safe to query)
  config JSONB DEFAULT '{}',
  -- Examples:
  --   GSC:     { "property_url": "https://example.com/" }
  --   GA4:     { "property_id": "123456789", "measurement_id": "G-XXX" }
  --   GitHub:  { "owner": "acme", "repo": "website", "branch": "main", "framework": "nextjs" }
  --   WP:      { "site_url": "https://example.com", "seo_plugin": "yoast" }
  --   DFS:     { "login": "user@email.com" }

  -- Capabilities (what this integration can do)
  capabilities TEXT[] DEFAULT '{}',

  -- Health
  status TEXT DEFAULT 'disconnected' CHECK (status IN (
    'connected', 'action_required', 'error', 'disconnected', 'testing'
  )),
  status_message TEXT,
  last_tested_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  error_code TEXT,
  error_detail TEXT,

  -- OAuth / token metadata (NOT storing raw tokens here — use vault or env)
  has_access_token BOOLEAN DEFAULT false,
  has_refresh_token BOOLEAN DEFAULT false,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',

  -- Timestamps
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(website_id, provider)
);

-- 2. Secure credential store (access tokens stored here, never in plain config)
-- In production: replace with a secrets manager (Vault, AWS Secrets, etc.)
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN (
    'access_token', 'refresh_token', 'api_key', 'app_password', 'webhook_secret'
  )),
  -- In production: encrypt this column at rest (pgcrypto or app-level AES)
  encrypted_value TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, credential_type)
);

-- 3. Capability definitions
CREATE TABLE IF NOT EXISTS public.integration_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  -- e.g. READ_CONTENT, CREATE_DRAFT, UPDATE_METADATA, PUBLISH_CONTENT, CREATE_PULL_REQUEST
  is_available BOOLEAN DEFAULT true,
  unavailable_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, capability)
);

-- 4. Integration usage + cost tracking
CREATE TABLE IF NOT EXISTS public.integration_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  agent_type TEXT,
  request_payload_size_bytes INTEGER,
  response_size_bytes INTEGER,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_code TEXT,
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Pending execution actions (agent proposes → human approves → connector executes)
CREATE TABLE IF NOT EXISTS public.execution_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,

  -- What to do
  action_type TEXT NOT NULL,
  -- Platform-agnostic: update_title, update_meta_description, create_article,
  -- update_schema, add_internal_link, add_image, publish_article, etc.

  action_payload JSONB NOT NULL DEFAULT '{}',

  -- Which agent proposed this
  proposed_by TEXT,
  proposed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Execution platform resolved at proposal time
  connector TEXT,  -- 'wordpress' | 'github'
  connector_detail JSONB DEFAULT '{}',
  -- e.g. { "file_path": "src/app/blog/post.tsx", "branch": "seo/update-title-2026-08" }

  -- Human approval
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN (
    'pending', 'approved', 'rejected', 'auto_approved'
  )),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Execution state
  execution_status TEXT DEFAULT 'waiting' CHECK (execution_status IN (
    'waiting', 'executing', 'executed', 'failed', 'verified', 'verification_failed', 'rolled_back'
  )),
  executed_at TIMESTAMPTZ,
  pr_url TEXT,
  pr_number INTEGER,
  wp_post_id INTEGER,
  execution_error TEXT,

  -- Verification
  verified_at TIMESTAMPTZ,
  verification_result JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_actions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integrations_website ON public.integrations(website_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_integration ON public.integration_credentials(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_usage_website ON public.integration_usage(website_id);
CREATE INDEX IF NOT EXISTS idx_integration_usage_provider ON public.integration_usage(provider);
CREATE INDEX IF NOT EXISTS idx_execution_actions_website ON public.execution_actions(website_id);
CREATE INDEX IF NOT EXISTS idx_execution_actions_approval ON public.execution_actions(approval_status);

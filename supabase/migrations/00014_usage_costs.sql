-- Migration 00014: Usage Events + API Provider Configs

-- ─────────────────────────────────────────────
-- 1. API PROVIDER CONFIGS (admin-managed pricing)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_price_per_1k NUMERIC(10,8) NOT NULL DEFAULT 0,
  output_price_per_1k NUMERIC(10,8) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, model)
);

-- Seed with current known pricing (update as needed)
INSERT INTO public.api_provider_configs (provider, model, input_price_per_1k, output_price_per_1k, notes) VALUES
  ('openai', 'gpt-4o', 0.005, 0.015, 'GPT-4o pricing per 1K tokens'),
  ('openai', 'gpt-4o-mini', 0.00015, 0.0006, 'GPT-4o Mini pricing per 1K tokens'),
  ('anthropic', 'claude-3-5-sonnet-20240620', 0.003, 0.015, 'Claude 3.5 Sonnet pricing per 1K tokens'),
  ('anthropic', 'claude-3-haiku-20240307', 0.00025, 0.00125, 'Claude Haiku pricing per 1K tokens'),
  ('dataforseo', 'serp_api', 0, 0, 'DataForSEO billed per API call'),
  ('openai', 'dall-e-3', 0, 0.04, 'DALL-E 3 per image (output_price = per image)')
ON CONFLICT (provider, model) DO NOTHING;

-- Only admins can modify pricing configs
ALTER TABLE public.api_provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read provider configs"
  ON public.api_provider_configs FOR SELECT
  USING (true);

-- Admin-only update: enforced at app layer via requireAdmin()

-- ─────────────────────────────────────────────
-- 2. USAGE EVENTS — source of truth for all API costs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_execution_id UUID REFERENCES public.task_executions(id) ON DELETE SET NULL,
  agent_execution_id UUID REFERENCES public.agent_executions(id) ON DELETE SET NULL,

  -- What was called
  provider TEXT NOT NULL,       -- openai | anthropic | dataforseo | stability
  model TEXT NOT NULL,          -- gpt-4o | claude-3-5-sonnet | serp_api | etc.
  api_type TEXT NOT NULL,       -- llm | image | search | crawl | scrape | other
  agent_type TEXT,              -- which SEO agent triggered this

  -- Token usage
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- External units (for non-token APIs)
  api_calls INTEGER DEFAULT 1,
  external_units NUMERIC DEFAULT 0,
  -- e.g. DataForSEO results count

  -- Cost
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Critical indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_project_id ON public.usage_events(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_task_id ON public.usage_events(task_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_provider ON public.usage_events(provider);
CREATE INDEX IF NOT EXISTS idx_usage_events_model ON public.usage_events(model);
CREATE INDEX IF NOT EXISTS idx_usage_events_agent_type ON public.usage_events(agent_type);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users view own usage events"
  ON public.usage_events FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (used by backend agents)
CREATE POLICY "Service role insert usage"
  ON public.usage_events FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 3. USAGE LIMITS PER USER/PROJECT
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  monthly_credit_limit NUMERIC(10,2) DEFAULT 50.00,  -- USD
  monthly_api_call_limit INTEGER DEFAULT 10000,
  monthly_task_limit INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  reset_day INTEGER DEFAULT 1 CHECK (reset_day BETWEEN 1 AND 28),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage limits"
  ON public.usage_limits FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4. MONTHLY USAGE SUMMARY VIEW
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.monthly_usage_summary AS
SELECT
  user_id,
  project_id,
  DATE_TRUNC('month', created_at) AS month,
  SUM(estimated_cost) AS total_cost,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(api_calls) AS total_api_calls,
  COUNT(*) AS total_events,
  provider,
  model,
  agent_type
FROM public.usage_events
GROUP BY user_id, project_id, month, provider, model, agent_type;

-- Migration 00012: Auth Foundation
-- Enhances users table and adds the Projects layer

-- ─────────────────────────────────────────────
-- 1. ENHANCE USERS TABLE
-- ─────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Index for fast email lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ─────────────────────────────────────────────
-- 2. AUTO-PROVISION USER ROW ON SIGNUP
-- ─────────────────────────────────────────────
-- When a user signs up via Supabase Auth, automatically create their public.users row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'user',
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update last_login_at on sign-in
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET last_login_at = NOW(), updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_login();

-- ─────────────────────────────────────────────
-- 3. PROJECTS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Users can only access their own projects
CREATE POLICY "Users manage own projects"
  ON public.projects FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4. LINK WEBSITES TO PROJECTS
-- ─────────────────────────────────────────────
ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'other' CHECK (platform IN ('wordpress', 'custom_saas', 'shopify', 'nextjs', 'other')),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived'));

CREATE INDEX IF NOT EXISTS idx_websites_project_id ON public.websites(project_id);

-- ─────────────────────────────────────────────
-- 5. GOALS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  target TEXT,
  start_date DATE,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_project_id ON public.goals(project_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals"
  ON public.goals FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 6. RLS POLICY FOR USERS TABLE
-- ─────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

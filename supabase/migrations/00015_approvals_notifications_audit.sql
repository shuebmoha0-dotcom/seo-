-- Migration 00015: Approvals, Notifications, Audit Logs

-- ─────────────────────────────────────────────
-- 1. APPROVALS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_execution_id UUID REFERENCES public.task_executions(id) ON DELETE SET NULL,

  type TEXT NOT NULL,
  -- e.g. 'publish_article', 'update_metadata', 'create_backlink_outreach',
  --       'deploy_code_change', 'content_package'

  title TEXT NOT NULL,
  description TEXT,
  payload JSONB DEFAULT '{}',
  -- The full data of what the agent wants to execute

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'expired'
  )),

  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_user_id ON public.approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_project_id ON public.approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_at ON public.approvals(requested_at DESC);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own approvals"
  ON public.approvals FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. NOTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  type TEXT NOT NULL,
  -- e.g. 'approval_required', 'task_completed', 'task_failed',
  --       'usage_limit_warning', 'report_ready', 'competitor_alert'

  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  -- Deep link e.g. /autopilot?approval=<id>

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. AUDIT LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  action TEXT NOT NULL,
  -- e.g. 'user.login', 'task.created', 'task.paused', 'task.executed',
  --       'approval.granted', 'approval.rejected', 'article.published',
  --       'integration.connected', 'integration.disconnected'

  resource_type TEXT,
  -- e.g. 'task', 'approval', 'content_draft', 'integration', 'user'

  resource_id UUID,

  metadata JSONB DEFAULT '{}',
  -- Additional structured context

  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON public.audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit logs; server inserts via service role
CREATE POLICY "Users read own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 4. HELPER FUNCTION: Unread notifications count
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE user_id = p_user_id AND read = false;
$$;

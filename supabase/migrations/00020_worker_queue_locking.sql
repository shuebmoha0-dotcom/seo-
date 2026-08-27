-- Migration 00020: Worker Queue Locking & Lease Mechanics

-- 1. Extend task_executions with concurrency, locking, and recovery columns
ALTER TABLE public.task_executions
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_payload JSONB DEFAULT '{}';

-- 2. Ensure status constraint supports 'retrying'
DO $$
BEGIN
  ALTER TABLE public.task_executions DROP CONSTRAINT IF EXISTS task_executions_status_check;
  ALTER TABLE public.task_executions ADD CONSTRAINT task_executions_status_check
    CHECK (status IN ('queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled', 'retrying'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. Indexes for queue performance
CREATE INDEX IF NOT EXISTS idx_task_executions_queue
  ON public.task_executions (status, next_retry_at, heartbeat_at);

CREATE INDEX IF NOT EXISTS idx_task_executions_heartbeat
  ON public.task_executions (heartbeat_at)
  WHERE status = 'running';

-- 4. Atomic Job Claiming Function (PostgreSQL FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_next_task_execution(
  p_worker_id TEXT,
  p_lease_duration_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.task_executions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_execution public.task_executions;
  v_stale_threshold TIMESTAMPTZ;
BEGIN
  v_stale_threshold := NOW() - (p_lease_duration_seconds || ' seconds')::INTERVAL;

  -- Atomically find and lock the highest priority pending / retrying / stale job
  SELECT * INTO v_execution
  FROM public.task_executions
  WHERE (
    -- Normal queued jobs
    status = 'queued'
    -- Retrying jobs whose backoff timer has elapsed
    OR (status = 'retrying' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
    -- Crashed/abandoned jobs whose worker lease has expired
    OR (status = 'running' AND (heartbeat_at IS NULL OR heartbeat_at < v_stale_threshold))
  )
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  -- If a job was claimed, transition to running and assign lease
  IF FOUND THEN
    UPDATE public.task_executions
    SET
      status = 'running',
      locked_by = p_worker_id,
      locked_at = NOW(),
      heartbeat_at = NOW(),
      started_at = COALESCE(started_at, NOW()),
      error = NULL
    WHERE id = v_execution.id
    RETURNING * INTO v_execution;

    RETURN NEXT v_execution;
  END IF;

  RETURN;
END;
$$;

-- 5. Helper function to renew lease heartbeat
CREATE OR REPLACE FUNCTION public.renew_task_execution_heartbeat(
  p_execution_id UUID,
  p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.task_executions
  SET heartbeat_at = NOW()
  WHERE id = p_execution_id AND locked_by = p_worker_id AND status = 'running';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

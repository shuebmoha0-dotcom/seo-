-- Add website_id to usage_events
ALTER TABLE public.usage_events 
ADD COLUMN IF NOT EXISTS website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_events_website_id ON public.usage_events(website_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events(created_at);

-- Backfill legacy events with the owner's user_id, project_id, and website_id
UPDATE public.usage_events
SET 
  user_id = '0a035c76-db28-4071-9294-db59ca23d1a5',
  project_id = '37e402e1-ab72-4b81-8397-a4b81a0009c6',
  website_id = '64fd88be-8292-4389-9a4e-83bb032e9d50'
WHERE user_id IS NULL;

-- Update RLS SELECT policy to support website_id ownership
DROP POLICY IF EXISTS "Users view own usage events" ON public.usage_events;

CREATE POLICY "Users view own usage events" ON public.usage_events
FOR SELECT
TO public
USING (
  auth.uid() = user_id 
  OR 
  website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid())
);

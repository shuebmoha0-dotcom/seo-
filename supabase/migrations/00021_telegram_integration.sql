-- Migration 00021: Telegram Integration for Mobile Control

CREATE TABLE IF NOT EXISTS public.telegram_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  is_active BOOLEAN DEFAULT true,
  paired_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(website_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_website ON public.telegram_subscribers(website_id);
CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_chat ON public.telegram_subscribers(chat_id);

ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on telegram_subscribers"
  ON public.telegram_subscribers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own website telegram subscribers"
  ON public.telegram_subscribers FOR SELECT
  TO authenticated
  USING (
    website_id IN (
      SELECT id FROM public.websites WHERE user_id = auth.uid()
    )
  );

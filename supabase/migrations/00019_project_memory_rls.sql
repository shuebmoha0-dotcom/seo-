-- Fix missing RLS policies for project memory tables
CREATE POLICY "Users manage project memory for their websites" ON public.project_memory FOR ALL USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users manage memory activity for their websites" ON public.memory_activity FOR ALL USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

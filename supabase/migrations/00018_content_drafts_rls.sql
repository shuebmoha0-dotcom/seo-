-- Fix missing RLS policies for content generation tables
CREATE POLICY "Users manage rules for their websites" ON public.content_rules FOR ALL USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users manage drafts for their websites" ON public.content_drafts FOR ALL USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users manage versions for their websites" ON public.content_versions FOR ALL USING (draft_id IN (SELECT id FROM public.content_drafts WHERE website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid())));

CREATE POLICY "Users manage qa for their websites" ON public.content_qa_results FOR ALL USING (draft_id IN (SELECT id FROM public.content_drafts WHERE website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid())));

CREATE POLICY "Users manage images for their websites" ON public.content_images FOR ALL USING (draft_id IN (SELECT id FROM public.content_drafts WHERE website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid())));

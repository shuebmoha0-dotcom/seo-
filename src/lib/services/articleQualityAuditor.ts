import { createAdminClient } from '@/lib/supabase/admin';
import { ContentPresentationAuditor } from '@/lib/crawler/contentPresentationAuditor';
import { markdownToWordPressHtml } from '@/lib/utils/markdownToHtml';
import { createWordPressJob } from '@/lib/connectors/wordpressOutbound';

export interface CleanReportItem {
  draft_id: string;
  website_id: string;
  title: string;
  slug: string;
  wordpress_post_id?: number;
  wordpress_post_url?: string;
  issues_found: string[];
  repaired_in_db: boolean;
  dispatched_to_wordpress: boolean;
}

export interface ArticleAuditScanResult {
  total_scanned: number;
  total_cleaned: number;
  wordpress_updates_dispatched: number;
  items: CleanReportItem[];
}

export class ArticleQualityAuditor {
  /**
   * Scans all articles and drafts across websites to detect and instantly auto-heal:
   * 1. Naked Schema.org JSON blobs or corrupted <script> tags rendered as visible text.
   * 2. AI preambles, conversational notes ("Certainly! Here is...", "As an AI..."), or reflection tags.
   * 3. Markdown code wrappers or unparsed syntax.
   * 
   * Synchronously repairs the database draft and dispatches WordPress update jobs to clean live posts immediately.
   */
  static async scanAndCleanAllArticles(options?: {
    websiteId?: string;
    customClient?: any;
  }): Promise<ArticleAuditScanResult> {
    const supabase = options?.customClient || createAdminClient();

    let query = supabase
      .from('content_drafts')
      .select('id, website_id, working_title, url_slug, status, content_body, revision_notes')
      .order('updated_at', { ascending: false });

    if (options?.websiteId) {
      query = query.eq('website_id', options.websiteId);
    }

    const { data: drafts, error } = await query;
    if (error || !drafts) {
      console.error('[ArticleQualityAuditor] Failed to fetch drafts:', error);
      return { total_scanned: 0, total_cleaned: 0, wordpress_updates_dispatched: 0, items: [] };
    }

    const items: CleanReportItem[] = [];
    let wordpressUpdatesDispatched = 0;

    for (const draft of drafts) {
      const rawBody = draft.content_body || '';
      const issuesFound: string[] = [];

      // Detect issues
      const hasRawSchema = /schema\.org|@context|application\/ld\+json/i.test(rawBody);
      const hasAiPreamble = /^(?:Here is|Certainly!? Here is|Below is|I have written|Sure, here's)[\s\S]*?(?:article|guide|breakdown|post)/im.test(rawBody);
      const hasThinkingTags = /<(?:thinking|reflection)>/i.test(rawBody);
      const hasCodeFences = /^```(?:markdown|html)?\s*\n/i.test(rawBody);

      if (hasRawSchema) issuesFound.push('Naked Schema.org JSON-LD in body');
      if (hasAiPreamble) issuesFound.push('Conversational AI preamble');
      if (hasThinkingTags) issuesFound.push('Thinking / reflection tags');
      if (hasCodeFences) issuesFound.push('Markdown code block wrapper');

      // Check if the live WordPress post needs cleaning even if rawBody in DB was clean
      let wpPostId: number | undefined;
      let wpPostUrl: string | undefined;

      if (draft.revision_notes) {
        try {
          const notes = typeof draft.revision_notes === 'string'
            ? JSON.parse(draft.revision_notes)
            : draft.revision_notes;
          if (notes?.wordpress_post_id) wpPostId = Number(notes.wordpress_post_id);
          if (notes?.wordpress_post_url) wpPostUrl = notes.wordpress_post_url;
        } catch (_) {}
      }

      // If draft is published on WordPress or dirty in DB, clean it
      const isDirty = issuesFound.length > 0;
      let repairedInDb = false;
      let dispatchedToWp = false;

      let cleanBody = rawBody;

      if (isDirty) {
        // 1. Strip naked schema
        cleanBody = cleanBody.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
        cleanBody = cleanBody.replace(/<!--\s*wp:html\s*-->[\s\S]*?(?:application\/ld\+json|schema\.org)[\s\S]*?<!--\s*\/wp:html\s*-->/gi, '');
        cleanBody = cleanBody.replace(/(?:\{|%7B|&quot;\{|“\{|”\{)\s*["“@]?context["”]?\s*:\s*["“]?https?:\\?\/\\?\/schema\.org[\s\S]*?(?:\}\s*\}|\}\s*\]\s*\}|\}\s*\]\s*\}\s*\})/gi, '');
        
        // 2. Strip AI preambles & meta comments
        cleanBody = cleanBody.replace(/^(?:Here is|Certainly!? Here is|Below is|I have written|Sure, here's)[\s\S]*?(?:article|guide|breakdown|post)[\s\S]*?\n+/im, '');
        cleanBody = cleanBody.replace(/<(?:thinking|reflection)>[\s\S]*?<\/(?:thinking|reflection)>/gi, '');
        cleanBody = cleanBody.replace(/^(?:\*\*|\*)?(?:Note|Notice|Editor's Note|AI Disclaimer)(?:\*\*|\*)?\s*:.*$/gmi, '');
        cleanBody = cleanBody.replace(/^```(?:markdown|html)?\s*\n/i, '');
        cleanBody = cleanBody.replace(/\n```\s*$/i, '');
        cleanBody = cleanBody.trim();

        const { error: updateErr } = await supabase
          .from('content_drafts')
          .update({
            content_body: cleanBody,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.id);

        if (!updateErr) {
          repairedInDb = true;
        }
      }

      // If published to WordPress, dispatch an update_post job with pristine HTML
      if (draft.status === 'published' && (wpPostId || draft.url_slug)) {
        try {
          const rawWpHtml = markdownToWordPressHtml(cleanBody);
          const { repairedHtml } = ContentPresentationAuditor.autoRepairHtml(rawWpHtml);

          const { job, error: jobErr } = await createWordPressJob({
            websiteId: draft.website_id,
            jobType: 'update_post',
            payload: {
              ...(wpPostId ? { post_id: wpPostId, id: wpPostId } : {}),
              slug: draft.url_slug,
              title: draft.working_title,
              content: repairedHtml,
            },
            client: supabase,
          });

          if (job && !jobErr) {
            dispatchedToWp = true;
            wordpressUpdatesDispatched++;
          }
        } catch (wpErr) {
          console.error(`[ArticleQualityAuditor] Failed to dispatch WP update for ${draft.url_slug}:`, wpErr);
        }
      }

      if (isDirty || dispatchedToWp) {
        items.push({
          draft_id: draft.id,
          website_id: draft.website_id,
          title: draft.working_title || 'Untitled Article',
          slug: draft.url_slug,
          wordpress_post_id: wpPostId,
          wordpress_post_url: wpPostUrl,
          issues_found: issuesFound.length > 0 ? issuesFound : ['Live post schema tag cleanup'],
          repaired_in_db: repairedInDb,
          dispatched_to_wordpress: dispatchedToWp,
        });
      }
    }

    return {
      total_scanned: drafts.length,
      total_cleaned: items.length,
      wordpress_updates_dispatched: wordpressUpdatesDispatched,
      items,
    };
  }
}

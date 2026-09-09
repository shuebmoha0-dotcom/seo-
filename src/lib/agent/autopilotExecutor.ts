import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ContentAgent } from './contentAgent';
import { KeywordAgent } from './keywordAgent';
import { ScheduleAgent } from './scheduleAgent';
import { CrawlService } from '../crawler/crawlService';
import { ParsedAutopilotInstruction } from './autopilotNLParser';

export interface AutopilotExecutionResult {
  success: boolean;
  intent_type: 'immediate_action' | 'recurring_schedule';
  action_type: string;
  summary: string;
  link_url?: string;
  link_label?: string;
  data?: any;
  error?: string;
}

function safeBackground(fn: () => Promise<void>) {
  setImmediate(async () => {
    try {
      await fn();
    } catch (err: any) {
      console.error('[Autopilot Executor Background Error]:', err?.message || err);
    }
  });
}

export class AutopilotExecutor {
  /**
   * Dispatches and executes an immediate natural language SEO action
   */
  async executeImmediateAction(params: {
    instruction: ParsedAutopilotInstruction;
    website_id: string;
    website_domain: string;
    website_url?: string;
    project_id?: string;
    user_id?: string;
  }): Promise<AutopilotExecutionResult> {
    const { instruction, website_id, website_domain } = params;
    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    try {
      // ── ACTION: WRITE ARTICLE ─────────────────────────────────────────
      if (instruction.action_type === 'write_article') {
        const topic = instruction.topic || instruction.goal.replace(/^(write|draft|create|generate)\s+(an?\s+)?(article|post|blog|content)\s*(about|on)?\s*/i, '').trim();
        const primaryKeyword = topic || `${website_domain.split('.')[0]} strategy`;
        const workingTitle = topic.length > 5 ? topic : `Guide to ${primaryKeyword}`;

        // 1. Create a draft record in Supabase immediately
        const { data: newDraft } = await supabase
          .from('content_drafts')
          .insert({
            website_id,
            working_title: `Writing: "${workingTitle}"...`,
            primary_keyword: primaryKeyword,
            secondary_keywords: [],
            search_intent: 'informational',
            content_type: 'blog_article',
            target_audience: `Audience interested in ${primaryKeyword}`,
            status: 'writing',
            current_version: 1,
          })
          .select()
          .single();

        const draftId = newDraft?.id;

        // 2. Run the full drafting pipeline via Claude Sonnet 5 in the background
        safeBackground(async () => {
          try {
            console.log(`[AutopilotExecutor] Running ContentAgent for "${workingTitle}" on ${website_domain}...`);
            const contentAgent = new ContentAgent();
            const output = await contentAgent.runFullPipeline({
              website_id,
              primary_keyword: primaryKeyword,
              secondary_keywords: [],
              search_intent: 'informational',
              content_type: 'blog_article',
              target_audience: `Readers looking for actionable ${primaryKeyword}`,
              working_title: workingTitle,
              rules: {
                word_count_min: 1200,
                word_count_max: 1600,
                language: 'U.S. English',
                tone: 'Authoritative, practical, practitioner-first',
                audience: `Readers and searchers exploring ${primaryKeyword}`,
                author_style: 'Experienced technical consultant and industry specialist',
                structure_rules: 'Use H2 and H3 headings. Clean table of contents.',
                paragraph_style: 'Clear, concise, scannable paragraphs.',
                image_rules: 'Include relevant visual diagram or hero image.',
                source_rules: 'Verify factual claims.',
                brand_rules: 'Do not make unsupported marketing claims.',
                cta_rules: 'Include one clear contextual next step.',
                avoid_rules: 'No keyword stuffing. No fluff or repetitive filler.',
              }
            });

            if (draftId) {
              await supabase
                .from('content_drafts')
                .update({
                  working_title: output.working_title,
                  h1: output.content_body.match(/^# (.+)$/m)?.[1] || output.working_title,
                  content_body: output.content_body,
                  word_count: output.word_count,
                  reading_time_minutes: output.reading_time_minutes,
                  seo_title: output.seo_title,
                  meta_description: output.meta_description,
                  url_slug: output.url_slug,
                  status: 'ready_for_approval',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', draftId);

              try {
                await supabase.from('content_versions').insert({
                  draft_id: draftId,
                  version_number: 1,
                  content_body: output.content_body,
                  word_count: output.word_count,
                  status: 'ready_for_approval',
                  qa_results: output.qa,
                });
              } catch {}
            }

            console.log(`[AutopilotExecutor] Draft generated successfully for "${workingTitle}"!`);
          } catch (err: any) {
            console.error('[AutopilotExecutor] Draft generation failed:', err?.message || err);
            if (draftId) {
              await supabase
                .from('content_drafts')
                .update({ status: 'failed', revision_notes: err?.message })
                .eq('id', draftId);
            }
          }
        });

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'write_article',
          summary: `Writing article draft for "${workingTitle}". Drafting is running autonomously using Claude Sonnet 5.`,
          link_url: '/content-planner',
          link_label: 'View in Content Planner',
          data: { draft_id: draftId, topic: workingTitle }
        };
      }

      // ── ACTION: KEYWORD RESEARCH ──────────────────────────────────────
      if (instruction.action_type === 'keyword_research') {
        const seedTopic = instruction.topic || undefined;
        console.log(`[AutopilotExecutor] Running KeywordAgent for "${website_domain}" with seed "${seedTopic || 'none'}"...`);

        const keywordAgent = new KeywordAgent();
        const { clusters, opportunities } = await keywordAgent.discoverOpportunities({
          domain: website_domain,
          seedTopic,
          mode: 'new'
        });

        // Save clusters to DB
        let savedCount = 0;
        for (const c of clusters) {
          try {
            const { data: clRow } = await supabase
              .from('keyword_clusters')
              .insert({
                website_id,
                cluster_name: c.name,
                primary_keyword: c.primary_keyword,
                secondary_keywords: c.secondary_keywords,
                search_intent: c.search_intent,
                recommended_content_type: c.recommended_content_type,
                status: 'discovered',
              })
              .select('id')
              .single();

            const clusterId = clRow?.id;
            savedCount++;

            for (const op of c.opportunities) {
              await supabase.from('keyword_opportunities').insert({
                website_id,
                cluster_id: clusterId || null,
                keyword: op.keyword,
                is_primary: op.is_primary,
                search_intent: op.search_intent,
                content_type: op.content_type,
                search_volume: op.search_volume,
                keyword_difficulty: op.keyword_difficulty,
                business_relevance: op.business_relevance,
                competition: op.competition,
                recommended_action: op.recommended_action,
                priority: op.priority,
                confidence: op.confidence,
                evidence: op.evidence,
                status: 'pending',
              });

              await supabase.from('keywords').upsert({
                website_id,
                term: op.keyword,
                intent: op.search_intent,
                difficulty: op.keyword_difficulty ? String(op.keyword_difficulty) : op.competition,
                volume: op.search_volume || 0,
              }, { onConflict: 'website_id,term' });
            }
          } catch (clErr) {
            console.warn('[AutopilotExecutor] Cluster insert warning:', clErr);
          }
        }

        // Cache fallback in project_memory
        try {
          await supabase.from('project_memory').insert({
            website_id,
            source: 'cached_keyword_clusters',
            category: 'keyword_research',
            content: JSON.stringify({ clusters, opportunities }),
            is_outdated: false,
          });
        } catch {}

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'keyword_research',
          summary: `Discovered ${clusters.length} high-converting topical clusters and ${opportunities.length} keyword opportunities for ${website_domain}.`,
          link_url: '/keywords',
          link_label: 'View Discovered Keywords',
          data: { clusters_count: clusters.length, opportunities_count: opportunities.length }
        };
      }

      // ── ACTION: TECHNICAL AUDIT / CRAWL ───────────────────────────────
      if (instruction.action_type === 'technical_audit') {
        const crawlService = new CrawlService();
        const targetUrl = instruction.target_url || params.website_url || `https://${website_domain}`;

        safeBackground(async () => {
          try {
            await crawlService.getOrAnalyzeWebsite({
              websiteId: website_id,
              projectId: params.project_id,
              targetUrl,
              siteTech: 'unknown',
              maxPages: 20,
              maxDepth: 3,
              forceFresh: true,
            });
          } catch (crawlErr) {
            console.warn('[AutopilotExecutor] Tech crawl warning:', crawlErr);
          }
        });

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'technical_audit',
          summary: `Technical SEO crawler launched for ${website_domain}. Crawling and indexing signals in background.`,
          link_url: '/technical-seo',
          link_label: 'View Technical SEO Health',
          data: { target_url: targetUrl }
        };
      }

      // ── ACTION: GENERAL OPTIMIZATION / RUN ALL ────────────────────────
      const scheduleAgent = new ScheduleAgent();
      const targetUrl = instruction.target_url || params.website_url || `https://${website_domain}`;

      const runResult = await scheduleAgent.executeRun({
        website_id,
        website_url: targetUrl,
        trigger_type: 'manual_run_now',
        config: {
          website_id,
          frequency: 'daily',
          schedule_time: '09:00',
          timezone: 'UTC',
          status: 'active',
          daily_budget_usd: 10,
          monthly_budget_usd: 100,
          current_daily_spend_usd: 0,
          current_monthly_spend_usd: 0,
          max_tasks_per_run: 5,
          max_crawl_urls: 20,
          notify_on_run_complete: true,
          notify_on_opportunity: true,
          notify_on_approval_required: true,
          notify_on_technical_error: false,
          notify_on_failure: true,
        }
      });

      return {
        success: true,
        intent_type: 'immediate_action',
        action_type: 'general_optimization',
        summary: runResult.summary || `Autonomous optimization completed for ${website_domain}.`,
        link_url: '/dashboard',
        link_label: 'View Dashboard Stats',
        data: runResult
      };

    } catch (err: any) {
      console.error('[AutopilotExecutor] Execution error:', err);
      return {
        success: false,
        intent_type: 'immediate_action',
        action_type: instruction.action_type,
        summary: `Action failed: ${err?.message || 'Unknown error'}`,
        error: err?.message || 'Execution failed'
      };
    }
  }
}

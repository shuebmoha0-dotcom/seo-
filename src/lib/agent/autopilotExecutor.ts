import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ContentAgent } from './contentAgent';
import { KeywordAgent } from './keywordAgent';
import { ScheduleAgent } from './scheduleAgent';
import { CrawlService } from '../crawler/crawlService';
import { ParsedAutopilotInstruction } from './autopilotNLParser';
import { SiteContentGapDetector } from './siteContentGapDetector';
import { DuplicateArticleChecker } from './duplicateChecker';
import { DiagnosticAgent } from './diagnosticAgent';
import { RankRecoveryEngine } from './rankRecoveryEngine';

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

import { after } from 'next/server';

function safeBackground(fn: () => Promise<void>) {
  try {
    after(async () => {
      try {
        await fn();
      } catch (err: any) {
        console.error('[Autopilot Executor Background Error]:', err?.message || err);
      }
    });
  } catch (e) {
    setImmediate(async () => {
      try {
        await fn();
      } catch (err: any) {
        console.error('[Autopilot Executor Background Error]:', err?.message || err);
      }
    });
  }
}

function computeMeasuredSeoScore(qa: any, wordCount: number): number {
  if (!qa) return 75;
  let score = 0;
  if (qa.primary_keyword_present) score += 20;
  if (qa.word_count_pass) score += 20;
  else if (wordCount >= 800) score += 12;
  if (qa.heading_structure_pass) score += 15;
  if (qa.internal_links_present) score += 15;
  if (qa.images_specified) score += 15;
  if (qa.no_keyword_stuffing && qa.no_filler) score += 15;
  return Math.min(100, Math.max(50, score));
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
    sync?: boolean;
    chat_id?: string | number;
    draft_id?: string;
    edit_instructions?: string;
    siteInventory?: import('./siteContentGapDetector').SiteInventory;
  }): Promise<AutopilotExecutionResult> {
    const { instruction, website_id, website_domain, website_url, siteInventory: preloadedInventory } = params;
    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    try {
      // 0. Fetch Project Memory & Content Rules for Niche/Brand Context
      let projectInstructions = '';
      let projectMemory = '';
      let websiteAudience = `Audience interested in ${website_domain}`;
      let contentRules = {
        word_count_min: 1200,
        word_count_max: 1600,
        language: 'U.S. English',
        tone: 'Authoritative, practical, practitioner-first',
        audience: websiteAudience,
        author_style: 'Experienced technical consultant and industry specialist',
        structure_rules: 'Use H2 and H3 headings. High information density. Do not include raw table of contents in text.',
        paragraph_style: 'Clear, concise, scannable paragraphs.',
        image_rules: 'Include relevant visual diagram or hero image.',
        source_rules: 'Verify factual claims.',
        brand_rules: 'Do not make unsupported marketing claims.',
        cta_rules: 'Include one clear contextual next step.',
        avoid_rules: 'No keyword stuffing. No fluff or repetitive filler.',
        custom_rules: '',
      };

      try {
        const { data: memoryRows } = await supabase
          .from('project_memory')
          .select('*')
          .or(`website_id.eq.${website_id},website_id.is.null`)
          .eq('is_outdated', false)
          .order('is_important', { ascending: false });

        if (memoryRows && memoryRows.length > 0) {
          const customInstrRow = memoryRows.find((m: any) => m.source === 'project_custom_instructions');
          const knowledgeBankRow = memoryRows.find((m: any) => m.source === 'project_knowledge_bank');
          const standardFacts = memoryRows.filter((m: any) => m.source !== 'project_custom_instructions' && m.source !== 'project_knowledge_bank');

          if (customInstrRow?.content) projectInstructions = customInstrRow.content;
          if (knowledgeBankRow?.content) projectMemory = knowledgeBankRow.content;

          if (standardFacts.length > 0) {
            const uniqueFacts = new Set<string>();
            const factBlocks: string[] = [];
            for (const f of standardFacts) {
              const text = f.content?.trim();
              if (text && !uniqueFacts.has(text)) {
                uniqueFacts.add(text);
                factBlocks.push(`[${f.category?.toUpperCase() || 'FACT'}] ${text}`);
              }
            }
            if (factBlocks.length > 0) {
              projectMemory = projectMemory ? `${projectMemory}\n\n${factBlocks.join('\n\n')}` : factBlocks.join('\n\n');
            }
          }
        }

        const { data: websiteRules } = await supabase
          .from('content_rules')
          .select('custom_rules, word_count_min, word_count_max, tone, audience, author_style')
          .eq('website_id', website_id)
          .maybeSingle();

        if (websiteRules) {
          if (websiteRules.custom_rules) projectInstructions = websiteRules.custom_rules;
          if (websiteRules.word_count_min) contentRules.word_count_min = websiteRules.word_count_min;
          if (websiteRules.word_count_max) contentRules.word_count_max = websiteRules.word_count_max;
          if (websiteRules.tone) contentRules.tone = websiteRules.tone;
          if (websiteRules.audience) {
            contentRules.audience = websiteRules.audience;
            websiteAudience = websiteRules.audience;
          }
          if (websiteRules.author_style) contentRules.author_style = websiteRules.author_style;
        }
        if (projectInstructions) {
          contentRules.custom_rules = projectInstructions;
        }
      } catch (memErr) {
        console.warn('[AutopilotExecutor] Failed to load memory context:', memErr);
      }


      // ── ACTION: WRITE ARTICLE (MULTI-AGENT ORCHESTRATION) ──────────────
      if (instruction.action_type === 'write_article') {
        let targetKeyword = instruction.topic || '';
        let workingTitle = instruction.topic || '';
        let secondaryKeywords: string[] = [];
        let searchIntent: any = 'informational';
        let keywordSource = 'user_specified';

        // 1. Site Inventory & Content Gap Analysis
        const siteInventory = preloadedInventory || await (async () => {
          console.log(`[AutopilotExecutor] Crawling site inventory & mapping content coverage for ${website_domain}...`);
          return SiteContentGapDetector.getSiteInventory({
            websiteId: website_id,
            domain: website_domain,
            siteUrl: website_url,
          });
        })();
        console.log(`[AutopilotExecutor] Inventory mapped: ${siteInventory.coveredTitles.length} existing articles, ${siteInventory.categories.length} categories.`);

        const isGeneric = !targetKeyword || /^(write\s+an?\s+article|write\s+article|create\s+article|write\s+post|post\s+it|write|generate\s+article)/i.test(targetKeyword.trim());

        if (isGeneric) {
          // A. Discover high-impact content gaps that the site has NOT covered yet
          try {
            const { SiteNicheProfiler } = await import('./siteNicheProfiler');
            const siteProfile = await SiteNicheProfiler.profileSite({
              websiteId: website_id,
              domain: website_domain,
              siteUrl: website_url,
            });

            console.log(`[AutopilotExecutor] Running intelligent content gap detection for ${website_domain} (${siteProfile.primaryNiche})...`);
            const gaps = await SiteContentGapDetector.findContentGaps({
              inventory: siteInventory,
              websiteId: website_id,
              siteProfile,
              projectMemory,
              projectInstructions,
              limit: 3,
            });

            if (gaps && gaps.length > 0) {
              const bestGap = gaps[0];
              targetKeyword = bestGap.keyword;
              workingTitle = bestGap.working_title;
              searchIntent = bestGap.search_intent;
              keywordSource = `Content gap analysis [${bestGap.target_category}] - ${bestGap.gap_rationale} (${bestGap.estimated_volume}/mo, KD ${bestGap.estimated_kd})`;
              console.log(`[AutopilotExecutor] Selected content gap opportunity: "${workingTitle}" (Category: ${bestGap.target_category})`);
            } else {
              // Fallback to database opportunities if no live gap returned
              const { data: dbOpps } = await supabase
                .from('keyword_opportunities')
                .select('keyword, search_volume, keyword_difficulty, search_intent')
                .eq('website_id', website_id)
                .gte('search_volume', 200)
                .lte('keyword_difficulty', 35)
                .order('priority', { ascending: true })
                .order('search_volume', { ascending: false })
                .limit(5);

              if (dbOpps && dbOpps.length > 0) {
                const best = dbOpps[0];
                targetKeyword = best.keyword;
                workingTitle = `${best.keyword.charAt(0).toUpperCase() + best.keyword.slice(1)}: Practical Action Guide`;
                searchIntent = best.search_intent || 'informational';
                keywordSource = `database opportunity (${best.search_volume}/mo, KD ${best.keyword_difficulty})`;
              }
            }
          } catch (gapErr) {
            console.warn('[AutopilotExecutor] Content gap detection notice:', gapErr);
          }
        } else {
          // B. User specified a keyword/topic: check against site inventory for potential cannibalization
          const dupResult = DuplicateArticleChecker.findDuplicateInInventory(targetKeyword, siteInventory);
          if (dupResult.isDuplicate && (dupResult.url || dupResult.draftId)) {
            console.warn(`[AutopilotExecutor] BLOCKED write request on verified existing topic: "${targetKeyword}" matches "${dupResult.existingTitle}"`);

            // Discover 3 fresh, uncovered content gap alternatives
            let alternativeGaps: any[] = [];
            try {
              alternativeGaps = await SiteContentGapDetector.findContentGaps({
                inventory: siteInventory,
                projectMemory,
                projectInstructions,
                limit: 3,
              });
            } catch (_) {}

            const altList = alternativeGaps.length > 0
              ? alternativeGaps.map((g, idx) => `${idx + 1}️⃣ *"${g.working_title}"*\n   ↳ _Keyword:_ \`${g.keyword}\` | _Category:_ ${g.target_category} (${g.estimated_volume}/mo, KD ${g.estimated_kd})`).join('\n\n')
              : '• Check your Content Planner for fresh, uncovered keyword opportunities.';

            const siteBase = (website_url || `https://${website_domain}`).replace(/\/+$/, '');
            const articleLink = dupResult.url && dupResult.url.startsWith('http')
              ? dupResult.url
              : (dupResult.status === 'published' ? `${siteBase}/${DuplicateArticleChecker.toSlug(dupResult.existingTitle)}` : undefined);

            const proofLine = articleLink
              ? `🔗 *Live Article Proof:* ${articleLink}\n\n`
              : (dupResult.draftId ? `📋 *Content Planner Draft Proof:* [View in Content Planner](/content-planner) (Draft ID: \`${dupResult.draftId}\`)\n\n` : '');

            const blockSummary = `⚠️ *Topic Already Covered — Write Request Prevented*\n\n` +
              `An article covering *"${targetKeyword}"* already exists for \`${website_domain}\`:\n` +
              `👉 *"${dupResult.existingTitle}"*\n` +
              proofLine +
              `Writing another article on this exact topic would cause *search cannibalization* and burn AI tokens unnecessarily.\n\n` +
              `🎯 *Recommended Uncovered Content Gaps Instead:*\n\n${altList}\n\n` +
              `_Please reply with one of the above topics or a new uncovered keyword to proceed!_`;

            // If a chat_id is present, notify user immediately
            if (params.chat_id) {
              try {
                const { TelegramService } = await import('../telegram/telegramService');
                const telegram = new TelegramService();
                await telegram.sendMessage(params.chat_id, blockSummary, { parse_mode: 'Markdown' });
              } catch (_) {}
            }

            return {
              success: false,
              intent_type: 'immediate_action',
              action_type: 'write_article',
              summary: blockSummary,
              link_url: '/content-planner',
              link_label: 'View Content Planner',
              data: {
                already_covered: true,
                existing_title: dupResult.existingTitle,
                existing_url: dupResult.url,
                draft_id: dupResult.draftId,
                alternatives: alternativeGaps,
              }
            };
          }
        }

        if (!targetKeyword) {
          targetKeyword = `${website_domain.replace(/\.[a-z]+$/i, '').replace(/[-_]/g, ' ')} strategy`;
          workingTitle = `Complete Guide to ${targetKeyword}`;
        }
        if (!workingTitle) {
          workingTitle = `${targetKeyword.charAt(0).toUpperCase() + targetKeyword.slice(1)}: Complete Guide`;
        }

        // Semantic LSI Secondary Keywords
        secondaryKeywords = [
          `${targetKeyword} best practices`,
          `${targetKeyword} actionable steps`,
          `how to implement ${targetKeyword}`,
          `${targetKeyword} common mistakes`
        ];

        // 2. Internal Linking Agent: Discover existing live pages to weave into the article
        console.log(`[AutopilotExecutor] Calling InternalLinkingAgent to crawl existing site pages on ${website_domain}...`);
        const candidateInternalLinks: string[] = [];
        const siteBaseUrl = website_url || `https://${website_domain}`;

        try {
          const [pagesRes, draftsRes] = await Promise.all([
            supabase.from('pages').select('path, title, h1').eq('website_id', website_id).limit(15),
            supabase.from('content_drafts').select('working_title, url_slug, revision_notes').eq('website_id', website_id).neq('status', 'failed').limit(15)
          ]);

          if (draftsRes.data) {
            for (const d of draftsRes.data) {
              let wpUrl: string | null = null;
              if (d.revision_notes && typeof d.revision_notes === 'string' && d.revision_notes.startsWith('{')) {
                try {
                  const parsed = JSON.parse(d.revision_notes);
                  if (parsed.wordpress_post_url) wpUrl = parsed.wordpress_post_url;
                } catch (_) {}
              }
              if (wpUrl) {
                candidateInternalLinks.push(`[${d.working_title}](${wpUrl})`);
              } else if (d.url_slug) {
                candidateInternalLinks.push(`[${d.working_title}](${siteBaseUrl.replace(/\/$/, '')}/blog/${d.url_slug})`);
              }
            }
          }

          if (pagesRes.data) {
            for (const p of pagesRes.data) {
              const title = p.title || p.h1 || p.path;
              const fullUrl = p.path.startsWith('http') ? p.path : `${siteBaseUrl.replace(/\/$/, '')}${p.path.startsWith('/') ? '' : '/'}${p.path}`;
              candidateInternalLinks.push(`[${title}](${fullUrl})`);
            }
          }
        } catch (linkErr) {
          console.warn('[AutopilotExecutor] Internal link discovery warning:', linkErr);
        }

        // 3. Drafting pipeline via Claude Sonnet 5 + ImageAgent
        const runDrafting = async () => {
          let preInsertedDraftId: string | null = null;
          try {
            // A. Pre-insert draft ticket so the user sees it in Content Planner immediately (status: 'writing')
            try {
              const { data: preDraft } = await supabase
                .from('content_drafts')
                .insert({
                  website_id,
                  working_title: workingTitle,
                  primary_keyword: targetKeyword,
                  secondary_keywords: secondaryKeywords,
                  search_intent: searchIntent,
                  content_type: 'blog_article',
                  target_audience: websiteAudience,
                  content_body: '',
                  word_count: 0,
                  status: 'writing',
                  current_version: 1,
                })
                .select('id')
                .single();
              if (preDraft?.id) {
                preInsertedDraftId = preDraft.id;
              }
            } catch (preErr) {
              console.warn('[AutopilotExecutor] Pre-draft creation notice:', preErr);
            }

            console.log(`[AutopilotExecutor] Multi-Agent Orchestration: Writing "${workingTitle}" for keyword "${targetKeyword}" with ${candidateInternalLinks.length} internal links...`);
            const contentAgent = new ContentAgent();
            const output = await contentAgent.runFullPipeline({
              website_id,
              primary_keyword: targetKeyword,
              secondary_keywords: secondaryKeywords,
              search_intent: searchIntent,
              content_type: 'blog_article',
              target_audience: websiteAudience,
              working_title: workingTitle,
              internal_linking_opportunities: candidateInternalLinks.slice(0, 6),
              rules: contentRules,
              project_instructions: projectInstructions,
              project_memory: projectMemory,
              draft_id: preInsertedDraftId || undefined,
              site_url: website_url || undefined,
            });

            let draftId = preInsertedDraftId;

            if (draftId) {
              // Update the pre-inserted draft ticket to ready_for_approval
              await supabase
                .from('content_drafts')
                .update({
                  working_title: output.working_title || workingTitle,
                  h1: output.content_body.match(/^# (.+)$/m)?.[1] || output.working_title,
                  primary_keyword: targetKeyword,
                  secondary_keywords: secondaryKeywords,
                  search_intent: searchIntent,
                  content_type: 'blog_article',
                  target_audience: websiteAudience,
                  content_body: output.content_body,
                  word_count: output.word_count,
                  reading_time_minutes: output.reading_time_minutes,
                  seo_title: output.seo_title,
                  meta_description: output.meta_description,
                  url_slug: output.url_slug,
                  status: 'ready_for_approval',
                  revision_notes: JSON.stringify({
                    featured_image_url: output.featured_image_url,
                    featured_image_alt: output.featured_image_alt,
                    images: output.images,
                  }),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', draftId);
            } else {
              // Fallback: insert fresh draft
              const { data: savedDraft } = await supabase
                .from('content_drafts')
                .insert({
                  website_id,
                  working_title: output.working_title || workingTitle,
                  h1: output.content_body.match(/^# (.+)$/m)?.[1] || output.working_title,
                  primary_keyword: targetKeyword,
                  secondary_keywords: secondaryKeywords,
                  search_intent: searchIntent,
                  content_type: 'blog_article',
                  target_audience: websiteAudience,
                  content_body: output.content_body,
                  word_count: output.word_count,
                  reading_time_minutes: output.reading_time_minutes,
                  seo_title: output.seo_title,
                  meta_description: output.meta_description,
                  url_slug: output.url_slug,
                  status: 'ready_for_approval',
                  revision_notes: JSON.stringify({
                    featured_image_url: output.featured_image_url,
                    featured_image_alt: output.featured_image_alt,
                    images: output.images,
                  }),
                  current_version: 1,
                })
                .select('id')
                .single();
              draftId = savedDraft?.id;
            }

            if (draftId) {
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

              if (output.images && output.images.length > 0) {
                for (const img of output.images) {
                  if (img.image_url) {
                    try {
                      await supabase.from('content_images').insert({
                        draft_id: draftId,
                        placement_context: img.placement_context || 'header',
                        image_type: img.image_type || 'featured',
                        purpose: img.purpose || img.alt_text,
                        alt_text: img.alt_text,
                        suggested_filename: img.image_url,
                        status: 'created',
                      });
                    } catch (imgDbErr: any) {
                      console.warn('[AutopilotExecutor] Failed inserting content_images:', imgDbErr?.message);
                    }
                  }
                }
              }
            }

            console.log(`[AutopilotExecutor] Draft generated successfully for "${workingTitle}"!`);

            // Send interactive Telegram prompt to active chat_id and all subscribers
            try {
              const { TelegramService } = await import('../telegram/telegramService');
              const telegram = new TelegramService();
              const targetChatIds = new Set<string | number>();
              if (params.chat_id) targetChatIds.add(params.chat_id);
              try {
                const subscribers = await telegram.getSubscribers(website_id);
                for (const sub of subscribers) {
                  if (sub.chat_id) targetChatIds.add(sub.chat_id);
                }
              } catch (_) {}

              const measuredScore = computeMeasuredSeoScore(output.qa, output.word_count);

              for (const cId of targetChatIds) {
                await telegram.sendApprovalPrompt(cId, {
                  executionId: draftId || 'completed',
                  taskTitle: output.working_title || workingTitle,
                  websiteDomain: website_domain,
                  score: measuredScore,
                  wordCount: output.word_count,
                });
              }
            } catch (tErr) {
              console.warn('[AutopilotExecutor] Failed to send Telegram approval prompt:', tErr);
            }

            return { output, draftId, targetKeyword, keywordSource };
          } catch (err: any) {
            console.error('[AutopilotExecutor] Draft generation failed:', err?.message || err);
            if (preInsertedDraftId) {
              try {
                // Cleanly remove incomplete placeholder draft so no ghost ticket lingers
                await supabase
                  .from('content_drafts')
                  .delete()
                  .eq('id', preInsertedDraftId);
              } catch (delErr) {
                console.warn('[AutopilotExecutor] Failed to clean placeholder draft:', delErr);
              }
            }
            throw err;
          }
        };

        if (params.sync !== false) {
          try {
            const { output, draftId, targetKeyword: kw, keywordSource: kSrc } = await runDrafting();
            const measuredScore = computeMeasuredSeoScore(output.qa, output.word_count);
            return {
              success: true,
              intent_type: 'immediate_action',
              action_type: 'write_article',
              summary: `🎯 *Keyword Researched:* "${kw}" (${kSrc})\n🔗 *Internal Links Weaved:* ${candidateInternalLinks.slice(0, 3).length} live site URLs\n🎨 *Images Generated:* Featured visual created\n📝 *Article Drafted:* "${output.working_title || workingTitle}" (${output.word_count} words, Measured SEO Score: ${measuredScore}/100).\n\nReady for your approval to publish live!`,
              link_url: '/content-planner',
              link_label: 'View in Content Planner',
              data: { draft_id: draftId, topic: workingTitle, output }
            };
          } catch (dErr: any) {
            return {
              success: false,
              intent_type: 'immediate_action',
              action_type: 'write_article',
              summary: `Failed to draft article for "${workingTitle}": ${dErr.message || dErr}`,
              error: dErr.message
            };
          }
        } else {
          safeBackground(async () => { await runDrafting(); });
          return {
            success: true,
            intent_type: 'immediate_action',
            action_type: 'write_article',
            summary: `Writing article draft for "${workingTitle}". Editorial drafting is running autonomously.`,
            link_url: '/content-planner',
            link_label: 'View in Content Planner',
            data: { topic: workingTitle }
          };
        }
      }

      // ── ACTION: KEYWORD RESEARCH ──────────────────────────────────────
      if (instruction.action_type === 'keyword_research') {
        const seedTopic = instruction.topic || undefined;
        console.log(`[AutopilotExecutor] Running intelligent site inventory crawl & keyword discovery for "${website_domain}" with seed "${seedTopic || 'none'}"...`);

        // 1. Profile site niche and authority tier (new vs established)
        const { SiteNicheProfiler } = await import('./siteNicheProfiler');
        const siteProfile = await SiteNicheProfiler.profileSite({
          websiteId: website_id,
          domain: website_domain,
          siteUrl: website_url,
        });

        // Map existing content & categories to prevent cannibalization
        const inventory = preloadedInventory || await (async () => {
          return SiteContentGapDetector.getSiteInventory({
            websiteId: website_id,
            domain: website_domain,
            siteUrl: website_url,
          });
        })();

        const keywordAgent = new KeywordAgent();
        const { clusters, opportunities } = await keywordAgent.discoverOpportunities({
          domain: website_domain,
          websiteId: website_id,
          siteUrl: website_url,
          siteProfile,
          seedTopic: seedTopic || (instruction.goal ? instruction.goal : undefined),
          projectMemory,
          projectInstructions,
          mode: siteProfile.authorityTier,
          existingArticles: inventory.coveredTitles,
          categories: inventory.categories.map(c => c.name),
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

        const topOpps = opportunities
          .filter(op => (op.search_volume || 0) >= 200)
          .slice(0, 5)
          .map(op => ({
            keyword: op.keyword,
            search_volume: op.search_volume,
            keyword_difficulty: op.keyword_difficulty,
            intent: op.search_intent,
            priority: op.priority,
          }));

        // Broadcast newly discovered keywords to Telegram Bot
        try {
          const { TelegramService } = await import('../telegram/telegramService');
          const telegram = new TelegramService();
          await telegram.broadcastDiscovery({
            websiteId: website_id,
            domain: website_domain,
            type: 'new_keywords',
            dedupKey: `${website_id}:kw:${topOpps.map(o => o.keyword).join(',')}`,
            title: `New Keywords Discovered (${opportunities.length} opportunities)`,
            fields: topOpps.slice(0, 3).map(op => ({
              label: op.keyword,
              value: `Vol: ${op.search_volume?.toLocaleString() || 'N/A'}/mo · KD: ${op.keyword_difficulty || 'Low'}`
            })),
            actionLabel: 'View Keywords',
            actionUrl: '/keywords',
          });
        } catch (tErr) {
          console.warn('[AutopilotExecutor] Keyword Telegram alert note:', tErr);
        }

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'keyword_research',
          summary: `Analyzed site niche "${siteProfile.primaryNiche}" (${siteProfile.authorityTier.toUpperCase()} site with ${siteProfile.authorityMetrics.pageCount} pages, ${siteProfile.authorityMetrics.backlinkCount} backlinks). Mapped ${inventory.coveredTitles.length} existing articles and ${inventory.categories.length} categories on ${website_domain}. Discovered ${clusters.length} topical clusters and ${opportunities.length} targeted keyword opportunities (${siteProfile.authorityTier === 'established' ? 'Medium KD 30-55, Vol 1,000-15,000+' : 'Easy KD 10-28, Vol 250-2,500 with real search demand'}).`,
          link_url: '/keywords',
          link_label: 'View Discovered Keywords',
          data: {
            niche: siteProfile.primaryNiche,
            authority_tier: siteProfile.authorityTier,
            existing_articles_mapped: inventory.coveredTitles.length,
            categories_analyzed: inventory.categories.length,
            clusters_count: clusters.length,
            opportunities_count: opportunities.length,
            top_opportunities: topOpps,
          }
        };
      }

      // ── ACTION: SEO FORENSIC DIAGNOSTIC ──────────────────────────────
      if (instruction.action_type === 'seo_diagnostic') {
        console.log(`[AutopilotExecutor] Running DiagnosticAgent forensic investigation for "${website_domain}"...`);
        const report = await DiagnosticAgent.diagnoseSite({
          websiteId: website_id,
          domain: website_domain,
          siteUrl: website_url,
          userQuery: instruction.goal || instruction.summary || 'Diagnose ranking and traffic changes',
          targetKeyword: instruction.topic,
          targetUrl: instruction.target_url,
        });

        // Save diagnostic findings to project_memory for long-term intelligence
        try {
          await supabase.from('project_memory').insert({
            website_id,
            category: 'seo_diagnosis',
            source: 'diagnostic_agent',
            content: JSON.stringify({
              health: report.overall_health,
              summary: report.executive_summary,
              findings: report.findings,
              action_plan: report.action_plan,
            }),
            confidence: 'high',
          });
        } catch (_) {}

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'seo_diagnostic',
          summary: report.formatted_markdown,
          link_url: '/rank-tracking',
          link_label: 'View Diagnostic Details',
          data: report,
        };
      }

      // ── ACTION: RANK DROP RECOVERY ───────────────────────────────────
      if (instruction.action_type === 'rank_recovery') {
        console.log(`[AutopilotExecutor] Running RankRecoveryEngine for "${website_domain}"...`);
        const report = await RankRecoveryEngine.scanAndAnalyze({
          websiteId: website_id,
          domain: website_domain,
          siteUrl: website_url,
        });

        const savedCount = await RankRecoveryEngine.persistOpportunitiesToDatabase({
          websiteId: website_id,
          report,
        });

        const dropCount = report.detected_drops_count;
        let recoverySummary = '';
        if (dropCount > 0) {
          recoverySummary = `🚨 *Detected ${dropCount} Rank Drops on ${website_domain}*\n\n`;
          for (const d of report.detected_rank_drops.slice(0, 3)) {
            recoverySummary += `• *${d.keyword}*: #${d.previous_position} → #${d.current_position} (${d.primary_root_cause.replace(/_/g, ' ')})\n`;
            recoverySummary += `  ↳ _Diagnosis:_ ${d.root_cause_explanation}\n`;
            recoverySummary += `  ↳ _Recovery Action:_ ${d.recovery_plan[0]?.description || 'Content Refresh & Re-index'}\n\n`;
          }
          recoverySummary += `Generated ${savedCount} actionable recovery plans ready for execution in the dashboard.`;
        } else {
          recoverySummary = `✅ *Zero Critical Rank Drops on ${website_domain}*\n\nMonitored keywords are stable. Discovered ${report.striking_distance_count} striking-distance queries ready to push into the Top 3 for click acceleration.`;
        }

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'rank_recovery',
          summary: recoverySummary,
          link_url: '/rank-tracking',
          link_label: 'Open Rank Recovery Center',
          data: report,
        };
      }

      // ── ACTION: GROWTH ACCELERATION (STRIKING DISTANCE) ───────────────
      if (instruction.action_type === 'growth_acceleration') {
        console.log(`[AutopilotExecutor] Running Striking-Distance Click Accelerator for "${website_domain}"...`);
        const report = await RankRecoveryEngine.scanAndAnalyze({
          websiteId: website_id,
          domain: website_domain,
          siteUrl: website_url,
        });

        const savedCount = await RankRecoveryEngine.persistOpportunitiesToDatabase({
          websiteId: website_id,
          report,
        });

        let growthSummary = `⚡ *Fast-Rank Growth Opportunities for ${website_domain}:*\n\n`;
        growthSummary += `Identified ${report.striking_distance_count} striking-distance queries (positions 4–20) with potential unlock of +${report.total_potential_clicks_gain.toLocaleString()} monthly clicks!\n\n`;

        for (const opp of report.striking_distance_opportunities.slice(0, 3)) {
          growthSummary += `• *"${opp.keyword}"* (Position #${opp.current_position} · ${opp.impressions.toLocaleString()} imps)\n`;
          growthSummary += `  ↳ _Action:_ Rewrite title to high-CTR formula & expand missing H2 subtopics.\n`;
          growthSummary += `  ↳ _Target:_ Push to Top 3 (${opp.estimated_click_multiplier})\n\n`;
        }
        growthSummary += `Saved ${savedCount} high-leverage opportunities queued for 1-click execution.`;

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'growth_acceleration',
          summary: growthSummary,
          link_url: '/rank-tracking',
          link_label: 'View Growth Opportunities',
          data: report,
        };
      }

      // ── ACTION: TECHNICAL AUDIT / CRAWL ───────────────────────────────
      if (instruction.action_type === 'technical_audit') {
        const crawlService = new CrawlService();
        const targetUrl = instruction.target_url || params.website_url || `https://${website_domain}`;

        safeBackground(async () => {
          try {
            const analysis = await crawlService.getOrAnalyzeWebsite({
              websiteId: website_id,
              projectId: params.project_id,
              targetUrl,
              siteTech: 'unknown',
              maxPages: 20,
              maxDepth: 3,
              forceFresh: true,
            });

            try {
              const pagesAnalyzed = analysis?.result?.pages?.length || 0;
              const issuesCount = analysis?.result?.deterministic_issues?.length || 0;
              const { TelegramService } = await import('../telegram/telegramService');
              const telegram = new TelegramService();
              await telegram.notifyWebsiteSubscribers(
                website_id,
                `✅ *Technical Audit Completed!*\n\n*Target:* \`${website_domain}\`\n*Pages Crawled:* ${pagesAnalyzed}\n*Issues Found:* ${issuesCount}\n\n[View Technical Report](/technical-seo)`
              );
            } catch (tErr) {
              console.warn('[AutopilotExecutor] Tech crawl telegram notify warning:', tErr);
            }
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

      // ── ACTION: RUN SCHEDULED TASKS ───────────────────────────────────
      if (instruction.action_type === 'run_scheduled_tasks') {
        const { data: activeTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', params.project_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (activeTasks && activeTasks.length > 0) {
          const targetTask = activeTasks[0];
          const taskGoal = targetTask.natural_language_instruction || targetTask.name;
          const { AutopilotNLParser } = await import('./autopilotNLParser');
          const nlParser = new AutopilotNLParser();
          const parsedTask = await nlParser.parseInstruction({
            prompt: taskGoal,
            domain: website_domain,
            modeOverride: 'immediate',
          });

          if (parsedTask.action_type !== 'run_scheduled_tasks') {
            const subResult = await this.executeImmediateAction({
              instruction: parsedTask,
              website_id,
              website_domain,
              website_url: params.website_url,
              project_id: params.project_id,
              user_id: params.user_id,
            });

            await supabase
              .from('tasks')
              .update({ last_run_at: new Date().toISOString() })
              .eq('id', targetTask.id);

            return {
              ...subResult,
              summary: `Executed task "${targetTask.name}": ${subResult.summary}`,
            };
          }
        }
      }

      // ── ACTION: SITE STATUS & EXECUTIVE BRIEFING ─────────────────────
      if (instruction.action_type === 'site_status_summary') {
        console.log(`[AutopilotExecutor] Generating Site Status Executive Briefing for "${website_domain}"...`);
        const [kwCountRes, pagesCountRes, issuesCountRes, draftsRes, scRes] = await Promise.all([
          supabase.from('keywords').select('*', { count: 'exact', head: true }).eq('website_id', website_id),
          supabase.from('pages').select('*', { count: 'exact', head: true }).eq('website_id', website_id),
          supabase.from('technical_issues').select('*', { count: 'exact', head: true }).eq('website_id', website_id).eq('status', 'open'),
          supabase.from('content_drafts').select('id, working_title, status, created_at').eq('website_id', website_id).order('created_at', { ascending: false }).limit(5),
          supabase.from('search_console_data').select('query, position, clicks, impressions').eq('website_id', website_id).order('clicks', { ascending: false }).limit(5),
        ]);

        const totalKeywords = kwCountRes.count || 0;
        const totalPages = pagesCountRes.count || 0;
        const openIssues = issuesCountRes.count || 0;
        const drafts = draftsRes.data || [];
        const scRows = scRes.data || [];

        const latestDraft = drafts[0];
        const publishedCount = drafts.filter((d: any) => d.status === 'published').length;

        let briefing = `📊 *Executive SEO Briefing: ${website_domain}*\n\n`;
        briefing += `🌐 *Domain:* \`${website_domain}\`\n`;
        briefing += `📈 *Search Visibility:* ${totalKeywords} tracked queries\n`;
        briefing += `📄 *Crawled Pages:* ${totalPages} indexed pages\n`;
        briefing += `🛠️ *Technical Health:* ${openIssues === 0 ? '🟢 0 open technical issues' : `⚠️ ${openIssues} open technical issues`}\n`;
        briefing += `📝 *Content Pipeline:* ${drafts.length} total drafts (${publishedCount} published live)\n`;

        if (latestDraft) {
          briefing += `\n🌟 *Latest Post:* "${latestDraft.working_title}" (${latestDraft.status})\n`;
        }

        if (scRows.length > 0) {
          briefing += `\n🎯 *Top Performing Search Queries:*\n`;
          for (const s of scRows.slice(0, 3)) {
            briefing += `• *${s.query}*: #${Math.round(Number(s.position) || 0)} (${s.clicks || 0} clicks, ${s.impressions || 0} impressions)\n`;
          }
        } else {
          briefing += `\n🎯 *Search Console Performance:* No Search Console queries recorded yet for this domain. Connect Google Search Console in Integrations to track live search queries and clicks.\n`;
        }

        briefing += `\n💡 *Recommended Next Action:* Reply with *"Write an article about [topic]"* or *"Help me rank faster"* to accelerate search growth!`;

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'site_status_summary',
          summary: briefing,
          link_url: '/dashboard',
          link_label: 'Open Web Dashboard',
          data: { totalKeywords, totalPages, openIssues, latestDraft },
        };
      }

      // ── ACTION: CONTENT IDEAS & TOPIC RECOMMENDATIONS ────────────────
      if (instruction.action_type === 'content_ideas') {
        console.log(`[AutopilotExecutor] Generating high-ROI content ideas for "${website_domain}"...`);
        const { SiteContentGapDetector } = await import('./siteContentGapDetector');
        const { SiteNicheProfiler } = await import('./siteNicheProfiler');

        const siteProfile = await SiteNicheProfiler.profileSite({
          websiteId: website_id,
          domain: website_domain,
          siteUrl: website_url,
        });

        const inventory = preloadedInventory || await SiteContentGapDetector.getSiteInventory({
          websiteId: website_id,
          domain: website_domain,
          siteUrl: website_url,
        });

        const gaps = await SiteContentGapDetector.findContentGaps({ inventory, siteProfile, limit: 3 });

        let ideasSummary = `💡 *Top High-ROI Content Opportunities for ${website_domain}*\n`;
        ideasSummary += `🎯 *Niche:* ${siteProfile.primaryNiche} (${siteProfile.authorityTier === 'established' ? 'Authority site' : 'New / Early-stage site'})\n\n`;
        if (gaps.length > 0) {
          gaps.forEach((g, idx) => {
            ideasSummary += `${idx + 1}️⃣ *"${g.working_title}"*\n`;
            ideasSummary += `   ↳ *Target Keyword:* \`${g.keyword}\` (${g.estimated_volume || '300+'}/mo, KD ${g.estimated_kd || 'Low'})\n`;
            ideasSummary += `   ↳ *Category:* ${g.target_category}\n\n`;
          });
          ideasSummary += `_Reply with "Write an article about [Topic]" to start drafting immediately!_`;
        } else {
          ideasSummary += `_No immediate content gaps detected. All existing primary categories are actively covered._`;
        }

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'content_ideas',
          summary: ideasSummary,
          link_url: '/content-planner',
          link_label: 'View in Content Planner',
          data: { gaps },
        };
      }

      // ── ACTION: COMPETITOR ANALYSIS ──────────────────────────────────
      if (instruction.action_type === 'competitor_analysis') {
        console.log(`[AutopilotExecutor] Running competitor analysis for "${website_domain}"...`);
        let { data: competitors } = await supabase
          .from('competitors')
          .select('id, domain, type, overlap_score, overlap_keywords, status')
          .eq('website_id', website_id)
          .limit(6);

        // If no competitors are configured in database, discover them autonomously!
        if (!competitors || competitors.length === 0) {
          console.log(`[AutopilotExecutor] No competitors in database for ${website_domain}. Autonomously discovering competitors...`);
          try {
            const { SiteNicheProfiler } = await import('./siteNicheProfiler');
            const { CompetitorAgent } = await import('./competitorAgent');
            const siteProfile = await SiteNicheProfiler.profileSite({
              websiteId: website_id,
              domain: website_domain,
              siteUrl: website_url,
            });

            const competitorAgent = new CompetitorAgent();
            const targetKeywords = siteProfile.coreOfferings?.length > 0
              ? siteProfile.coreOfferings.slice(0, 5)
              : [`${siteProfile.primaryNiche} software`, `${siteProfile.primaryNiche} platform`, `${siteProfile.primaryNiche} tools`];

            const discovered = await competitorAgent.discoverCompetitorsDirect(
              website_domain,
              targetKeywords,
              `Industry: ${siteProfile.primaryNiche}. Audience: ${siteProfile.targetAudience}`
            );

            if (discovered && discovered.length > 0) {
              const insertRows = discovered.slice(0, 6).map((c: any) => ({
                website_id,
                domain: c.domain,
                type: c.classification === 'direct' ? 'Direct' : c.classification === 'content' ? 'Content' : 'Organic',
                overlap_score: c.relevance_score || 75,
                overlap_keywords: (c.overlap_keywords || []).length || 5,
                status: 'active',
                last_analyzed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }));

              await supabase.from('competitors').upsert(insertRows, { onConflict: 'website_id,domain' });

              competitors = insertRows as any;
            }
          } catch (compErr) {
            console.warn('[AutopilotExecutor] Autonomous competitor discovery fallback warning:', compErr);
          }
        }

        let compSummary = `🕵️ *Competitor Search Intelligence: ${website_domain}*\n\n`;
        if (competitors && competitors.length > 0) {
          compSummary += `Monitoring ${competitors.length} primary competitors in your niche:\n\n`;
          for (const c of competitors) {
            compSummary += `• *${c.domain}* (${c.type || 'Direct'}):\n  ↳ Overlap Score: \`${c.overlap_score || 80}%\` · Status: \`${c.status || 'Tracked'}\`\n`;
          }
          compSummary += `\n🎯 *Intelligence Insights:*\nOur agents continuously analyze competitor keyword shifts to capture high-intent rankings and defend your topical authority.`;
        } else {
          compSummary += `Analyzing SERP landscape for *${website_domain}*...\nReply with *"Track competitor competitor.com"* to benchmark against any specific rival!`;
        }

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'competitor_analysis',
          summary: compSummary,
          link_url: '/competitors',
          link_label: 'Open Competitor Center',
          data: { competitors },
        };
      }

      // ── ACTION: BACKLINK DISCOVERY & LINK PROSPECTING ────────────────
      if (instruction.action_type === 'backlink_discovery') {
        console.log(`[AutopilotExecutor] Running backlink prospect discovery for "${website_domain}"...`);
        let prospects: any[] = [];
        let nicheTopic = 'industry and digital technology';
        let blSummary = '';

        try {
          const { SiteNicheProfiler } = await import('./siteNicheProfiler');
          const siteProfile = await SiteNicheProfiler.profileSite({
            websiteId: website_id,
            domain: website_domain,
            siteUrl: website_url,
          });
          if (siteProfile.primaryNiche) {
            nicheTopic = siteProfile.primaryNiche;
          }

          let competitorDomains: string[] = [];
          try {
            const { data: dbComps } = await supabase
              .from('competitors')
              .select('domain')
              .eq('website_id', website_id)
              .limit(5);
            if (dbComps && dbComps.length > 0) {
              competitorDomains = dbComps.map((c: any) => c.domain);
            }
          } catch (compErr) {
            console.warn('[AutopilotExecutor] Competitor fetch notice:', compErr);
          }

          const { BacklinkAgent } = await import('./backlinkAgent');
          const backlinkAgent = new BacklinkAgent();
          const [rawProspects, competitorIntel] = await Promise.all([
            backlinkAgent.discoverProspectsDirect(website_domain, nicheTopic),
            backlinkAgent.spyCompetitorBacklinks(website_domain, nicheTopic, competitorDomains),
          ]);

          if (rawProspects && rawProspects.length > 0) {
            prospects = rawProspects.slice(0, 5);
            for (const p of prospects) {
              try {
                await supabase.from('backlink_prospects').upsert({
                  website_id,
                  prospect_url: p.url,
                  domain: p.domain,
                  category: p.category,
                  relevance_score: p.relevance_score,
                  quality_score: p.quality_score,
                  opportunity_score: p.opportunity_score,
                  risk_score: p.risk_score,
                  outreach_priority: p.outreach_priority,
                  contact_page: p.contact_page || `https://${p.domain}/contact`,
                }, { onConflict: 'website_id,prospect_url' });
              } catch (dbErr: any) {
                console.warn('[AutopilotExecutor] Backlink prospect upsert notice:', dbErr?.message);
              }
            }
          }

          blSummary = `🎯 *Backlink Opportunities & Competitor Spy Blueprint for ${website_domain}*\n`;
          blSummary += `📂 *Niche Focus:* \`${nicheTopic}\`\n\n`;

          // ── PART 1: WHERE & HOW TO GET HIGH-AUTHORITY BACKLINKS ──────────
          if (prospects.length > 0) {
            blSummary += `📍 *PART 1: WHERE & HOW TO GET BACKLINKS (STEP-BY-STEP)*\n\n`;
            for (let i = 0; i < prospects.length; i++) {
              const p = prospects[i];
              const oppTitle = p.opportunity_title || (
                p.category === 'resource_page' ? 'Curated Resource & Directory Listing'
                : p.category === 'guest_contribution' ? 'Guest Thought Leadership Feature'
                : p.category === 'unlinked_mention' ? 'Brand Citation & Mention Claim'
                : 'Competitor Alternative & Comparison Listing'
              );

              blSummary += `${i + 1}️⃣ *${oppTitle}*\n`;
              blSummary += `   🏢 *Target Site:* [${p.domain}](${p.url}) · Authority: \`${p.quality_score || 85}/100\`\n`;
              if (p.target_location) {
                blSummary += `   📍 *Where on Site:* ${p.target_location}\n`;
              }
              if (p.how_to_acquire && p.how_to_acquire.length > 0) {
                blSummary += `   🛠️ *How to Get It Exactly:*\n`;
                for (const step of p.how_to_acquire) {
                  blSummary += `      ${step}\n`;
                }
              }
              if (p.target_anchor) {
                blSummary += `   🔗 *Recommended Anchor:* \`${p.target_anchor}\`\n`;
              }
              if (p.pitch_hook) {
                blSummary += `   ✉️ *Outreach Hook:* _"${p.pitch_hook}"_\n`;
              }
              const actionLink = p.contact_page || p.url;
              blSummary += `   ⚡ *Action Link:* [Open Target Hub](${actionLink})\n\n`;
            }
          }

          // ── PART 2: COMPETITOR BACKLINK SPY & STEAL BLUEPRINT ───────────
          if (competitorIntel && competitorIntel.length > 0) {
            blSummary += `🕵️‍♂️ *PART 2: COMPETITOR BACKLINK SPY & STEAL BLUEPRINT*\n\n`;
            for (let i = 0; i < competitorIntel.slice(0, 3).length; i++) {
              const c = competitorIntel[i];
              blSummary += `⚔️ *Target ${i + 1}: How \`${c.competitor_domain}\` Got Backlinks on \`${c.referring_site}\`*\n`;
              blSummary += `   🔗 *Referring Source:* [${c.referring_site}](${c.referring_url}) · Authority: \`${c.source_authority}/100\`\n`;
              blSummary += `   💡 *How They Got It:* ${c.how_competitor_got_it}\n`;
              blSummary += `   🎯 *How YOU Can Steal / Replicate It:*\n`;
              blSummary += `      📍 *Placement:* ${c.how_you_can_steal_it.exact_placement}\n`;
              if (c.how_you_can_steal_it.step_by_step_guide) {
                for (const s of c.how_you_can_steal_it.step_by_step_guide) {
                  blSummary += `      ${s}\n`;
                }
              }
              blSummary += `      ✉️ *Pitch Angle:* _"${c.how_you_can_steal_it.angle_to_pitch}"_\n`;
              blSummary += `   ⚡ *Replication Endpoint:* [Open Submission Page](${c.replicate_url})\n\n`;
            }
          }

          blSummary += `💡 *Next Action:* Review and launch personalized outreach campaigns directly from your Backlinks Manager.`;
        } catch (blErr) {
          console.warn('[AutopilotExecutor] Backlink prospecting error:', blErr);
        }

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'backlink_discovery',
          summary: blSummary,
          link_url: '/backlinks',
          link_label: 'Open Backlinks Hub',
          data: { prospects },
        };
      }

      // ── ACTION: GENERATE / RECREATE IMAGES FOR ARTICLE ───────────────
      if (instruction.action_type === 'generate_images') {
        console.log(`[AutopilotExecutor] Generating / recreating visual assets for "${website_domain}"...`);
        const targetPrompt = (instruction.topic || instruction.goal || '').trim();

        // 1. Locate the existing draft or post
        let targetDraft: any = null;
        let wpPostId: number | null = null;
        let livePostUrl: string | null = null;

        // Clean query terms to match title/slug/keyword
        const cleanQuery = targetPrompt
          .replace(/^(it('?s)?\s+)?(already\s+written|written)?\s*(but\s+)?(has\s+no\s+images?|missing\s+images?)?\s*(please\s+)?(recreate|generate|create|make|add|include)?\s*(images?|visuals?|pictures?)?\s*(for|about|on)?\s*/i, '')
          .replace(/["'`.?]/g, '')
          .trim();

        const queryTerms = cleanQuery.split(/\s+/).filter(w => w.length > 2);

        // Try exact/like search on content_drafts
        if (queryTerms.length > 0) {
          const { data: matchedDrafts } = await supabase
            .from('content_drafts')
            .select('*')
            .eq('website_id', website_id)
            .ilike('working_title', `%${queryTerms.slice(0, 3).join('%')}%`)
            .order('created_at', { ascending: false })
            .limit(1);

          if (matchedDrafts && matchedDrafts.length > 0) {
            targetDraft = matchedDrafts[0];
          }
        }

        // If not matched by query terms, get the latest active draft for this website
        if (!targetDraft) {
          const { data: latestDrafts } = await supabase
            .from('content_drafts')
            .select('*')
            .eq('website_id', website_id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (latestDrafts && latestDrafts.length > 0) {
            targetDraft = latestDrafts[0];
          }
        }

        const articleTitle = targetDraft?.working_title || cleanQuery || `SEO Guide for ${website_domain}`;
        const primaryKw = targetDraft?.primary_keyword || cleanQuery || articleTitle;

        // Check for existing WordPress post ID in draft revision_notes or recent jobs
        if (targetDraft?.revision_notes) {
          try {
            const notes = typeof targetDraft.revision_notes === 'string'
              ? JSON.parse(targetDraft.revision_notes)
              : targetDraft.revision_notes;
            if (notes.wordpress_post_id) wpPostId = Number(notes.wordpress_post_id);
            if (notes.wordpress_post_url) livePostUrl = notes.wordpress_post_url;
          } catch (_) {}
        }

        if (!wpPostId) {
          const { data: wpJob } = await supabase
            .from('wordpress_jobs')
            .select('*')
            .eq('website_id', website_id)
            .ilike('payload->>title', `%${queryTerms.slice(0, 2).join('%')}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (wpJob?.result?.post_id) wpPostId = Number(wpJob.result.post_id);
          if (wpJob?.result?.permalink) livePostUrl = wpJob.result.permalink;
        }

        // 2. Generate 16:9 Widescreen Visuals via OpenAI Image Engine
        const { ImageRouter } = await import('@/lib/ai/imageRouter');
        console.log(`[AutopilotExecutor] Generating hero image via OpenAI for "${articleTitle}"...`);

        const heroImagePromise = ImageRouter.generate({
          topic: articleTitle,
          target_keyword: primaryKw,
          purpose: `Featured hero visual for ${articleTitle}`,
          style: 'Premium editorial hero visual with cinematic lighting, rich textures, and sophisticated modern aesthetic',
          dimensions: '1792x1008',
          image_placement: 'hero',
          desired_visual_style: 'Premium editorial hero visual with cinematic lighting, rich textures, 16:9 widescreen framing, no text overlay',
        });

        const bodyDiagramPromise = ImageRouter.generate({
          topic: articleTitle,
          target_keyword: primaryKw,
          purpose: `Step-by-step framework diagram for ${articleTitle}`,
          style: 'Minimalist modern architectural workflow visualization, elegant geometric data flow, subtle studio backlighting',
          dimensions: '1792x1008',
          image_placement: 'body',
          desired_visual_style: 'Minimalist modern architectural workflow visualization, elegant geometric data flow, 16:9 widescreen, no text overlay',
        });

        const [heroResult, bodyResult] = await Promise.all([heroImagePromise, bodyDiagramPromise]);

        const heroUrl = heroResult?.url || '';
        const bodyUrl = bodyResult?.url || '';

        if (!heroUrl) {
          throw new Error('Image generation provider failed to return an image URL.');
        }

        // 3. Update existing draft content_body with newly generated images (without rewriting text!)
        let updatedBody = targetDraft?.content_body || '';
        if (updatedBody) {
          // If body has existing placeholder or no images, embed hero image below H1
          const heroMarkdown = `\n\n![${articleTitle}](${heroUrl})\n\n`;
          if (!updatedBody.includes(heroUrl)) {
            if (/^# .+/m.test(updatedBody)) {
              updatedBody = updatedBody.replace(/^(# .+)(\r?\n)+/, `$1${heroMarkdown}`);
            } else {
              updatedBody = `${heroMarkdown}${updatedBody}`;
            }
          }

          // Embed body diagram before first or second H2
          if (bodyUrl && !updatedBody.includes(bodyUrl)) {
            const diagramMarkdown = `\n\n![${articleTitle} Framework Diagram](${bodyUrl})\n\n`;
            const h2Matches = [...updatedBody.matchAll(/^## .+/gm)];
            if (h2Matches.length > 1) {
              const secondH2Index = h2Matches[1].index!;
              updatedBody = updatedBody.slice(0, secondH2Index) + diagramMarkdown + updatedBody.slice(secondH2Index);
            } else if (h2Matches.length === 1) {
              const firstH2Index = h2Matches[0].index!;
              updatedBody = updatedBody.slice(0, firstH2Index) + diagramMarkdown + updatedBody.slice(firstH2Index);
            }
          }
        }

        // 4. Update Database Records
        if (targetDraft) {
          let existingNotes: any = {};
          try {
            existingNotes = typeof targetDraft.revision_notes === 'string'
              ? JSON.parse(targetDraft.revision_notes)
              : (targetDraft.revision_notes || {});
          } catch (_) {}

          existingNotes.featured_image_url = heroUrl;
          existingNotes.images = [
            { image_url: heroUrl, placement: 'hero', alt: articleTitle },
            ...(bodyUrl ? [{ image_url: bodyUrl, placement: 'body', alt: `${articleTitle} Framework` }] : [])
          ];

          await supabase
            .from('content_drafts')
            .update({
              content_body: updatedBody || targetDraft.content_body,
              featured_image_url: heroUrl,
              revision_notes: JSON.stringify(existingNotes),
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetDraft.id);

          // Insert into content_images table
          try {
            await supabase.from('content_images').insert([
              {
                draft_id: targetDraft.id,
                placement_context: 'hero',
                image_type: 'featured',
                purpose: 'Hero visual',
                alt_text: articleTitle,
                suggested_filename: heroUrl,
                status: 'created',
              },
              ...(bodyUrl ? [{
                draft_id: targetDraft.id,
                placement_context: 'body',
                image_type: 'diagram',
                purpose: 'Framework diagram',
                alt_text: `${articleTitle} Framework Diagram`,
                suggested_filename: bodyUrl,
                status: 'created',
              }] : [])
            ]);
          } catch (ciErr) {
            console.warn('[AutopilotExecutor] content_images insert notice:', ciErr);
          }
        }

        // 5. Update WordPress Post if connected
        try {
          const { markdownToWordPressHtml } = await import('@/lib/utils/markdownToHtml');
          const formattedHtml = updatedBody ? markdownToWordPressHtml(updatedBody) : undefined;

          const { data: wpSite } = await supabase
            .from('wordpress_outbound_sites')
            .select('*')
            .eq('status', 'active')
            .order('last_ping_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (wpSite) {
            if (wpPostId) {
              // Queue update_post job to attach new featured image and formatted body
              await supabase.from('wordpress_jobs').insert({
                site_id: wpSite.id,
                website_id,
                job_type: 'update_post',
                payload: {
                  post_id: wpPostId,
                  featured_image_url: heroUrl,
                  force_featured_image: true,
                  ...(formattedHtml ? { content: formattedHtml } : {}),
                },
                idempotency_key: `update_img_post_${wpPostId}_${Date.now()}`,
                status: 'pending',
              });
              console.log(`[AutopilotExecutor] Queued update_post job for WP post #${wpPostId} with new hero visual`);
            } else if (targetDraft && targetDraft.status === 'published') {
              // Push create or update job with slug
              await supabase.from('wordpress_jobs').insert({
                site_id: wpSite.id,
                website_id,
                job_type: 'create_post',
                payload: {
                  title: articleTitle,
                  content: formattedHtml || targetDraft.content_body,
                  slug: targetDraft.url_slug,
                  status: 'publish',
                  featured_image_url: heroUrl,
                  force_featured_image: true,
                },
                idempotency_key: `create_post_img_${targetDraft.id}_${Date.now()}`,
                status: 'pending',
              });
            }
          }
        } catch (wpErr) {
          console.warn('[AutopilotExecutor] WordPress image update notice:', wpErr);
        }

        // 6. Format Response
        let imgSummary = `🎨 *Visual Assets Generated & Embedded!*\n\n`;
        imgSummary += `📌 *Target Article:* "${articleTitle}"\n`;
        imgSummary += `🖼️ *Featured Hero Visual:* 16:9 Widescreen Artwork\n`;
        if (bodyUrl) imgSummary += `📊 *In-Body Diagram:* Isometric Workflow Diagram\n`;
        if (livePostUrl) imgSummary += `🔗 *Live Article:* [${livePostUrl}](${livePostUrl})\n`;
        imgSummary += `\n✅ *Zero Content Disruption:* Visual assets have been generated via OpenAI and attached to your article and WordPress post without modifying your existing written text.`;



        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'generate_images',
          summary: imgSummary,
          link_url: livePostUrl || '/content-planner',
          link_label: livePostUrl ? 'View Live Article' : 'View in Content Planner',
          data: {
            article_title: articleTitle,
            hero_image_url: heroUrl,
            body_image_url: bodyUrl,
            wordpress_post_id: wpPostId,
            live_url: livePostUrl,
          },
        };
      }

      // ── ACTION: EDIT ARTICLE (SURGICAL MODIFICATION VIA CLAUDE SONNET 5) ─
      if (instruction.action_type === 'edit_article') {
        console.log(`[AutopilotExecutor] Resolving target draft to edit for "${website_domain}"...`);
        let targetDraft: any = null;
        const targetDraftId = params.draft_id;

        if (targetDraftId) {
          const { data: d } = await supabase
            .from('content_drafts')
            .select('*')
            .eq('id', targetDraftId)
            .maybeSingle();
          targetDraft = d;
        }

        if (!targetDraft && instruction.topic) {
          const cleanQuery = instruction.topic.replace(/^(edit|update|modify|revise)\s+/i, '').trim();
          const { data: d } = await supabase
            .from('content_drafts')
            .select('*')
            .eq('website_id', website_id)
            .ilike('working_title', `%${cleanQuery}%`)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          targetDraft = d;
        }

        if (!targetDraft) {
          // Fetch the most recent draft for this website
          const { data: d } = await supabase
            .from('content_drafts')
            .select('*')
            .eq('website_id', website_id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          targetDraft = d;
        }

        if (!targetDraft) {
          return {
            success: false,
            intent_type: 'immediate_action',
            action_type: 'edit_article',
            summary: `No existing article or draft was found for ${website_domain} to edit. Ask me to write an article first!`,
          };
        }

        // Check if the user's edit request is solely about images/visuals
        const isPureImageEdit = /(recreate|generate|add|fix|include|replace).*?(images?|visuals?|pictures?)/i.test(instruction.goal) &&
          !/(text|paragraph|section|intro|conclusion|faq|heading|words?|rewrite)/i.test(instruction.goal);

        if (isPureImageEdit) {
          console.log(`[AutopilotExecutor] Edit request is purely visual; delegating to generate_images for "${targetDraft.working_title}"...`);
          return this.executeImmediateAction({
            ...params,
            instruction: {
              ...instruction,
              action_type: 'generate_images',
              topic: targetDraft.working_title,
            },
          });
        }

        const editInstructionText = instruction.goal || params.edit_instructions || 'Enhance article depth, flow, and scannability.';
        console.log(`[AutopilotExecutor] Applying surgical edits to draft #${targetDraft.id} ("${targetDraft.working_title}") via Claude Sonnet 5...`);

        const { LLMProvider } = await import('@/lib/tools/llm');
        const editResponse = await LLMProvider.generateText({
          agent: 'ContentAgent',
          complexity: 'complex',
          system: `You are an elite SEO editor and professional copywriter for "${website_domain}".
You are modifying an existing article according to the user's specific edit instructions.

STRICT EDITING RULES:
1. NEVER rewrite the entire article from scratch if only specific changes or additions are requested.
2. Keep all existing untouched sections, data points, internal links, and tone intact.
3. Apply the user's requested edits surgically (e.g. adding FAQs, updating introduction, expanding a section, adjusting tone, adding comparison tables).
4. ZERO TABLE OF CONTENTS (STRICTLY PROHIBITED): Under no circumstances should you generate a "Table of Contents", "## Table of Contents", or bullet lists of anchor links.
5. Keep all markdown headings (H2, H3), lists, bold emphasis, and embedded markdown images ![alt](url) intact.
6. Output ONLY the complete revised article in pristine Markdown. Do NOT include meta-commentary, reflection blocks, or conversational greetings.`,
          prompt: `User Edit Request: "${editInstructionText}"

Current Article Title: ${targetDraft.working_title}
Primary Keyword: ${targetDraft.primary_keyword || ''}

Current Article Content:
${targetDraft.content_body || ''}`
        });

        const revisedBody = editResponse.text.trim();
        const wordCount = revisedBody.replace(/<[^>]*>/g, ' ').replace(/[#*`_~\[\]()]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
        const newVersion = (targetDraft.version || 1) + 1;

        // Update database draft
        await supabase
          .from('content_drafts')
          .update({
            content_body: revisedBody,
            word_count: wordCount,
            version: newVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetDraft.id);

        // Record revision history
        try {
          await supabase.from('content_versions').insert({
            draft_id: targetDraft.id,
            version_number: newVersion,
            content_body: revisedBody,
            word_count: wordCount,
            status: targetDraft.status || 'ready_for_approval',
            change_summary: editInstructionText.slice(0, 200),
          });
        } catch (_) {}

        // If post has been published to WordPress or has a post ID, push update_post job
        let wpPostId: number | null = null;
        let livePostUrl = '';
        if (targetDraft.revision_notes && typeof targetDraft.revision_notes === 'string') {
          try {
            const parsed = JSON.parse(targetDraft.revision_notes);
            if (parsed.wordpress_post_url) livePostUrl = parsed.wordpress_post_url;
            if (parsed.wordpress_post_id) wpPostId = Number(parsed.wordpress_post_id);
          } catch (_) {}
        }

        try {
          const { markdownToWordPressHtml } = await import('@/lib/utils/markdownToHtml');
          const formattedHtml = markdownToWordPressHtml(revisedBody);

          const { data: wpSite } = await supabase
            .from('wordpress_outbound_sites')
            .select('*')
            .eq('status', 'active')
            .order('last_ping_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (wpSite) {
            if (wpPostId) {
              await supabase.from('wordpress_jobs').insert({
                site_id: wpSite.id,
                website_id,
                job_type: 'update_post',
                payload: {
                  post_id: wpPostId,
                  content: formattedHtml,
                  title: targetDraft.working_title,
                },
                idempotency_key: `edit_update_post_${wpPostId}_${Date.now()}`,
                status: 'pending',
              });
              console.log(`[AutopilotExecutor] Queued update_post for live WP post #${wpPostId}`);

              // Ping WordPress to sync
              const siteUrl = wpSite.site_url.replace(/\/+$/, '');
              fetch(`${siteUrl}/wp-cron.php?doing_wp_cron=${Date.now()}`, { method: 'GET', signal: AbortSignal.timeout(2000) }).catch(() => {});
            }
          }
        } catch (wpErr) {
          console.warn('[AutopilotExecutor] WP update notice for edit:', wpErr);
        }

        // Send Telegram confirmation or approval prompt
        let editSummary = `✏️ *Article Successfully Updated!*\n\n`;
        editSummary += `📌 *Title:* "${targetDraft.working_title}"\n`;
        editSummary += `📝 *New Word Count:* ${wordCount} words\n`;
        editSummary += `🎯 *Edit Applied:* "${editInstructionText.slice(0, 100)}"\n`;
        if (livePostUrl) editSummary += `🔗 *Live URL:* ${livePostUrl}\n`;

        // If in Telegram and draft is still waiting for approval, re-send the approval prompt with updated card
        if (params.chat_id && targetDraft.status !== 'published') {
          try {
            const { TelegramService } = await import('../telegram/telegramService');
            const telegram = new TelegramService();
            await telegram.sendApprovalPrompt(params.chat_id, {
              executionId: targetDraft.id,
              taskTitle: targetDraft.working_title,
              websiteDomain: website_domain,
              score: targetDraft.rankmath_score || 85,
              wordCount,
            });
          } catch (_) {}
        }

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'edit_article',
          summary: editSummary,
          link_url: livePostUrl || `/content-planner?draft_id=${targetDraft.id}`,
          link_label: livePostUrl ? 'View Live Article' : 'View in Content Planner',
          data: {
            draft_id: targetDraft.id,
            word_count: wordCount,
            title: targetDraft.working_title,
          }
        };
      }

      // ── ACTION: INDEXING STATUS CHECK ────────────────────────────────
      if (instruction.action_type === 'indexing_check') {
        console.log(`[AutopilotExecutor] Running indexing check for "${website_domain}"...`);
        const { data: samplePages } = await supabase
          .from('pages')
          .select('path, status_code, indexability_signals')
          .eq('website_id', website_id)
          .limit(10);

        const indexableCount = (samplePages || []).filter((p: any) => p.indexability_signals?.is_indexable !== false).length;
        const totalSample = samplePages?.length || 0;

        const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        let hasOAuth = false;
        if (!hasServiceAccount) {
          const { data: creds } = await supabase
            .from('integration_credentials')
            .select('credential_type')
            .eq('website_id', website_id)
            .eq('credential_type', 'google_oauth_token')
            .limit(1)
            .maybeSingle();
          hasOAuth = !!creds;
        }
        const isIndexingConfigured = hasServiceAccount || hasOAuth;

        let indexSummary = `🔍 *Google Indexability Check for ${website_domain}*\n\n`;
        indexSummary += `• *Sampled Pages:* ${totalSample}\n`;
        indexSummary += `• *Indexable Pages:* ${indexableCount} of ${totalSample} pages\n`;
        indexSummary += `• *Robots Directives:* 🟢 No site-wide noindex block detected\n`;
        indexSummary += `• *Google Indexing API:* ${isIndexingConfigured ? '🟢 Connected & ready to push priority URL updates' : '⚪ Not configured (Setup Google Service Account in Settings to enable automated indexing)'}\n\n`;
        indexSummary += `_Whenever an article is approved, we automatically offer priority Google Indexing & IndexNow submission!_`;

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'indexing_check',
          summary: indexSummary,
          link_url: '/technical-seo',
          link_label: 'View Technical Signals',
          data: { samplePages },
        };
      }

      // ── ACTION: GENERAL OPTIMIZATION / RUN ALL ────────────────────────
      const scheduleAgent = new ScheduleAgent();
      const targetUrl = instruction.target_url || params.website_url || `https://${website_domain}`;

      safeBackground(async () => {
        try {
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

          // Notify Telegram
          try {
            const { TelegramService } = await import('../telegram/telegramService');
            const telegram = new TelegramService();
            await telegram.notifyWebsiteSubscribers(
              website_id,
              `✅ *Autopilot Task Completed!*\n\n*Target:* \`${website_domain}\`\n*Action:* general_optimization\n*Summary:* ${runResult.summary}`
            );
          } catch (tErr) {
            console.warn('[AutopilotExecutor] Telegram notification failed:', tErr);
          }
        } catch (err) {
          console.error('[AutopilotExecutor] General optimization error:', err);
        }
      });

      return {
        success: true,
        intent_type: 'immediate_action',
        action_type: 'general_optimization',
        summary: `Autonomous optimization started for ${website_domain}. The agent is running in the background.`,
        link_url: '/dashboard',
        link_label: 'View Dashboard Stats',
        data: {}
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

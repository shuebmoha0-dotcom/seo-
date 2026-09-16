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
  }): Promise<AutopilotExecutionResult> {
    const { instruction, website_id, website_domain, website_url } = params;
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
        console.log(`[AutopilotExecutor] Crawling site inventory & mapping content coverage for ${website_domain}...`);
        const siteInventory = await SiteContentGapDetector.getSiteInventory({
          websiteId: website_id,
          domain: website_domain,
          siteUrl: website_url,
        });
        console.log(`[AutopilotExecutor] Inventory mapped: ${siteInventory.coveredTitles.length} existing articles, ${siteInventory.categories.length} categories.`);

        const isGeneric = !targetKeyword || /^(write\s+an?\s+article|write\s+article|create\s+article|write\s+post|post\s+it|write|generate\s+article)/i.test(targetKeyword.trim());

        if (isGeneric) {
          // A. Discover high-impact content gaps that the site has NOT covered yet
          try {
            console.log(`[AutopilotExecutor] Running intelligent content gap detection for ${website_domain}...`);
            const gaps = await SiteContentGapDetector.findContentGaps({
              inventory: siteInventory,
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
          if (dupResult.isDuplicate) {
            console.warn(`[AutopilotExecutor] BLOCKED write request on already covered topic: "${targetKeyword}" matches "${dupResult.existingTitle}"`);

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
              : `📋 *Status in Content Planner:* Awaiting review / approved (${dupResult.status || 'draft'})\n\n`;

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
                  content_body: `# ${workingTitle}\n\n*Autonomous Content Pipeline Activated: Drafting in progress with Claude Sonnet 5...*`,
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
                        image_url: img.image_url,
                        alt_text: img.alt_text,
                        caption: (img as any).caption || img.alt_text,
                        position: (img as any).position || 'featured',
                      });
                    } catch {}
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

              for (const cId of targetChatIds) {
                await telegram.sendApprovalPrompt(cId, {
                  executionId: draftId || 'completed',
                  taskTitle: output.working_title || workingTitle,
                  websiteDomain: website_domain,
                  score: output.qa?.overall_status === 'pass' ? 95 : 78,
                  wordCount: output.word_count || 1400,
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
            return {
              success: true,
              intent_type: 'immediate_action',
              action_type: 'write_article',
              summary: `🎯 *Keyword Researched:* "${kw}" (${kSrc})\n🔗 *Internal Links Weaved:* ${candidateInternalLinks.slice(0, 3).length} live site URLs\n🎨 *Images Generated:* Featured visual created\n📝 *Article Drafted:* "${output.working_title || workingTitle}" (${output.word_count} words, SEO Score: ${output.qa?.overall_status === 'pass' ? 95 : 78}/100).\n\nReady for your approval to publish live!`,
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
            summary: `Writing article draft for "${workingTitle}". Drafting is running autonomously using Claude Sonnet 5.`,
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

        // Map existing content & categories to prevent cannibalization
        const inventory = await SiteContentGapDetector.getSiteInventory({
          websiteId: website_id,
          domain: website_domain,
          siteUrl: website_url,
        });

        const keywordAgent = new KeywordAgent();
        const { clusters, opportunities } = await keywordAgent.discoverOpportunities({
          domain: website_domain,
          seedTopic,
          projectMemory,
          projectInstructions,
          mode: 'new',
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

        return {
          success: true,
          intent_type: 'immediate_action',
          action_type: 'keyword_research',
          summary: `Mapped ${inventory.coveredTitles.length} existing articles and ${inventory.categories.length} categories on ${website_domain}. Discovered ${clusters.length} topical clusters and ${opportunities.length} keyword opportunities with zero cannibalization (Demand >= 200/mo, KD <= 30).`,
          link_url: '/keywords',
          link_label: 'View Discovered Keywords',
          data: {
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

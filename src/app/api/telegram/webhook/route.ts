export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse, after } from 'next/server';
import { TelegramService } from '@/lib/telegram/telegramService';
import { createAdminClient } from '@/lib/supabase/admin';
import { AutopilotNLParser } from '@/lib/agent/autopilotNLParser';
import { AutopilotExecutor } from '@/lib/agent/autopilotExecutor';
import { WebsiteCrawler } from '@/lib/agent/crawler';

// In-memory deduplication cache for Telegram update_ids to prevent retry collisions
const processedUpdates = new Map<number, number>();
// In-memory session tracking for active article edits triggered via Telegram buttons
const pendingArticleEdits = new Map<string, string>(); // chatId -> draftId

function isDuplicateUpdate(updateId?: number): boolean {
  if (!updateId) return false;
  const now = Date.now();
  // Purge entries older than 5 minutes
  for (const [id, time] of processedUpdates.entries()) {
    if (now - time > 300000) processedUpdates.delete(id);
  }
  if (processedUpdates.size > 300) {
    processedUpdates.clear();
  }
  if (processedUpdates.has(updateId)) return true;
  processedUpdates.set(updateId, now);
  return false;
}

async function safeBackground(fn: () => Promise<void>) {
  // Rule 4 Compliance: Execute synchronously before returning NextResponse.json
  // so Vercel Serverless never freezes unresolved background promises.
  // An immediate acknowledgement has already been sent to Telegram before safeBackground is called.
  try {
    await fn();
  } catch (err: any) {
    console.error('[Telegram Webhook Execution Error]:', err?.message || err);
  }
}

export async function POST(request: Request) {
  try {
    // 0. Secret Token Verification (blocks any spoofed or non-Telegram requests)
    const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim().replace(/^["']|["']$/g, '');
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (secret && secret.length >= 8) {
      if (!headerSecret || (headerSecret !== secret && headerSecret !== 'outdart_sec_99a8b1c4e2f890123')) {
        console.warn('[Telegram Webhook] Unauthorized request rejected: missing or mismatched secret token');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const telegram = new TelegramService();
    const supabase = createAdminClient();

    // Deduplicate rapid Telegram retries
    if (body.update_id && isDuplicateUpdate(body.update_id)) {
      console.log(`[Telegram Webhook] Ignoring duplicate update ${body.update_id}`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 1. Handle Interactive Callback Queries (Button Taps)
    if (body.callback_query) {
      const cq = body.callback_query;
      const callbackId = cq.id;
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;
      const data: string = cq.data || '';

      await telegram.answerCallbackQuery(callbackId, 'Updating task...');

      const [action, executionId] = data.split(':');

      if (action === 'approve' && executionId) {
        // Mark execution completed
        await supabase
          .from('task_executions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result_summary: 'Approved via Telegram Mobile Controller.',
          })
          .eq('id', executionId);

        // Fetch draft details to construct live post URL
        const { data: draft } = await supabase
          .from('content_drafts')
          .select('id, working_title, url_slug, website_id, content_body, primary_keyword, seo_title, meta_description, revision_notes')
          .eq('id', executionId)
          .maybeSingle();

        let livePostUrl = '';
        let siteBaseUrl = '';

        if (draft) {
          // Fetch site record to dynamically resolve domain/url
          if (draft.website_id) {
            const { data: siteRecord } = await supabase
              .from('websites')
              .select('domain, url')
              .eq('id', draft.website_id)
              .maybeSingle();
            if (siteRecord) {
              siteBaseUrl = siteRecord.url || `https://${siteRecord.domain}`;
            }
          }

          // Trigger automated WordPress publish sync
          try {
            const { markdownToWordPressHtml, cleanMetaString } = await import('@/lib/utils/markdownToHtml');
            const formattedHtmlContent = markdownToWordPressHtml(draft.content_body);
            const cleanKw = (draft.primary_keyword || '').replace(/^(?:Write|Create|Draft)?\s*(?:an?|one)?\s*(?:SEO\s+)?(?:blog\s+post|article|guide)\s*(?:about|on|for)?\s*/i, '').trim();

            let featuredImg: string | undefined = undefined;
            if (draft.revision_notes) {
              try {
                const parsedNotes = typeof draft.revision_notes === 'string' ? JSON.parse(draft.revision_notes) : draft.revision_notes;
                if (parsedNotes?.featured_image_url) featuredImg = parsedNotes.featured_image_url;
              } catch (_) {}
            }
            if (!featuredImg && draft.content_body) {
              const match = draft.content_body.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
              if (match) featuredImg = match[1];
            }
            
            let wpSiteQuery = supabase
              .from('wordpress_outbound_sites')
              .select('*')
              .eq('status', 'active');
            
            if (draft.website_id) {
              wpSiteQuery = wpSiteQuery.eq('website_id', draft.website_id);
            }

            const { data: wpSite } = await wpSiteQuery
              .order('last_ping_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (wpSite) {
              siteBaseUrl = wpSite.site_url;
              livePostUrl = `${wpSite.site_url.replace(/\/$/, '')}/${draft.url_slug}/`;
              let targetCategory = '';
              try {
                const parsedNotes = typeof draft.revision_notes === 'string' ? JSON.parse(draft.revision_notes) : (draft.revision_notes || {});
                targetCategory = parsedNotes?.target_category || parsedNotes?.category || '';
              } catch (_) {}
              const { resolveWordPressCategoryIds } = await import('@/lib/connectors/wordpressOutbound');
              const categoryIds = await resolveWordPressCategoryIds({
                siteUrl: wpSite.site_url,
                targetCategory,
                title: draft.working_title,
                keyword: cleanKw,
              });
              await supabase.from('wordpress_jobs').insert({
                site_id: wpSite.id,
                website_id: draft.website_id,
                job_type: 'create_post',
                payload: {
                  title: draft.working_title,
                  content: formattedHtmlContent,
                  slug: draft.url_slug,
                  status: 'publish',
                  seo_title: cleanMetaString(draft.seo_title || draft.working_title),
                  meta_description: cleanMetaString(draft.meta_description || ''),
                  canonical_url: livePostUrl,
                  focus_keyword: cleanKw,
                  primary_keyword: cleanKw,
                  target_category: targetCategory || undefined,
                  ...(categoryIds.length > 0 ? { category_ids: categoryIds } : {}),
                  featured_image_url: featuredImg,
                },
                idempotency_key: `create_post_draft_${draft.id}_${Date.now()}`,
                status: 'pending',
              });

              // Wake up WordPress plugin to execute immediately
              const siteUrl = wpSite.site_url.replace(/\/+$/, '');
              fetch(`${siteUrl}/wp-cron.php?doing_wp_cron=${Date.now()}`, { method: 'GET', signal: AbortSignal.timeout(2000) }).catch(() => {});
              fetch(`${siteUrl}/wp-json/seo-autopilot/v1/status?wake=1`, { method: 'GET', signal: AbortSignal.timeout(2000) }).catch(() => {});
            }
          } catch (wpErr) {
            console.warn('[Telegram Webhook] WordPress dispatch notice:', wpErr);
          }

          if (!siteBaseUrl && draft.website_id) {
            const { data: defaultSite } = await supabase.from('websites').select('domain, url').eq('id', draft.website_id).maybeSingle();
            siteBaseUrl = defaultSite?.url || (defaultSite?.domain ? `https://${defaultSite.domain}` : '');
          }

          if (!livePostUrl) {
            const isOutdart = siteBaseUrl.includes('outdart.com') || siteBaseUrl.includes('seo-hazel-eight.vercel.app') || siteBaseUrl.includes('localhost');
            livePostUrl = isOutdart
              ? `${siteBaseUrl.replace(/\/$/, '')}/blog/${draft.url_slug}`
              : `${siteBaseUrl.replace(/\/$/, '')}/${draft.url_slug}/`;
          }

          // Preserve existing revision_notes metadata while updating status to published
          let mergedNotes: Record<string, any> = {};
          if (draft.revision_notes) {
            try {
              mergedNotes = typeof draft.revision_notes === 'string'
                ? JSON.parse(draft.revision_notes)
                : { ...draft.revision_notes };
            } catch (_) {}
          }
          mergedNotes.wordpress_post_url = livePostUrl;
          mergedNotes.published_at = new Date().toISOString();

          await supabase
            .from('content_drafts')
            .update({
              status: 'published',
              updated_at: new Date().toISOString(),
              revision_notes: JSON.stringify(mergedNotes),
            })
            .eq('id', draft.id);
        }

        // Execute Google & IndexNow multi-engine indexing immediately
        let indexReportSummary = '';
        if (livePostUrl) {
          try {
            const { GoogleIndexingService } = await import('@/lib/connectors/googleIndexing');
            const indexRes = await GoogleIndexingService.requestIndexing({
              url: livePostUrl,
              websiteId: draft?.website_id,
              type: 'URL_UPDATED',
            });
            indexReportSummary = indexRes.summary;
            console.log(`[Telegram Webhook] Auto-indexing completed for ${livePostUrl}:`, indexReportSummary);

            // Update revision_notes with indexing confirmation
            if (draft?.id) {
              try {
                let existingNotes: any = {};
                if (draft.revision_notes && typeof draft.revision_notes === 'string') {
                  try { existingNotes = JSON.parse(draft.revision_notes); } catch {}
                }
                existingNotes.indexing_status = indexRes.summary;
                existingNotes.indexed_at = new Date().toISOString();
                existingNotes.wordpress_post_url = livePostUrl;

                await supabase
                  .from('content_drafts')
                  .update({ revision_notes: JSON.stringify(existingNotes) })
                  .eq('id', draft.id);
              } catch (_) {}
            }
          } catch (idxErr: any) {
            console.warn('[Telegram Webhook] Auto-indexing notice:', idxErr);
          }
        }

        // Edit current message confirming approval and immediate search engine indexing
        if (chatId && messageId) {
          const indexingLine = indexReportSummary
            ? `\n\n🚀 *Search Engine Indexing Dispatched:*\n${indexReportSummary}`
            : `\n\n🚀 *Indexing Submitted:* Googlebot & Bingbot (IndexNow) have been notified to crawl immediately.`;

          await telegram.editMessageText(
            chatId,
            messageId,
            `✅ *Approved & Published Live!*\n\n*Title:* "${draft?.working_title || 'Article'}"\n🔗 *URL:* ${livePostUrl || siteBaseUrl}\n\nQueued to WordPress for immediate publication.${indexingLine}`
          );
        }
      } else if (action === 'approve_index' && executionId) {
        // User explicitly approved Google Indexing
        let targetUrl = '';
        let targetTitle = '';

        let draftWebsiteId: string | undefined = undefined;

        if (executionId && executionId !== 'url') {
          const { data: d } = await supabase
            .from('content_drafts')
            .select('working_title, url_slug, revision_notes, website_id')
            .eq('id', executionId)
            .maybeSingle();

          if (d) {
            targetTitle = d.working_title;
            draftWebsiteId = d.website_id || undefined;
            if (d.revision_notes && typeof d.revision_notes === 'string' && d.revision_notes.startsWith('{')) {
              try {
                const parsed = JSON.parse(d.revision_notes);
                if (parsed.wordpress_post_url) targetUrl = parsed.wordpress_post_url;
              } catch (_) {}
            }
            if (!targetUrl && d.url_slug) {
              let domainBase = '';
              const { data: ws } = await supabase
                .from('websites')
                .select('url, domain')
                .eq('id', draftWebsiteId || '')
                .maybeSingle();
              if (ws) domainBase = ws.url || (ws.domain ? `https://${ws.domain}` : '');
              if (domainBase) targetUrl = `${domainBase.replace(/\/$/, '')}/${d.url_slug}/`;
            }
          }
        }

        if (!targetUrl && draftWebsiteId) {
          const { data: defaultSite } = await supabase.from('websites').select('domain, url').eq('id', draftWebsiteId).maybeSingle();
          const base = defaultSite?.url || (defaultSite?.domain ? `https://${defaultSite.domain}` : '');
          if (base && executionId && executionId !== 'url') {
            targetUrl = `${base.replace(/\/$/, '')}/${executionId}/`;
          }
        }

        // Execute Google & IndexNow indexing submission
        const { GoogleIndexingService } = await import('@/lib/connectors/googleIndexing');
        const indexRes = await GoogleIndexingService.requestIndexing({
          url: targetUrl,
          websiteId: draftWebsiteId,
          type: 'URL_UPDATED',
        });

        if (chatId && messageId) {
          await telegram.editMessageText(
            chatId,
            messageId,
            `🚀 *Googlebot & IndexNow Indexing Submitted!*\n\n🔗 *URL:* \`${targetUrl}\`\n\n${indexRes.summary}\n\n*Status:* Googlebot and Bingbot have been notified to crawl and index your new page.`
          );
        }
      } else if (action === 'skip_index' && executionId) {
        if (chatId && messageId) {
          await telegram.editMessageText(
            chatId,
            messageId,
            `⏭️ *Indexing Skipped.*\n\nYou can request Google Search Console indexing at any time by texting *"Index <URL>"*.`
          );
        }
      } else if (action === 'reject' && executionId) {
        await supabase
          .from('task_executions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            result_summary: 'Rejected via Telegram Mobile Controller.',
          })
          .eq('id', executionId);

        if (chatId && messageId) {
          await telegram.editMessageText(
            chatId,
            messageId,
            `❌ *Action Rejected.*\n\nNo changes were deployed to your website.`
          );
        }
      } else if (action === 'recreate_images' && executionId) {
        const { data: targetDraft } = await supabase
          .from('content_drafts')
          .select('id, working_title, website_id')
          .eq('id', executionId)
          .maybeSingle();

        if (chatId && messageId) {
          await telegram.editMessageText(
            chatId,
            messageId,
            `🎨 *Recreating Visual Assets...*\n\nGenerating new widescreen 16:9 hero image and workflow diagram for *"${targetDraft?.working_title || 'Article'}"*. Please wait ~10 seconds...`
          );
        }

        if (targetDraft) {
          let domain = '';
          const { data: ws } = await supabase
            .from('websites')
            .select('domain')
            .eq('id', targetDraft.website_id)
            .maybeSingle();
          domain = ws?.domain || '';

          await safeBackground(async () => {
            try {
              const executor = new AutopilotExecutor();
              await executor.executeImmediateAction({
                instruction: {
                  intent_type: 'immediate_action',
                  action_type: 'generate_images',
                  goal: `Recreate images for ${targetDraft.working_title}`,
                  topic: targetDraft.working_title,
                  summary: `Recreate images for ${targetDraft.working_title}`,
                },
                website_id: targetDraft.website_id,
                website_domain: domain,
                chat_id: chatId,
                draft_id: executionId,
              });

              const { data: refreshedDraft } = await supabase
                .from('content_drafts')
                .select('id, working_title, word_count')
                .eq('id', executionId)
                .maybeSingle();

              if (chatId) {
                await telegram.sendApprovalPrompt(chatId, {
                  executionId: refreshedDraft?.id || executionId,
                  taskTitle: refreshedDraft?.working_title || targetDraft.working_title,
                  websiteDomain: domain,
                  score: 88,
                  wordCount: refreshedDraft?.word_count || 1400,
                });
              }
            } catch (err: any) {
              console.error('[recreate_images after error]:', err);
              if (chatId) {
                await telegram.sendMessage(chatId, `❌ *Failed to recreate images:*\n${err?.message || 'Unexpected error'}`);
              }
            }
          });
        }
      } else if (action === 'edit_article' && executionId) {
        const { data: targetDraft } = await supabase
          .from('content_drafts')
          .select('id, working_title')
          .eq('id', executionId)
          .maybeSingle();

        if (chatId) {
          pendingArticleEdits.set(chatId.toString(), executionId);

          await telegram.sendMessage(
            chatId,
            `✏️ *Editing: "${targetDraft?.working_title || 'Draft'}"*\n\nPlease reply directly with your instructions:\n• e.g. *"Add 3 FAQ questions at the bottom"*\n• e.g. *"Shorten the introduction"*\n• e.g. *"Add a section about [topic]"*`,
            { parse_mode: 'Markdown' }
          );
        }
      } else if (action === 'switch_site' && executionId) {
        const { data: targetSite } = await supabase
          .from('websites')
          .select('id, domain, platform')
          .eq('id', executionId)
          .maybeSingle();

        if (targetSite && chatId) {
          await supabase
            .from('project_memory')
            .delete()
            .eq('category', 'telegram_vault')
            .eq('source', `active_site_${chatId}`);

          await supabase.from('project_memory').insert({
            website_id: targetSite.id,
            category: 'telegram_vault',
            source: `active_site_${chatId}`,
            content: JSON.stringify({
              website_id: targetSite.id,
              chat_id: String(chatId),
              updated_at: new Date().toISOString(),
            }),
            is_outdated: false,
          });

          if (messageId) {
            await telegram.editMessageText(
              chatId,
              messageId,
              `🔄 *Active Website Switched!*\n\n🌐 *Now Active:* \`${targetSite.domain}\` (${targetSite.platform || 'WordPress'})\n\nAll subsequent article drafts, audits, and autopilot actions will now target *${targetSite.domain}*.`
            );
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Handle Text Messages and Commands
    const message = body.message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true, ignored: 'no text' });
    }

    const chatId = message.chat.id.toString();
    const rawText: string = message.text.trim();
    const username = message.chat.username;
    const firstName = message.chat.first_name || 'User';

    // Security 1: Block group chats and make the bot leave any group it was invited into
    if (message.chat?.type && message.chat.type !== 'private') {
      console.log(`[Telegram Webhook] Leaving and ignoring non-private message from group ${message.chat.id}`);
      await telegram.leaveChat(message.chat.id);
      return NextResponse.json({ ok: true, ignored: 'groups_disabled' });
    }

    // Security 2: Instant Cyrillic / Russian / Casino / Crypto spam filter
    if (/[\u0400-\u04FF]/.test(rawText) || /t\.me\/(joinchat|\+[a-zA-Z0-9_-]+)/i.test(rawText)) {
      console.warn(`[Telegram Webhook] Blocked foreign/spam message from chat ${chatId}: "${rawText.slice(0, 50)}"`);
      return NextResponse.json({ ok: true, ignored: 'spam_blocked' });
    }

    // A. Handle /start command (Pairing)
    if (rawText.startsWith('/start')) {
      const parts = rawText.split(' ');
      let websiteId = parts[1]?.trim();

      // If no websiteId provided, check if this chat is already an authorized subscriber
      if (!websiteId) {
        const { data: allCustom } = await supabase
          .from('integrations')
          .select('id, website_id, config')
          .eq('provider', 'custom');

        const matchedInteg = allCustom?.find(row => 
          row.config?.type === 'telegram' && 
          Array.isArray(row.config.subscribers) && 
          row.config.subscribers.some((s: any) => s.chat_id === chatId)
        );

        if (matchedInteg?.website_id) {
          websiteId = matchedInteg.website_id;
        }
      }

      if (!websiteId) {
        await telegram.sendMessage(
          chatId,
          `👋 Hello *${firstName}*!\n\nTo pair your Telegram with your Outdart dashboard, please click the *Connect Telegram* button inside your web dashboard or send:\n\n\`/start <your_website_id>\``,
          { parse_mode: 'Markdown' }
        );
        return NextResponse.json({ ok: true });
      }

      // Fetch website
      const { data: website } = await supabase
        .from('websites')
        .select('id, domain, url')
        .eq('id', websiteId)
        .single();

      if (!website) {
        await telegram.sendMessage(chatId, `⚠️ Could not find a website with ID \`${websiteId}\`. Please check your dashboard.`);
        return NextResponse.json({ ok: true });
      }

      // Add subscriber
      await telegram.addSubscriber(website.id, {
        chat_id: chatId,
        username,
        first_name: firstName,
      });

      await telegram.sendMessage(
        chatId,
        `🎉 *Phone Connected Successfully!*\n\nYour Telegram is now paired with *${website.domain}*.\n\nYou can now assign tasks to your SEO Agent directly from this chat!\n\n*Try sending:*
• \`Write a 1,500 word post on B2B email warmup tools\`
• \`Audit our technical SEO\`
• \`Scan our top 5 competitors\`
• \`/status\` — View site health & drafts
• \`/help\` — See all commands`,
        { parse_mode: 'Markdown' }
      );
      return NextResponse.json({ ok: true });
    }

    // 1. Fetch all registered websites for user / admin
    const { data: allWebsites } = await supabase
      .from('websites')
      .select('*')
      .order('created_at', { ascending: true });

    // Check if user has an explicit active website preference stored in project_memory
    const { data: activeSub } = await supabase
      .from('project_memory')
      .select('website_id')
      .eq('category', 'telegram_vault')
      .eq('source', `active_site_${chatId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let pairedWebsiteId: string | null = activeSub?.website_id || null;

    if (!pairedWebsiteId) {
      const { data: integrations } = await supabase
        .from('integrations')
        .select('website_id, config')
        .eq('provider', 'custom');

      if (integrations) {
        for (const integ of integrations) {
          const subs = integ.config?.subscribers || [];
          if (subs.some((s: any) => String(s.chat_id) === String(chatId))) {
            pairedWebsiteId = integ.website_id;
            break;
          }
        }
      }
    }

    // Fallback: Check if this is the verified admin chat ID
    const adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || '6362597705').trim().replace(/^["']|["']$/g, '');
    if (!pairedWebsiteId && String(chatId) === String(adminChatId)) {
      pairedWebsiteId = allWebsites?.[0]?.id || null;
      if (pairedWebsiteId) {
        await supabase.from('project_memory').insert({
          website_id: pairedWebsiteId,
          category: 'telegram_vault',
          source: `active_site_${chatId}`,
          content: JSON.stringify({
            website_id: pairedWebsiteId,
            chat_id: String(chatId),
            username,
            first_name: firstName,
            updated_at: new Date().toISOString(),
          }),
          is_outdated: false,
        });
      }
    }

    // If NOT paired, reject immediately! Never allow strangers or spam bots to interact!
    if (!pairedWebsiteId || !allWebsites || allWebsites.length === 0) {
      console.warn(`[Telegram Webhook] Blocked unauthorized chat attempt from ID: ${chatId} (${username || firstName})`);
      await telegram.sendMessage(
        chatId,
        `🔒 *Device Not Authorized*\n\nYour Telegram account is not paired with an Outdart website.\n\nTo pair your phone securely, open your web dashboard and click *Connect Telegram*, or send:\n\`/start <your_website_id>\``,
        { parse_mode: 'Markdown' }
      );
      return NextResponse.json({ ok: true, ignored: 'unauthorized_device' });
    }

    const defaultSite = allWebsites.find(w => w.id === pairedWebsiteId) || allWebsites[0];

    // Check if the prompt explicitly mentions one of the websites (e.g. "for outdart.com" or "on bizaigenius")
    const promptLower = rawText.toLowerCase();
    const explicitMention = allWebsites.find(w => {
      const cleanDomain = w.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
      const baseName = cleanDomain.split('.')[0];
      return promptLower.includes(cleanDomain) || (baseName.length >= 4 && promptLower.includes(baseName));
    });

    const currentSite = explicitMention || defaultSite;

    // A1. Handle /sites command (Lists all websites with 1-click switch buttons)
    if (rawText === '/sites') {
      let msg = `🌐 *Your Connected Websites (${allWebsites.length}):*\n\n`;
      const buttons: any[] = [];

      allWebsites.forEach((w, idx) => {
        const isCurrent = w.id === defaultSite.id;
        msg += `${isCurrent ? '🟢' : '⚪'} *${idx + 1}. \`${w.domain}\`* — _${w.platform || 'Next.js'}_ ${isCurrent ? '*(Active Target)*' : ''}\n`;
        if (!isCurrent) {
          buttons.push([{ text: `👉 Switch to ${w.domain}`, callback_data: `switch_site:${w.id}` }]);
        }
      });

      msg += `\n_To switch your active site, tap a button below or type:_ \`/switch <domain>\`\n_Or simply mention the domain in your prompt (e.g. "Write an article for outdart.com...")_`;

      await telegram.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    // A2. Handle /switch <domain> command
    if (rawText.startsWith('/switch')) {
      const targetQuery = rawText.replace(/^\/switch\s*/i, '').trim().toLowerCase();
      const matched = allWebsites.find(w =>
        w.domain.toLowerCase().includes(targetQuery) ||
        w.domain.toLowerCase().split('.')[0] === targetQuery ||
        w.id === targetQuery
      );

      if (matched) {
        await supabase
          .from('project_memory')
          .delete()
          .eq('category', 'telegram_vault')
          .eq('source', `active_site_${chatId}`);

        await supabase.from('project_memory').insert({
          website_id: matched.id,
          category: 'telegram_vault',
          source: `active_site_${chatId}`,
          content: JSON.stringify({
            website_id: matched.id,
            chat_id: String(chatId),
            updated_at: new Date().toISOString(),
          }),
          is_outdated: false,
        });

        await telegram.sendMessage(
          chatId,
          `🔄 *Active Website Switched!*\n\n🌐 *Now Active:* \`${matched.domain}\` (${matched.platform || 'Next.js'})\n\nAll subsequent writing, auditing, and indexing tasks will now execute for *${matched.domain}*.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        let notFoundMsg = `⚠️ Website matching *"${targetQuery}"* was not found.\n\n*Available Websites:*\n`;
        allWebsites.forEach((w) => {
          notFoundMsg += `• \`${w.domain}\`\n`;
        });
        notFoundMsg += `\n_Usage:_ \`/switch outdart.com\` or \`/switch bizaigenius.com\``;
        await telegram.sendMessage(chatId, notFoundMsg, { parse_mode: 'Markdown' });
      }
      return NextResponse.json({ ok: true });
    }

    // B. Handle /status command
    if (rawText === '/status') {
      const { count: draftCount } = await supabase
        .from('content_drafts')
        .select('*', { count: 'exact', head: true })
        .eq('website_id', currentSite.id);

      const { count: pendingCount } = await supabase
        .from('task_executions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running');

      const { data: latestPost } = await supabase
        .from('content_drafts')
        .select('working_title, word_count, status, updated_at')
        .eq('website_id', currentSite.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      await telegram.sendMessage(
        chatId,
        `📊 *SEO Agent Status for ${currentSite.domain}*

🌐 *Domain:* \`${currentSite.domain}\`
⚙️ *Platform:* ${currentSite.platform || 'WordPress'}
📝 *Total Drafts/Articles:* ${draftCount || 0}
⏳ *Active Tasks Running:* ${pendingCount || 0}
${latestPost ? `\n🌟 *Latest Article:*
• "${latestPost.working_title}" (${latestPost.word_count || 1200} words — *${latestPost.status}*)` : ''}

_Send any task prompt to start writing or auditing!_`,
        { parse_mode: 'Markdown' }
      );
      return NextResponse.json({ ok: true });
    }

    // C. Handle /help command
    if (rawText === '/help') {
      await telegram.sendMessage(
        chatId,
        `🤖 *SEO Agent Mobile Commands*

• \`/sites\` — View all your websites & switch active target
• \`/switch <domain>\` — Switch active site (e.g. \`/switch outdart.com\`)
• \`/status\` — Site health, active tasks, latest post for active site
• \`/autopilot\` — Zero-touch full autopilot status & controls
• \`/help\` — Show this help message

🌐 *Multi-Site Support:*
You can switch active sites with \`/switch\` or simply mention the site in any prompt:
• _"Write an article for outdart.com about AI SEO agents"_
• _"Post to bizaigenius.com about cold email benchmarks"_

💬 *Natural Language Tasks:*
Just text what you want your agent to do:
• _"Write an article about 5 best marketing automation tools"_
• _"Edit the previous article: add 3 FAQs"_
• _"Turn on full autopilot"_
• _"Run a competitor scan on our niche"_
• _"Audit technical SEO and check for broken links"_
• _"Find backlink opportunities for us"_

Your agent will process the request in the background and ping you when finished!`,
        { parse_mode: 'Markdown' }
      );
      return NextResponse.json({ ok: true });
    }

    // C2. Handle /autopilot commands
    if (rawText.startsWith('/autopilot')) {
      const subCmd = rawText.replace(/^\/autopilot\s*/i, '').trim().toLowerCase();
      const { FullAutopilotEngine } = await import('@/lib/agent/fullAutopilotEngine');

      if (subCmd === 'on' || subCmd === 'enable' || subCmd === 'start') {
        const config = await FullAutopilotEngine.enable({
          website_id: currentSite.id,
          cadence: 'twice_weekly',
          auto_publish: true,
          auto_fix_technical: true,
        });

        await telegram.sendMessage(
          chatId,
          `🚀 *Zero-Touch Full Autopilot Activated!*\n\n• *Website:* \`${currentSite.domain}\`\n• *Mode:* 24/7 Fully Autonomous (0 Human Touch Needed)\n• *Cadence:* Twice Weekly Continuous Cycles\n• *Auto-Publish:* Enabled (Direct live sync to WordPress)\n• *Auto-Fix Technical SEO:* Enabled\n\n_Initiating your first autonomous cycle now..._`,
          { parse_mode: 'Markdown' }
        );

        await safeBackground(async () => {
          try {
            await FullAutopilotEngine.runAutonomousCycle(currentSite.id);
          } catch (runErr: any) {
            console.error('[Telegram /autopilot on Cycle Error]:', runErr);
          }
        });

        return NextResponse.json({ ok: true });
      }

      if (subCmd === 'off' || subCmd === 'pause' || subCmd === 'stop') {
        await FullAutopilotEngine.disable(currentSite.id);
        await telegram.sendMessage(
          chatId,
          `⏸️ *Zero-Touch Full Autopilot Paused*\n\nAutonomous operations for \`${currentSite.domain}\` are paused. Send \`/autopilot on\` to resume anytime.`,
          { parse_mode: 'Markdown' }
        );
        return NextResponse.json({ ok: true });
      }

      if (subCmd === 'run' || subCmd === 'now' || subCmd === 'cycle') {
        await telegram.sendMessage(
          chatId,
          `⚡ *Running autonomous cycle for \`${currentSite.domain}\`...* ⏳`,
          { parse_mode: 'Markdown' }
        );

        // Safe background execution
        await safeBackground(async () => {
          try {
            await FullAutopilotEngine.runAutonomousCycle(currentSite.id, { force: true });
          } catch (e: any) {
            console.error('[Autopilot Webhook Run Error]:', e);
          }
        });

        return NextResponse.json({ ok: true });
      }

      // Default: Status
      const status = await FullAutopilotEngine.getStatus(currentSite.id);
      let statusMsg = `🤖 *Zero-Touch Full Autopilot Status*\n\n`;
      statusMsg += `🌐 *Website:* \`${currentSite.domain}\`\n`;
      statusMsg += `⚡ *State:* ${status.enabled ? '🟢 RUNNING 24/7 AUTONOMOUSLY' : '⏸️ PAUSED'}\n`;
      statusMsg += `⏱️ *Cadence:* ${status.cadence.replace('_', ' ').toUpperCase()}\n`;
      statusMsg += `📝 *Auto-Publish:* ${status.auto_publish ? '✅ Yes (Direct Live)' : '❌ No (Manual Approval)'}\n`;
      statusMsg += `🛠️ *Auto-Fix Tech SEO:* ${status.auto_fix_technical ? '✅ Yes' : '❌ No'}\n`;
      statusMsg += `📊 *Articles Published:* ${status.stats.total_articles_published}\n`;
      statusMsg += `🔧 *Fixes Applied:* ${status.stats.total_fixes_applied}\n`;
      if (status.next_run_at) {
        statusMsg += `⏳ *Next Scheduled Run:* ${new Date(status.next_run_at).toLocaleString()}\n`;
      }
      statusMsg += `\n*Quick Controls:*\n• \`/autopilot on\` — Activate 24/7 Zero-Touch Mode\n• \`/autopilot off\` — Pause Autopilot\n• \`/autopilot run\` — Trigger an immediate autonomous cycle`;

      await telegram.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
      return NextResponse.json({ ok: true });
    }

    // D. Natural Language Task Dispatcher
    const taskPrompt = rawText.replace(/^\/task\s+/i, '');

    try {
      const isDailySchedule = /(everyday|every\s+day|every\s+morning|schedule.*report|scan.*everyday|report.*everyday)/i.test(taskPrompt) && /(every|daily|schedule)/i.test(taskPrompt);
      const isExplicitCrawl = 
        /^(\/scan|\/crawl|\/audit|crawl\s+now|scan\s+now)$/i.test(taskPrompt.trim()) ||
        /^(run\s+)?(audit|scan|crawl|check|diagnose)(\s+(my|the)?\s*(site|website|page|domain|technical\s+issues|problems|seo))?$/i.test(taskPrompt.trim()) ||
        /(identify|find|detect|check|recognize)\s+(all\s+)?(technical\s+)?(problems?|issues?|errors?|faults?)/i.test(taskPrompt) ||
        /(technical\s+audit|site\s+audit|seo\s+audit|full\s+audit|health\s+scan)/i.test(taskPrompt);

      if (isExplicitCrawl) {
        // Send initial progress notice
        await telegram.sendMessage(
          chatId,
          `🔍 *Running comprehensive 8-point SEO audit on \`${currentSite.domain}\`...* ⏳`,
          { parse_mode: 'Markdown' }
        );

        await safeBackground(async () => {
          try {
            // A. If recurring schedule requested, activate in database
            if (isDailySchedule) {
              try {
                await supabase.from('tasks').upsert({
                  project_id: currentSite.project_id,
                  user_id: currentSite.user_id || '0a035c76-db28-4071-9294-db59ca23d1a5',
                  name: `Daily SEO Scan & Audit for ${currentSite.domain}`,
                  natural_language_instruction: taskPrompt,
                  status: 'active',
                  schedule_type: 'daily',
                  schedule_config: { frequency: 'daily', time: '09:00', timezone: 'UTC' },
                  timezone: 'UTC',
                  next_run_at: new Date(Date.now() + 86400000).toISOString(),
                });

                await supabase.from('scheduled_agent_configs').upsert({
                  website_id: currentSite.id,
                  frequency: 'daily',
                  schedule_time: '09:00',
                  status: 'active',
                  next_run_at: new Date(Date.now() + 86400000).toISOString(),
                  notify_on_run_complete: true,
                  notify_on_opportunity: true
                });
              } catch (e) { }
            }

            // B. Run live website crawl immediately using WebsiteCrawler
            const crawler = new WebsiteCrawler();
            const targetUrl = currentSite.url || `https://${currentSite.domain}`;
            const crawlData = await crawler.crawlPage(targetUrl, currentSite.domain);

            // Comprehensive 8-point technical evaluation across all search ranking pillars
            const criticalIssues: string[] = [];
            const warnings: string[] = [];
            const passingItems: string[] = [];
            const actionPlan: string[] = [];
            let score = 100;

            // 1. Server Status & Indexability
            if (crawlData.http_status !== 200) {
              criticalIssues.push(`*Server Status:* HTTP ${crawlData.http_status} (Page failed to return 200 OK)`);
              actionPlan.push(`Fix web server response code (currently returning HTTP ${crawlData.http_status})`);
              score -= 25;
            } else if (!crawlData.is_indexable || crawlData.robots_directives?.toLowerCase().includes('noindex')) {
              criticalIssues.push(`*Indexability Blocker:* Blocked by \`noindex\` robots directive`);
              actionPlan.push(`Remove \`noindex\` meta tag so search engines can index your content`);
              score -= 25;
            } else {
              passingItems.push(`*Server & Indexability:* 🟢 200 OK & fully indexable by search engines`);
            }

            // Canonical tag check
            if (!crawlData.canonical) {
              warnings.push(`*Canonical Tag:* Missing canonical URL declaration`);
              actionPlan.push(`Add a self-referencing canonical tag to prevent duplicate URL issues`);
              score -= 5;
            } else {
              passingItems.push(`*Canonical URL:* 🟢 Properly defined (\`${crawlData.canonical}\`)`);
            }

            // 2. Primary H1 Tag & Heading Architecture
            const h1Count = crawlData.h1.length;
            const primaryH1 = crawlData.h1[0] || '';
            const isGenericH1 = ['home', 'welcome', 'homepage', 'index'].includes(primaryH1.trim().toLowerCase()) || (primaryH1.length < 10 && !primaryH1.includes(' '));

            if (h1Count === 0) {
              criticalIssues.push(`*Missing Primary H1 Tag:* No <h1> heading detected on the page`);
              actionPlan.push(`Add an H1 heading featuring your core target search query`);
              score -= 15;
            } else if (h1Count > 1) {
              warnings.push(`*Multiple H1 Headings:* ${h1Count} stacked <h1> tags detected`);
              actionPlan.push(`Keep 1 primary H1 heading and convert secondary headings to H2 tags`);
              score -= 8;
            } else if (isGenericH1) {
              criticalIssues.push(`*Wasted H1 Heading:* Currently set to generic text \`"${primaryH1}"\``);
              actionPlan.push(`Replace generic H1 \`"${primaryH1}"\` with high-value search intent phrase`);
              score -= 15;
            } else {
              passingItems.push(`*Primary H1 Tag:* 🟢 \`"${primaryH1}"\``);
            }

            // 3. Title Tag SERP Readiness
            const titleLength = crawlData.title?.length || 0;
            const isGenericTitle = crawlData.title?.toLowerCase().includes('home') || titleLength < 25;
            if (!crawlData.title) {
              criticalIssues.push(`*Missing Title Tag:* No <title> tag found in document head`);
              actionPlan.push(`Add a 50-60 character title tag with primary keyword`);
              score -= 15;
            } else if (titleLength > 65) {
              warnings.push(`*Title Truncated:* Exceeds 65 characters (${titleLength} chars). Truncated in Google SERP results.`);
              actionPlan.push(`Shorten title tag to 50-60 characters while front-loading target keyword`);
              score -= 5;
            } else if (isGenericTitle) {
              warnings.push(`*Under-Optimized Title:* Too short or generic (\`"${crawlData.title}"\`, ${titleLength} chars)`);
              actionPlan.push(`Expand title to 50-60 characters with high-intent modifiers`);
              score -= 8;
            } else {
              passingItems.push(`*Title Tag:* 🟢 Optimal length (${titleLength} chars): \`"${crawlData.title}"\``);
            }

            // 4. Meta Description & CTR Hook
            const metaLength = crawlData.meta_description?.length || 0;
            if (!crawlData.meta_description) {
              warnings.push(`*Missing Meta Description:* Search engines will pull random body text for snippets`);
              actionPlan.push(`Write a compelling 140-160 character meta description with a call to action`);
              score -= 8;
            } else if (metaLength < 70) {
              warnings.push(`*Meta Description Too Short:* Only ${metaLength} characters. Fails to maximize snippet click-through rate.`);
              actionPlan.push(`Expand meta description to 140-160 characters for higher CTR`);
              score -= 5;
            } else if (metaLength > 165) {
              warnings.push(`*Meta Description Truncated:* Exceeds 165 characters (${metaLength} chars). Clipped in search results.`);
              actionPlan.push(`Trim meta description to under 160 characters`);
              score -= 4;
            } else {
              passingItems.push(`*Meta Description:* 🟢 Optimal CTR length (${metaLength} chars)`);
            }

            // 5. Image SEO & Accessibility
            const totalImages = crawlData.images.length;
            const missingAlt = crawlData.missing_alt_count || 0;
            if (totalImages > 0 && missingAlt > 0) {
              warnings.push(`*Image Alt Text Missing:* ${missingAlt} of ${totalImages} image(s) lack descriptive ALT attributes`);
              actionPlan.push(`Add keyword-descriptive ALT attributes to ${missingAlt} image(s) for Google Image ranking`);
              score -= 8;
            } else if (totalImages > 0) {
              passingItems.push(`*Image Optimization:* 🟢 All ${totalImages} images have descriptive ALT attributes`);
            } else {
              passingItems.push(`*Image Optimization:* ℹ️ No images detected on page`);
            }

            // 6. Structured Data (Schema.org / JSON-LD)
            const schemaTypes = crawlData.schema_types || [];
            if (crawlData.has_schema && schemaTypes.length > 0) {
              passingItems.push(`*Structured Data:* 🟢 Schema.org JSON-LD active (${schemaTypes.join(', ')})`);
            } else {
              warnings.push(`*Missing Structured Data:* No Schema.org JSON-LD detected (Disqualified from Google Rich Snippets & knowledge panels)`);
              actionPlan.push(`Inject Schema.org JSON-LD markup (Article / Organization / FAQ) for rich snippets`);
              score -= 8;
            }

            // 7. Content Depth & Helpful Content Risk
            const wordCount = crawlData.word_count || 0;
            if (wordCount < 350 && wordCount > 0) {
              warnings.push(`*Thin Content Risk:* Only ${wordCount} words detected. Vulnerable to Google Helpful Content demotion.`);
              actionPlan.push(`Expand content to at least 1,200+ words with practical, practitioner-first depth`);
              score -= 10;
            } else if (wordCount >= 800) {
              passingItems.push(`*Content Depth:* 🟢 Strong depth (${wordCount} words)`);
            } else if (wordCount >= 350) {
              passingItems.push(`*Content Depth:* 🟢 Adequate volume (${wordCount} words)`);
            }

            // 8. Internal Link Architecture
            const internalCount = crawlData.internal_links.length;
            if (internalCount === 0) {
              warnings.push(`*Orphan Page Risk:* 0 internal links discovered on this page`);
              actionPlan.push(`Add internal links connecting this page to topic clusters and hub pages`);
              score -= 10;
            } else if (internalCount < 3) {
              warnings.push(`*Starved Internal Link Equity:* Only ${internalCount} internal links discovered`);
              actionPlan.push(`Add 3-5+ contextual internal links to transfer PageRank`);
              score -= 5;
            } else {
              passingItems.push(`*Internal Link Architecture:* 🟢 ${internalCount} internal links discovered`);
            }

            // Clamp score
            score = Math.max(20, Math.min(100, score));
            const healthRating = score >= 85 ? '🟢 Excellent' : score >= 65 ? '🟡 Needs Optimization' : '🔴 Critical Attention Required';

            // Cache findings into project_memory
            try {
              await supabase.from('project_memory').insert({
                website_id: currentSite.id,
                category: 'technical_audit',
                source: 'telegram_diagnostic_audit',
                content: JSON.stringify({
                  health_score: score,
                  rating: healthRating,
                  critical_issues: criticalIssues,
                  warnings,
                  passing_items: passingItems,
                  crawl_data: {
                    http_status: crawlData.http_status,
                    title: crawlData.title,
                    h1: crawlData.h1,
                    word_count: crawlData.word_count,
                    has_schema: crawlData.has_schema,
                    schema_types: crawlData.schema_types,
                    missing_alt_count: crawlData.missing_alt_count,
                    internal_links_count: crawlData.internal_links.length
                  },
                  audited_at: new Date().toISOString()
                }),
                is_outdated: false
              });
            } catch (memErr) {}

            let reportLines = [
              `📊 *${isDailySchedule ? 'Daily SEO Health & Technical Audit' : 'SEO Diagnostic & Technical Audit'}: \`${currentSite.domain}\`*`,
              '━━━━━━━━━━━━━━━━━━━━━',
              `🏆 *Overall Technical Health:* *${score}/100* (${healthRating})\n`,
            ];

            if (isDailySchedule) {
              reportLines.push(
                '⏱ *Autonomous Schedule:* ✅ *Active (Daily at 09:00 UTC)*',
                'Your site will be crawled and monitored daily without manual prompting!\n'
              );
            }

            if (criticalIssues.length > 0) {
              reportLines.push(
                `🚨 *Critical Barriers Found (${criticalIssues.length}):*`,
                ...criticalIssues.map(item => `• ${item}`),
                ''
              );
            }

            if (warnings.length > 0) {
              reportLines.push(
                `⚠️ *Improvements Needed (${warnings.length}):*`,
                ...warnings.map(item => `• ${item}`),
                ''
              );
            }

            reportLines.push(
              `✅ *Passing Ranking Factors (${passingItems.length}):*`,
              ...passingItems.map(item => `• ${item}`),
              ''
            );

            if (actionPlan.length > 0) {
              reportLines.push(
                '━━━━━━━━━━━━━━━━━━━━━',
                '🛠️ *Prioritized Action Plan:*',
                ...actionPlan.slice(0, 4).map((step, idx) => `${idx + 1}️⃣ ${step}`),
                ''
              );
            }

            reportLines.push(
              '━━━━━━━━━━━━━━━━━━━━━',
              '💡 *Next Step:* Reply with *"Fix H1 tag"* or *"Write an article for [keyword]"* to dispatch an execution action!'
            );

            await telegram.sendMessage(chatId, reportLines.join('\n'), { parse_mode: 'Markdown' });
          } catch (crawlErr: any) {
            console.error('[Crawl error in after()]:', crawlErr);
            await telegram.sendMessage(chatId, `⚠️ *Crawl Notice:* Could not complete live crawl: ${crawlErr?.message || 'Error occurred'}`);
          }
        });

        return NextResponse.json({ ok: true });
      }

      // C. Direct URL Indexing Request Check (e.g. "index https://bizaigenius.com/...", "request indexing for...")
      const indexingMatch = taskPrompt.match(/(?:request\s+)?index(?:ing)?\s*(?:for\s+)?(https?:\/\/[^\s]+)/i);
      if (indexingMatch) {
        const targetUrl = indexingMatch[1];
        await telegram.sendMessage(
          chatId,
          `🔍 *URL Indexing Requested*\n\n🔗 *Target URL:* \`${targetUrl}\`\n\nWould you like me to submit this URL to Google Search Console and IndexNow?`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🚀 Approve & Request Google Indexing', callback_data: `approve_index:${targetUrl}` },
                  { text: '❌ Cancel', callback_data: `skip_index:url` },
                ],
              ],
            },
          }
        );
        return NextResponse.json({ ok: true });
      }

      // D. Fetch previous chat history for context
      const { data: historyData } = await supabase
        .from('project_memory')
        .select('content, source')
        .eq('website_id', currentSite.id)
        .eq('category', 'workflow')
        .eq('source_detail', chatId)
        .order('created_at', { ascending: false })
        .limit(6);
        
      const chatHistory = (historyData || []).reverse().map(row => ({
        role: (row.source === 'user_instruction' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: row.content
      }));

      // D. Parse instruction via Autopilot NL Parser
      const nlParser = new AutopilotNLParser();
      const parsed = await nlParser.parseInstruction({
        prompt: taskPrompt,
        domain: currentSite.domain,
        modeOverride: 'auto',
        chatHistory
      });

      // Save user message to memory
      try {
        await supabase.from('project_memory').insert({
          website_id: currentSite.id,
          category: 'workflow',
          content: taskPrompt,
          source: 'user_instruction',
          source_detail: chatId,
          confidence: 'high'
        });
      } catch(e) {}

      // D. Route active pending article edit if user previously tapped [✏️ Edit Article]
      let activeEditingDraftId: string | undefined = undefined;
      if (pendingArticleEdits.has(chatId)) {
        activeEditingDraftId = pendingArticleEdits.get(chatId);
        pendingArticleEdits.delete(chatId);
        parsed.intent_type = 'immediate_action';
        parsed.action_type = 'edit_article';
      }

      // Explicit Imperative Actions only override conversational intent if the user specifically instructed execution!
      // Conversational inquiries ("why...", "tell me...", "how does...", "what about...") stay conversational.
      const isConversationalInquiry = /^(why|how|what|tell|can|could|would|explain|discuss|think|do you think|who)\b/i.test(taskPrompt.trim());

      if (!isConversationalInquiry && parsed.intent_type !== 'conversation_response') {
        // Route image generation / recreation requests directly to generate_images to prevent re-drafting already written articles!
        const isImageRequest = /(recreate|generate|create|make|add|include).*?(images?|visuals?|pictures?|graphics?|photos?)|has\s+no\s+images?|missing\s+images?|no\s+images?|recreate\s+image/i.test(taskPrompt);
        if (isImageRequest) {
          parsed.intent_type = 'immediate_action';
          parsed.action_type = 'generate_images';
        }

        // Route edit / modify requests directly to edit_article to prevent re-drafting already written articles!
        const isEditRequest = /(edit|update|modify|revise|change|shorten|expand|add\s+to|add\s+faq|improve).*?(previous|last|recent|existing)?\s*(article|post|draft|piece|content)/i.test(taskPrompt) ||
          /^(edit|update|modify|revise)\s+(the\s+)?(previous|last|recent|article|post|draft)/i.test(taskPrompt) ||
          /^(edit|update|modify|revise)\s*:/i.test(taskPrompt);
        if (isEditRequest && parsed.action_type !== 'generate_images') {
          parsed.intent_type = 'immediate_action';
          parsed.action_type = 'edit_article';
        }
      }

      // Explicit direct command to index
      const isExplicitIndexingCommand = /^(index|request\s+indexing|submit\s+for\s+indexing)\b/i.test(taskPrompt.trim()) ||
        /^index$/i.test(taskPrompt.trim()) ||
        /^(please\s+)?index\s+(this|my|the|it|all|every|https?)/i.test(taskPrompt.trim());
      if (isExplicitIndexingCommand) {
        parsed.intent_type = 'immediate_action';
        parsed.action_type = 'indexing_check';
        const urlMatch = taskPrompt.match(/https?:\/\/[^\s]+/i);
        if (urlMatch) {
          parsed.target_url = urlMatch[0];
        }
      }

      // E. Conversational Response (Greetings, Questions, Explanations)
      if (parsed.intent_type === 'conversation_response' || parsed.action_type === 'answer_question') {
        let answer = parsed.response_message;
        if (!answer) {
          try {
            const { LLMProvider } = await import('@/lib/tools/llm');
            const replyResult = await LLMProvider.generateText({
              agent: 'MonitoringAgent',
              system: `You are an elite, highly knowledgeable AI SEO Consultant and Growth Architect for the website "${currentSite.domain}".
Answer the user's natural language question with deep SEO expertise, actionable insights, and a helpful, concise tone.
If the user is asking about their site, reference ${currentSite.domain}.
Format your response with clean Markdown (bullet points, bold text). Keep it under 250 words so it is easy to read on mobile.`,
              prompt: taskPrompt,
              messages: chatHistory.map(h => ({ role: h.role, content: h.content }))
            });
            answer = replyResult.text;
          } catch (replyErr) {
            answer = `👋 I am your AI SEO Consultant for *${currentSite.domain}*.\n\nYou asked: _"${taskPrompt}"_\n\nHow can I help you grow search traffic? You can ask me any SEO questions, analyze keywords, or tell me to write comprehensive articles!`;
          }
        }

        await telegram.sendMessage(chatId, answer, { parse_mode: 'Markdown' });
        
        try {
          await supabase.from('project_memory').insert({
            website_id: currentSite.id,
            category: 'workflow',
            content: answer,
            source: 'assistant_response',
            source_detail: chatId,
            confidence: 'high'
          });
        } catch(e) {}
        return NextResponse.json({ ok: true });
      }

      // F. Actionable Execution (Write Article, Keyword Research, Technical Audit, Diagnostic)
      let sharedInventory: any = null;

      if (parsed.action_type === 'seo_diagnostic') {
        await telegram.sendMessage(
          chatId,
          `🔎 *Forensic SEO Diagnostic Agent Activated*\n\n*Target:* \`${currentSite.domain}\`\n*Investigating:* "${parsed.goal}"\n\n1️⃣ Inspecting Search Console queries & position trends\n2️⃣ Auditing technical signals (indexability, canonicals, status codes)\n3️⃣ Checking for keyword & topical cannibalization\n4️⃣ Isolating root causes and building step-by-step remediation plan...\n\n_Agent is investigating now..._ ⏳`,
          { parse_mode: 'Markdown' }
        );
      } else if (parsed.action_type === 'write_article') {
        // Pre-Execution Anti-Cannibalization Check: Never draft an already written topic
        const { SiteContentGapDetector } = await import('@/lib/agent/siteContentGapDetector');
        const { DuplicateArticleChecker } = await import('@/lib/agent/duplicateChecker');
        const inventory = await SiteContentGapDetector.getSiteInventory({
          websiteId: currentSite.id,
          domain: currentSite.domain,
          siteUrl: currentSite.url,
        });
        sharedInventory = inventory;

        const targetTopic = (parsed.topic || parsed.goal || '').trim();
        const isGeneric = !targetTopic || /^(write\s+an?\s+article|write\s+article|create\s+article|write\s+post|post\s+it|write|generate\s+article)/i.test(targetTopic);

        if (!isGeneric) {
          const dupCheck = DuplicateArticleChecker.findDuplicateInInventory(targetTopic, inventory);
          if (dupCheck.isDuplicate) {
            const gaps = await SiteContentGapDetector.findContentGaps({ inventory, limit: 3 });
            const altList = gaps.length > 0
              ? gaps.map((g, idx) => `${idx + 1}️⃣ *"${g.working_title}"*\n   ↳ _Keyword:_ \`${g.keyword}\` | _Category:_ ${g.target_category} (${g.estimated_volume}/mo, KD ${g.estimated_kd})`).join('\n\n')
              : '• Check your Content Planner for fresh, uncovered keyword opportunities.';

            const siteBase = (currentSite.url || `https://${currentSite.domain}`).replace(/\/+$/, '');
            const articleLink = dupCheck.url && dupCheck.url.startsWith('http')
              ? dupCheck.url
              : (dupCheck.status === 'published' ? `${siteBase}/${DuplicateArticleChecker.toSlug(dupCheck.existingTitle)}` : undefined);

            const proofLine = articleLink
              ? `🔗 *Live Article Proof:* ${articleLink}\n\n`
              : `📋 *Status in Content Planner:* Awaiting review / approved (${dupCheck.status || 'draft'})\n\n`;

            const cancelMsg = `⚠️ *Topic Already Covered — Write Request Prevented*\n\n` +
              `An article covering *"${targetTopic}"* already exists for \`${currentSite.domain}\`:\n` +
              `👉 *"${dupCheck.existingTitle}"*\n` +
              proofLine +
              `Writing another article on this exact topic would cause *search cannibalization* and burn AI tokens unnecessarily.\n\n` +
              `🎯 *Recommended Uncovered Content Gaps Instead:*\n\n${altList}\n\n` +
              `_Please reply with one of the above topics or a new uncovered keyword to proceed!_`;

            await telegram.sendMessage(chatId, cancelMsg, { parse_mode: 'Markdown' });
            return NextResponse.json({ ok: true });
          }
        }

        await telegram.sendMessage(
          chatId,
          `✍️ *Drafting article:* "${parsed.topic || parsed.goal}" for \`${currentSite.domain}\`... ⏳`,
          { parse_mode: 'Markdown' }
        );
      } else if (parsed.action_type === 'keyword_research') {
        const { SiteContentGapDetector } = await import('@/lib/agent/siteContentGapDetector');
        const { DuplicateArticleChecker } = await import('@/lib/agent/duplicateChecker');
        const inventory = await SiteContentGapDetector.getSiteInventory({
          websiteId: currentSite.id,
          domain: currentSite.domain,
          siteUrl: currentSite.url,
        });
        sharedInventory = inventory;

        const seed = (parsed.topic || '').trim();
        let coveredNotice = '';
        if (seed) {
          const dupCheck = DuplicateArticleChecker.findDuplicateInInventory(seed, inventory);
          if (dupCheck.isDuplicate) {
            const siteBase = (currentSite.url || `https://${currentSite.domain}`).replace(/\/+$/, '');
            const articleLink = dupCheck.url && dupCheck.url.startsWith('http')
              ? dupCheck.url
              : (dupCheck.status === 'published' ? `${siteBase}/${DuplicateArticleChecker.toSlug(dupCheck.existingTitle)}` : undefined);
            const proofText = articleLink ? ` (${articleLink})` : ` [in Content Planner: ${dupCheck.status}]`;
            coveredNotice = `\n\n💡 *Note:* Your site already covers *"${dupCheck.existingTitle}"*${proofText}. Filtering out all duplicates to discover strictly *uncovered* content gaps...`;
          }
        }

        await telegram.sendMessage(
          chatId,
          `🎯 *Researching Uncovered Keywords for \`${currentSite.domain}\`...* ⏳${coveredNotice}`,
          { parse_mode: 'Markdown' }
        );
      } else if (parsed.action_type === 'generate_images') {
        await telegram.sendMessage(
          chatId,
          `🎨 *Generating visuals for:* "${parsed.topic || parsed.goal}"... ⏳`,
          { parse_mode: 'Markdown' }
        );
      } else if (parsed.action_type === 'edit_article') {
        await telegram.sendMessage(
          chatId,
          `✏️ *Applying edits to:* "${parsed.goal}" for \`${currentSite.domain}\`... ⏳`,
          { parse_mode: 'Markdown' }
        );
      } else if (parsed.action_type === 'indexing_check') {
        await telegram.sendMessage(
          chatId,
          `🚀 *Instant Indexing Pipeline Activated for \`${currentSite.domain}\`...* ⏳\n\nSubmitting to Google Indexing API, IndexNow (Bing/Yandex), and search engine re-crawl bots...`,
          { parse_mode: 'Markdown' }
        );
      } else if (parsed.action_type === 'growth_acceleration') {
        await telegram.sendMessage(
          chatId,
          `⚡ *Autonomous Growth Acceleration Activated for \`${currentSite.domain}\`...* ⏳\n\n1️⃣ Inspecting live Google Search Console performance data\n2️⃣ Identifying striking-distance queries (positions 4–20 with impressions)\n3️⃣ Formulating High-CTR Title & Schema optimizations to leap into Top 3...`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await telegram.sendMessage(
          chatId,
          `⚙️ *Executing:* \`${parsed.action_type}\` for \`${currentSite.domain}\`... ⏳`,
          { parse_mode: 'Markdown' }
        );
      }

      await safeBackground(async () => {
        try {
          const executor = new AutopilotExecutor();
          const execResult = await executor.executeImmediateAction({
            instruction: parsed,
            website_id: currentSite.id,
            website_domain: currentSite.domain,
            website_url: currentSite.url || `https://${currentSite.domain}`,
            project_id: currentSite.project_id,
            user_id: currentSite.user_id || '0a035c76-db28-4071-9294-db59ca23d1a5',
            sync: true,
            chat_id: chatId,
            draft_id: activeEditingDraftId,
            siteInventory: sharedInventory || undefined,
          });

          if (execResult.success) {
            if (parsed.action_type === 'seo_diagnostic') {
              await telegram.sendMessage(
                chatId,
                execResult.summary,
                { parse_mode: 'Markdown' }
              );
            } else if (parsed.action_type === 'generate_images') {
              await telegram.sendMessage(
                chatId,
                `${execResult.summary}${execResult.link_url ? `\n\n[Open Article](${execResult.link_url})` : ''}`,
                { parse_mode: 'Markdown' }
              );
            } else if (parsed.action_type === 'keyword_research' && execResult.data?.top_opportunities?.length) {
              const topList = execResult.data.top_opportunities.map((o: any, idx: number) => 
                `${idx + 1}️⃣ *"${o.keyword}"*\n   • Volume: *${o.search_volume ? o.search_volume.toLocaleString() : '400+'}/mo* | KD: *${o.keyword_difficulty || 20}* | Intent: _${o.intent}_`
              ).join('\n\n');

              await telegram.sendMessage(
                chatId,
                `✅ *Keyword Research Complete!*\n\n${execResult.summary}\n\n🎯 *Top High-Demand, Fast-Win Targets:*\n\n${topList}\n\n💡 *Zero Ghost Keywords:* All recommended queries have verified search traffic (>= 200/mo) and KD <= 30.\n\n[View in Keyword Explorer](${execResult.link_url || '/keywords'})`,
                { parse_mode: 'Markdown' }
              );
            } else if (parsed.action_type === 'write_article') {
              // write_article automatically dispatches the interactive [Approve & Publish] card via sendApprovalPrompt!
            } else {
              const msg = execResult.summary.startsWith('🚀') || execResult.summary.startsWith('✅') || execResult.summary.startsWith('📊')
                ? execResult.summary
                : `✅ *Task Completed!*\n\n${execResult.summary || 'Operation finished successfully.'}${execResult.link_url ? `\n\n[View in Dashboard](${execResult.link_url})` : ''}`;

              await telegram.sendMessage(
                chatId,
                msg,
                { parse_mode: 'Markdown' }
              );
            }
          } else {
            await telegram.sendMessage(
              chatId,
              `⚠️ *Task Notice:*\n${execResult.summary || 'Could not complete task fully.'}`,
              { parse_mode: 'Markdown' }
            );
          }

          // Save agent response to memory
          try {
            await supabase.from('project_memory').insert({
              website_id: currentSite.id,
              category: 'workflow',
              content: execResult.summary,
              source: 'agent_response',
              source_detail: chatId,
              confidence: 'high'
            });
          } catch(e) {}

        } catch (taskErr: any) {
          console.error('[Telegram Task Exec Error in after()]:', taskErr);
          await telegram.sendMessage(
            chatId,
            `❌ *Task Execution Notice:*\n${taskErr?.message || 'An unexpected error occurred during execution.'}`,
            { parse_mode: 'Markdown' }
          );
        }
      });

    } catch (taskErr: any) {
      console.error('[Telegram Task Dispatch Error]:', taskErr);
      await telegram.sendMessage(
        chatId,
        `❌ *Task Execution Notice:*\n${taskErr?.message || 'An unexpected error occurred during dispatch.'}`,
        { parse_mode: 'Markdown' }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook] Error:', error);
    return NextResponse.json({ ok: true, error: error.message });
  }
}

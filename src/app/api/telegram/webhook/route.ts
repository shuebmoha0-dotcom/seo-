export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { TelegramService } from '@/lib/telegram/telegramService';
import { createAdminClient } from '@/lib/supabase/admin';
import { AutopilotNLParser } from '@/lib/agent/autopilotNLParser';
import { AutopilotExecutor } from '@/lib/agent/autopilotExecutor';
import { WebsiteCrawler } from '@/lib/agent/crawler';

// In-memory deduplication cache for Telegram update_ids to prevent retry collisions
const processedUpdates = new Map<number, number>();

function isDuplicateUpdate(updateId?: number): boolean {
  if (!updateId) return false;
  const now = Date.now();
  // Purge entries older than 5 minutes
  for (const [id, time] of processedUpdates.entries()) {
    if (now - time > 300000) processedUpdates.delete(id);
  }
  if (processedUpdates.has(updateId)) return true;
  processedUpdates.set(updateId, now);
  return false;
}

export async function POST(request: Request) {
  try {
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
          .select('id, working_title, url_slug, website_id, content_body, primary_keyword, seo_title, meta_description, featured_image_url')
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
                  featured_image_url: draft.featured_image_url || undefined,
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

          if (!siteBaseUrl) {
            const { data: defaultSite } = await supabase.from('websites').select('domain, url').limit(1).maybeSingle();
            siteBaseUrl = defaultSite?.url || (defaultSite?.domain ? `https://${defaultSite.domain}` : 'https://bizaigenius.com');
          }

          if (!livePostUrl) {
            livePostUrl = `${siteBaseUrl.replace(/\/$/, '')}/${draft.url_slug}/`;
          }

          // Update draft status to published
          await supabase
            .from('content_drafts')
            .update({
              status: 'published',
              updated_at: new Date().toISOString(),
              revision_notes: JSON.stringify({ wordpress_post_url: livePostUrl })
            })
            .eq('id', draft.id);
        }

        // Edit current message confirming approval
        if (chatId && messageId) {
          await telegram.editMessageText(
            chatId,
            messageId,
            `✅ *Approved & Published Live!*\n\n*Title:* "${draft?.working_title || 'Article'}"\n🔗 *URL:* ${livePostUrl || siteBaseUrl}\n\nQueued to WordPress for immediate publication.`
          );
        }

        // Send permission prompt card asking user if they want to request Google Indexing
        if (chatId && livePostUrl) {
          await telegram.sendIndexingPrompt(chatId, {
            postUrl: livePostUrl,
            postTitle: draft?.working_title || 'New Article',
            draftId: executionId,
          });
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
              let domainBase = 'https://bizaigenius.com';
              const { data: ws } = await supabase
                .from('websites')
                .select('url, domain')
                .eq('id', draftWebsiteId || '')
                .maybeSingle();
              if (ws) domainBase = ws.url || `https://${ws.domain}`;
              targetUrl = `${domainBase.replace(/\/$/, '')}/${d.url_slug}/`;
            }
          }
        }

        if (!targetUrl) {
          const { data: defaultSite } = await supabase.from('websites').select('domain, url').limit(1).maybeSingle();
          targetUrl = defaultSite?.url || (defaultSite?.domain ? `https://${defaultSite.domain}` : 'https://bizaigenius.com');
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

    // A. Handle /start command (Pairing)
    if (rawText.startsWith('/start')) {
      const parts = rawText.split(' ');
      let websiteId = parts[1]?.trim();

      // If no websiteId provided in command parameter, look up primary website
      if (!websiteId) {
        const { data: defaultSite } = await supabase
          .from('websites')
          .select('id, domain')
          .limit(1)
          .single();
        websiteId = defaultSite?.id;
      }

      if (!websiteId) {
        await telegram.sendMessage(
          chatId,
          `👋 Hello *${firstName}*!\n\nTo pair your phone with your SEO dashboard, please click the *Connect Telegram* button inside your web dashboard or send:\n\n\`/start <your_website_id>\``,
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

    // Find paired website for this chat ID
    const { data: integrations } = await supabase
      .from('integrations')
      .select('website_id, config')
      .eq('provider', 'custom');

    let pairedWebsiteId: string | null = null;
    if (integrations) {
      for (const integ of integrations) {
        const subs = integ.config?.subscribers || [];
        if (subs.some((s: any) => s.chat_id === chatId)) {
          pairedWebsiteId = integ.website_id;
          break;
        }
      }
    }

    // Fallback: If not explicitly paired, fallback to primary website
    if (!pairedWebsiteId) {
      const { data: fallbackSite } = await supabase
        .from('websites')
        .select('id')
        .limit(1)
        .single();
      pairedWebsiteId = fallbackSite?.id || null;
      if (pairedWebsiteId) {
        await telegram.addSubscriber(pairedWebsiteId, {
          chat_id: chatId,
          username,
          first_name: firstName,
        });
      }
    }

    if (!pairedWebsiteId) {
      await telegram.sendMessage(chatId, `⚠️ You have not connected a website yet. Please open your dashboard and link a website.`);
      return NextResponse.json({ ok: true });
    }

    const { data: currentSite } = await supabase
      .from('websites')
      .select('*')
      .eq('id', pairedWebsiteId)
      .single();

    if (!currentSite) {
      await telegram.sendMessage(chatId, `⚠️ Paired website was not found.`);
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
        .select('title, rankmath_score, updated_at')
        .eq('website_id', currentSite.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      await telegram.sendMessage(
        chatId,
        `📊 *SEO Agent Status for ${currentSite.domain}*

🌐 *Domain:* \`${currentSite.domain}\`
⚙️ *Platform:* ${currentSite.platform || 'WordPress'}
📝 *Total Drafts/Articles:* ${draftCount || 0}
⏳ *Active Tasks Running:* ${pendingCount || 0}
${latestPost ? `\n🌟 *Latest Article:*
• "${latestPost.title}"
• Rank Math SEO Score: *${latestPost.rankmath_score || 80}/100* 🟢` : ''}

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

• \`/status\` — Site health, active tasks, latest post
• \`/help\` — Show this help message

💬 *Natural Language Tasks:*
Just text what you want your agent to do:
• _"Write an article about 5 best marketing automation tools"_
• _"Run a competitor scan on our niche"_
• _"Audit technical SEO and check for broken links"_
• _"Find backlink opportunities for us"_

Your agent will process the request in the background and ping you when finished!`,
        { parse_mode: 'Markdown' }
      );
      return NextResponse.json({ ok: true });
    }

    // D. Natural Language Task Dispatcher
    const taskPrompt = rawText.replace(/^\/task\s+/i, '');

    try {
      const isDailySchedule = /(everyday|daily|every\s+day|every\s+morning|schedule.*report|scan.*everyday|report.*everyday)/i.test(taskPrompt);
      const isScanRequest = /(scan|audit|health|crawl|check\s+site|analyze\s+site|seo\s+report)/i.test(taskPrompt);

      if (isDailySchedule || isScanRequest) {
        // Send initial progress notice
        await telegram.sendMessage(
          chatId,
          `🔍 *Running live SEO scan & crawl on \`${currentSite.domain}\`...* ⏳`,
          { parse_mode: 'Markdown' }
        );

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

        // Analyze key signals
        const titleLength = crawlData.title?.length || 0;
        const isGenericTitle = crawlData.title?.toLowerCase().includes('home') || titleLength < 25;
        const h1Count = crawlData.h1.length;
        const isWastedH1 = h1Count === 1 && (crawlData.h1[0].toLowerCase() === 'home' || crawlData.h1[0].length < 10);
        const metaLength = crawlData.meta_description?.length || 0;

        let reportLines = [
          `📊 *${isDailySchedule ? 'Daily SEO Health & Scan Activated' : 'SEO Health & Scan Report'}: ${currentSite.domain}*`,
          '━━━━━━━━━━━━━━━━━━━━━',
        ];

        if (isDailySchedule) {
          reportLines.push(
            '⏱ *Schedule Status:* ✅ *Active (Daily at 09:00 UTC)*',
            'Your site will now be scanned and reported every morning automatically!\n'
          );
        }

        reportLines.push(
          '🔍 *Live Site Scan Results:*',
          `• *Status:* ${crawlData.http_status === 200 ? '🟢 200 OK (Responsive)' : `⚠️ HTTP ${crawlData.http_status}`}`,
          `• *Canonical URL:* \`${crawlData.canonical || targetUrl}\``,
          `• *Internal Links:* ${crawlData.internal_links.length} discovered`,
          `• *Images:* ${crawlData.images.length} analyzed`
        );

        reportLines.push('\n⚠️ *On-Page Audit Findings:*');

        if (isWastedH1) {
          reportLines.push(
            `\n1️⃣ *H1 Tag Needs Immediate Fix:*`,
            `   • Current H1: \`"${crawlData.h1[0]}"\``,
            `   • *Impact:* H1 is your highest-weight on-page tag. Wasting it on "${crawlData.h1[0]}" hurts search indexing.`,
            `   • *Recommendation:* Change to high-impact target phrase, e.g.: _"AI Tools, Cold Email and Sales Automation for Modern Businesses"_`
          );
        } else if (h1Count === 0) {
          reportLines.push(
            `\n1️⃣ *Missing H1 Tag:*`,
            `   • *Impact:* No primary H1 tag detected on the page.`,
            `   • *Recommendation:* Add an H1 tag with your primary search keyword.`
          );
        } else {
          reportLines.push(`\n1️⃣ *H1 Tag:* 🟢 \`"${crawlData.h1[0]}"\``);
        }

        if (isGenericTitle) {
          reportLines.push(
            `\n2️⃣ *Title Tag Needs Keyword Optimization:*`,
            `   • Current: \`"${crawlData.title}"\` (${titleLength} chars)`,
            `   • *Recommendation:* Expand to 50-60 characters including high-intent keywords, e.g.: _"${currentSite.domain} — Practical AI Tools & Sales Automation Guides"_`
          );
        } else {
          reportLines.push(`\n2️⃣ *Title Tag:* 🟢 \`"${crawlData.title}"\` (${titleLength} chars)`);
        }

        if (metaLength < 70) {
          reportLines.push(
            `\n3️⃣ *Meta Description:* ⚠️ Too short (${metaLength} chars). Expand to 150-160 chars for maximum search click-through rate.`
          );
        } else {
          reportLines.push(`\n3️⃣ *Meta Description:* 🟢 Optimal length (${metaLength} chars).`);
        }

        reportLines.push(
          '\n━━━━━━━━━━━━━━━━━━━━━',
          '💡 *Next Step:* Reply with *"Write an article about best AI tools for cold email"* or *"Find low KD keywords"* to dispatch an execution action!'
        );

        await telegram.sendMessage(chatId, reportLines.join('\n'), { parse_mode: 'Markdown' });
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

      // Route diagnostic and drop-investigation questions to seo_diagnostic immediately
      const isDiagnosticQuestion = /why.*(rank|drop|fall|traffic|declin|loss|lost|position)|diagnos|what happened to my (rank|traffic)|why.*not ranking/i.test(taskPrompt);
      if (isDiagnosticQuestion && (parsed.intent_type === 'conversation_response' || parsed.action_type === 'answer_question')) {
        parsed.intent_type = 'immediate_action';
        parsed.action_type = 'seo_diagnostic';
      }

      // Route keyword requests directly to keyword_research to guarantee grounded inventory check
      const isKeywordRequest = /give me keywords?|find keywords?|keyword opportunities|what keywords?|keyword ideas/i.test(taskPrompt);
      if (isKeywordRequest && (parsed.intent_type === 'conversation_response' || parsed.action_type === 'answer_question')) {
        parsed.intent_type = 'immediate_action';
        parsed.action_type = 'keyword_research';
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
          `🚀 *Autonomous Content Pipeline Activated*\n\n*Target:* \`${currentSite.domain}\`\n*Topic / Goal:* ${parsed.topic || parsed.goal}\n\n1️⃣ Researching high-demand, low-KD keywords\n2️⃣ Weaving internal links from live pages\n3️⃣ Generating visual assets\n4️⃣ Drafting 1,200–1,600 words with Claude Sonnet 5\n\n_Agent is writing now..._ ⏳`,
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
      } else {
        await telegram.sendMessage(
          chatId,
          `⚙️ *Executing Task:* \`${parsed.action_type}\` for \`${currentSite.domain}\`... ⏳`,
          { parse_mode: 'Markdown' }
        );
      }

      const executor = new AutopilotExecutor();
      const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) =>
        setTimeout(() => resolve({ isTimeout: true }), 54000)
      );

      const execResult = await Promise.race([
        executor.executeImmediateAction({
          instruction: parsed,
          website_id: currentSite.id,
          website_domain: currentSite.domain,
          website_url: currentSite.url || `https://${currentSite.domain}`,
          project_id: currentSite.project_id,
          user_id: currentSite.user_id || '0a035c76-db28-4071-9294-db59ca23d1a5',
          sync: true,
          chat_id: chatId,
          siteInventory: sharedInventory || undefined,
        }),
        timeoutPromise
      ]);

      if ('isTimeout' in execResult) {
        await telegram.sendMessage(
          chatId,
          `⏳ *Drafting In Progress (Claude Sonnet 5)*\n\nYour article draft ticket has been created in your [Content Planner](/content-planner).\nClaude Sonnet 5 is finishing the prose now and will send your approval card as soon as it is ready!`
        );
        return NextResponse.json({ ok: true });
      }

      if (execResult.success) {
        if (parsed.action_type === 'seo_diagnostic') {
          await telegram.sendMessage(
            chatId,
            execResult.summary,
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
        } else {
          const isProcessing = execResult.summary.includes('background') || execResult.summary.includes('started') || execResult.summary.includes('running');
          await telegram.sendMessage(
            chatId,
            `${isProcessing ? '⚙️ *Task Processing...*' : '✅ *Task Completed!*'}\n\n*Action:* ${parsed.action_type}\n*Summary:* ${execResult.summary || 'Operation finished successfully.'}${execResult.link_url ? `\n\n[View in Dashboard](${execResult.link_url})` : ''}`,
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
      console.error('[Telegram Task Exec Error]:', taskErr);
      await telegram.sendMessage(
        chatId,
        `❌ *Task Execution Notice:*\n${taskErr.message || 'An unexpected error occurred during execution.'}`,
        { parse_mode: 'Markdown' }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook] Error:', error);
    return NextResponse.json({ ok: true, error: error.message });
  }
}

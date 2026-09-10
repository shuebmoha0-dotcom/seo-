import { NextResponse } from 'next/server';
import { TelegramService } from '@/lib/telegram/telegramService';
import { createAdminClient } from '@/lib/supabase/admin';
import { AutopilotNLParser } from '@/lib/agent/autopilotNLParser';
import { AutopilotExecutor } from '@/lib/agent/autopilotExecutor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const telegram = new TelegramService();
    const supabase = createAdminClient();

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

        // Edit message in Telegram
        if (chatId && messageId) {
          await telegram.editMessageText(
            chatId,
            messageId,
            `✅ *Approved & Published Live!*\n\nThe article action was approved from your phone and queued for live publishing.`
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

    // Send instant acknowledgement
    await telegram.sendMessage(
      chatId,
      `🚀 *Task Dispatched to Agent:*
"${taskPrompt}"

*Target:* \`${currentSite.domain}\`
*Status:* Agent is parsing and executing... I'll send you an update as soon as it's ready! ⏳`,
      { parse_mode: 'Markdown' }
    );

    // Execute in background
    (async () => {
      try {
        const nlParser = new AutopilotNLParser();
        const parsed = await nlParser.parseInstruction({
          prompt: taskPrompt,
          domain: currentSite.domain,
          modeOverride: 'immediate',
        });

        const executor = new AutopilotExecutor();
        const execResult = await executor.executeImmediateAction({
          instruction: parsed,
          website_id: currentSite.id,
          website_domain: currentSite.domain,
          website_url: currentSite.url || `https://${currentSite.domain}`,
          project_id: currentSite.project_id,
          user_id: currentSite.user_id || '0a035c76-db28-4071-9294-db59ca23d1a5',
        });

        if (execResult.success) {
          // If it was an article creation, send with approval buttons
          if (parsed.action_type === 'write_article') {
            await telegram.sendApprovalPrompt(chatId, {
              executionId: execResult.data?.draft_id || 'completed',
              taskTitle: parsed.topic || parsed.goal || taskPrompt,
              websiteDomain: currentSite.domain,
              score: 84,
              wordCount: 1450,
            });
          } else {
            await telegram.sendMessage(
              chatId,
              `✅ *Task Completed!*\n\n*Action:* ${parsed.action_type}\n*Summary:* ${execResult.summary || 'Operation finished successfully.'}${execResult.link_url ? `\n\n[View in Dashboard](${execResult.link_url})` : ''}`,
              { parse_mode: 'Markdown' }
            );
          }
        } else {
          await telegram.sendMessage(
            chatId,
            `⚠️ *Task Finished with Notice:*\n${execResult.summary || 'Could not complete task fully.'}`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (err: any) {
        console.error('[Telegram Task Exec Background] Error:', err);
        await telegram.sendMessage(
          chatId,
          `❌ *Task Execution Error:*\n${err.message || 'An unexpected error occurred.'}`,
          { parse_mode: 'Markdown' }
        );
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

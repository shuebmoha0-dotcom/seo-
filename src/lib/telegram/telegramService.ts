import { createAdminClient } from '@/lib/supabase/admin';

export interface TelegramSubscriber {
  chat_id: string;
  username?: string;
  first_name?: string;
  paired_at: string;
}

export interface TelegramIntegrationConfig {
  type: 'telegram';
  bot_username?: string;
  subscribers: TelegramSubscriber[];
  last_command_at?: string;
}

// In-memory deduplication cache to prevent alert spam & unnecessary network traffic (capped to preserve Render RAM)
const notifiedDiscoveries = new Map<string, number>();

export class TelegramService {
  private token?: string;
  private isConfigured: boolean;

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN || '8681521493:AAGWZwCNpz2_gTYnMBFm613psNL3dbijm0w';
    this.isConfigured = !!(this.token && !this.token.includes('your-') && this.token.trim().length > 15);
  }

  get configured(): boolean {
    return this.isConfigured;
  }

  private get apiUrl(): string {
    return `https://api.telegram.org/bot${this.token}`;
  }

  /**
   * Get the Bot's info (e.g. username)
   */
  async getMe(): Promise<{ id: number; username: string; first_name: string } | null> {
    if (!this.isConfigured) return null;
    try {
      const res = await fetch(`${this.apiUrl}/getMe`);
      const data = await res.json();
      if (data.ok) return data.result;
      return null;
    } catch (err) {
      console.error('[TelegramService] getMe error:', err);
      return null;
    }
  }

  /**
   * Get current Webhook status from Telegram API
   */
  async getWebhookInfo(): Promise<{ url: string; pending_update_count: number; last_error_message?: string } | null> {
    if (!this.isConfigured) return null;
    try {
      const res = await fetch(`${this.apiUrl}/getWebhookInfo`);
      const data = await res.json();
      if (data.ok) return data.result;
      return null;
    } catch (err) {
      console.error('[TelegramService] getWebhookInfo error:', err);
      return null;
    }
  }

  /**
   * Set the Webhook URL for Telegram updates
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      const res = await fetch(`${this.apiUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'edited_message', 'callback_query'],
          drop_pending_updates: false,
        }),
      });
      const data = await res.json();
      return !!data.ok;
    } catch (err) {
      console.error('[TelegramService] setWebhook error:', err);
      return false;
    }
  }

  /**
   * Self-healing watchdog: verifies webhook is pointed to our production URL.
   * If hijacked, cleared, or pointing to a rogue third-party server, instantly restores it.
   */
  async ensureWebhook(expectedUrl?: string): Promise<{ restored: boolean; currentUrl: string }> {
    const targetUrl = expectedUrl || `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://seo-hazel-eight.vercel.app').replace(/\/+$/, '')}/api/telegram/webhook`;
    const info = await this.getWebhookInfo();
    const currentUrl = info?.url || '';

    if (currentUrl !== targetUrl) {
      console.warn(`[TelegramService] Webhook drift/hijack detected (current: "${currentUrl}", expected: "${targetUrl}"). Self-healing immediately...`);
      const ok = await this.setWebhook(targetUrl);
      return { restored: ok, currentUrl: ok ? targetUrl : currentUrl };
    }
    return { restored: false, currentUrl };
  }

  /**
   * Send a standard text or Markdown message to a Telegram Chat
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parse_mode?: 'Markdown' | 'HTML';
      reply_markup?: any;
    }
  ): Promise<any> {
    if (!this.isConfigured) {
      console.log(`[TelegramService (Offline/Simulated)] To: ${chatId} | Message: ${text}`);
      return { ok: true, simulated: true };
    }

    // Safety: Telegram maximum message length is 4096 characters
    let safeText = text;
    if (safeText.length > 4000) {
      safeText = safeText.slice(0, 3950) + '\n\n...[Full details available in web dashboard]';
    }

    try {
      const payload: any = {
        chat_id: chatId,
        text: safeText,
        parse_mode: options?.parse_mode || 'Markdown',
      };
      if (options?.reply_markup) {
        payload.reply_markup = options.reply_markup;
      }

      const res = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) {
        console.warn('[TelegramService] sendMessage error:', data.description, '- retrying without formatting...');
        // Fallback: If Markdown entity parsing failed, retry as clean plain text
        if (options?.parse_mode) {
          const fallbackRes = await fetch(`${this.apiUrl}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: safeText,
              reply_markup: options?.reply_markup,
            }),
          });
          return await fallbackRes.json();
        }
      }
      return data;
    } catch (err) {
      console.error('[TelegramService] sendMessage failed:', err);
      return { ok: false, error: err };
    }
  }

  /**
   * Send an approval prompt with interactive inline buttons [Approve] and [Reject]
   */
  async sendApprovalPrompt(
    chatId: string | number,
    data: {
      executionId: string;
      taskTitle: string;
      websiteDomain: string;
      score?: number;
      wordCount?: number;
    }
  ): Promise<any> {
    const text = 
`🔔 *Action Required: Article Draft Ready*

*Title:* ${data.taskTitle}
*Target:* ${data.websiteDomain}
*Rank Math SEO Score:* ${data.score || 82}/100 🟢
*Word Count:* ${data.wordCount || 1400} words

Tap a button below to execute or reject directly from your phone:`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Approve & Publish Live', callback_data: `approve:${data.executionId}` },
          { text: '❌ Reject', callback_data: `reject:${data.executionId}` },
        ],
        [
          { text: '🎨 Recreate Images', callback_data: `recreate_images:${data.executionId}` },
          { text: '✏️ Edit Article', callback_data: `edit_article:${data.executionId}` },
        ],
      ],
    };

    return this.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard,
    });
  }

  /**
   * Interactive permission card asking user if they want to request Google Indexing
   */
  async sendIndexingPrompt(
    chatId: string | number,
    data: {
      postUrl: string;
      postTitle: string;
      draftId?: string;
    }
  ): Promise<any> {
    const text =
`🎉 *Article Published Live!*

*Title:* ${data.postTitle}
🔗 *Live URL:* ${data.postUrl}

Would you like me to request Google Search Console & IndexNow indexing for this URL now?`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🚀 Request Google Indexing', callback_data: `approve_index:${data.draftId || 'url'}` },
          { text: '⏭️ Skip', callback_data: `skip_index:${data.draftId || 'url'}` },
        ],
      ],
    };

    return this.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard,
    });
  }

  /**
   * Edit message text (used after user taps Approve/Reject so button cannot be double clicked)
   */
  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string
  ): Promise<any> {
    if (!this.isConfigured) return { ok: true, simulated: true };

    let safeText = text;
    if (safeText.length > 4000) {
      safeText = safeText.slice(0, 3950) + '\n\n...[Truncated]';
    }

    try {
      const res = await fetch(`${this.apiUrl}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: safeText,
          parse_mode: 'Markdown',
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        console.warn('[TelegramService] editMessageText error:', data.description, '- retrying plain text...');
        const fallbackRes = await fetch(`${this.apiUrl}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: safeText,
          }),
        });
        return await fallbackRes.json();
      }
      return data;
    } catch (err) {
      console.error('[TelegramService] editMessageText failed:', err);
      return { ok: false };
    }
  }

  /**
   * Answer a callback query (acknowledges button press in Telegram app)
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await fetch(`${this.apiUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || 'Processing...',
        }),
      });
    } catch (err) {
      console.error('[TelegramService] answerCallbackQuery failed:', err);
    }
  }

  /**
   * Get all paired Telegram subscribers for a website, falling back to any connected subscribers
   */
  async getSubscribers(websiteId?: string): Promise<TelegramSubscriber[]> {
    try {
      const supabase = createAdminClient();
      if (websiteId) {
        const { data } = await supabase
          .from('integrations')
          .select('config')
          .eq('website_id', websiteId)
          .eq('provider', 'custom')
          .maybeSingle();

        if (data?.config?.type === 'telegram' && Array.isArray(data.config.subscribers) && data.config.subscribers.length > 0) {
          return data.config.subscribers;
        }
      }

      // Fallback: Check all custom integrations for any paired Telegram mobile users
      const { data: allCustom } = await supabase
        .from('integrations')
        .select('config')
        .eq('provider', 'custom')
        .limit(10);

      const allSubs: TelegramSubscriber[] = [];
      const seenChats = new Set<string>();

      for (const row of (allCustom || [])) {
        if (row.config?.type === 'telegram' && Array.isArray(row.config.subscribers)) {
          for (const sub of row.config.subscribers) {
            if (sub.chat_id && !seenChats.has(sub.chat_id)) {
              seenChats.add(sub.chat_id);
              allSubs.push(sub);
            }
          }
        }
      }

      return allSubs;
    } catch {
      return [];
    }
  }

  /**
   * Link a Telegram user/chat to a website
   */
  async addSubscriber(
    websiteId: string,
    subscriber: { chat_id: string; username?: string; first_name?: string }
  ): Promise<boolean> {
    try {
      const supabase = createAdminClient();
      const current = await this.getSubscribers(websiteId);
      
      const exists = current.find(s => s.chat_id === subscriber.chat_id);
      const updated = exists
        ? current.map(s => s.chat_id === subscriber.chat_id ? { ...s, ...subscriber, paired_at: new Date().toISOString() } : s)
        : [...current, { ...subscriber, paired_at: new Date().toISOString() }];

      const { error } = await supabase
        .from('integrations')
        .upsert({
          website_id: websiteId,
          provider: 'custom',
          display_name: 'Telegram Mobile Control',
          status: 'connected',
          status_message: `Linked to ${updated.length} mobile device(s)`,
          config: {
            type: 'telegram',
            subscribers: updated,
            last_command_at: new Date().toISOString(),
          },
          capabilities: ['RECEIVE_COMMANDS', 'DISPATCH_TASKS', 'SEND_APPROVALS'],
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'website_id,provider' });

      return !error;
    } catch (err) {
      console.error('[TelegramService] addSubscriber error:', err);
      return false;
    }
  }

  /**
   * Broadcast a notification to all subscribers of a website (or global fallback subscribers)
   */
  async notifyWebsiteSubscribers(
    websiteId: string,
    text: string,
    options?: { reply_markup?: any }
  ): Promise<void> {
    const subscribers = await this.getSubscribers(websiteId);
    if (subscribers.length === 0) return;

    for (const sub of subscribers) {
      await this.sendMessage(sub.chat_id, text, options);
    }
  }

  /**
   * Proactively broadcast an SEO discovery to the bot (e.g. striking distance query, rank drop, new low-KD keywords, technical anomalies)
   * Enforces in-memory deduplication and strict Render RAM management
   */
  async broadcastDiscovery(params: {
    websiteId: string;
    domain?: string;
    type: 'striking_distance' | 'rank_drop' | 'new_keywords' | 'technical_issue' | 'content_opportunity';
    dedupKey: string;
    title: string;
    fields: Array<{ label: string; value: string }>;
    actionUrl?: string;
    actionLabel?: string;
  }): Promise<boolean> {
    const now = Date.now();

    // 1. Maintain lightweight deduplication cache (prune entries older than 24h & cap size at 200 to protect RAM)
    if (notifiedDiscoveries.size > 200) {
      for (const [key, time] of notifiedDiscoveries.entries()) {
        if (now - time > 86400000) notifiedDiscoveries.delete(key);
      }
      if (notifiedDiscoveries.size > 200) {
        notifiedDiscoveries.clear();
      }
    }

    // 2. Check if this specific discovery was already sent in the last 24 hours
    if (notifiedDiscoveries.has(params.dedupKey)) {
      const lastSent = notifiedDiscoveries.get(params.dedupKey) || 0;
      if (now - lastSent < 86400000) {
        return false; // Skip redundant message, saves network & prevents spam
      }
    }

    notifiedDiscoveries.set(params.dedupKey, now);

    // 3. Format visual discovery card with emojis
    const icon = params.type === 'striking_distance'
      ? '⚡'
      : params.type === 'rank_drop'
        ? '🚨'
        : params.type === 'new_keywords'
          ? '🎯'
          : '🛠️';

    let msg = `${icon} *SEO Discovery Alert*\n`;
    if (params.domain) {
      msg += `🌐 *Site:* \`${params.domain}\`\n`;
    }
    msg += `📌 *${params.title}*\n\n`;

    for (const f of params.fields) {
      msg += `• *${f.label}:* ${f.value}\n`;
    }

    if (params.actionUrl) {
      msg += `\n🔗 _View details in dashboard: ${params.actionUrl}_`;
    }

    await this.notifyWebsiteSubscribers(params.websiteId, msg);
    return true;
  }
}

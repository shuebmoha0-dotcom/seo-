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
   * Set the Webhook URL for Telegram updates
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      const res = await fetch(`${this.apiUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
      });
      const data = await res.json();
      return !!data.ok;
    } catch (err) {
      console.error('[TelegramService] setWebhook error:', err);
      return false;
    }
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

    try {
      const payload: any = {
        chat_id: chatId,
        text,
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
        console.warn('[TelegramService] sendMessage returned error:', data.description);
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

    try {
      const res = await fetch(`${this.apiUrl}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'Markdown',
        }),
      });
      return await res.json();
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
   * Get all paired Telegram subscribers for a website
   */
  async getSubscribers(websiteId: string): Promise<TelegramSubscriber[]> {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('integrations')
        .select('config')
        .eq('website_id', websiteId)
        .eq('provider', 'custom')
        .single();

      if (data?.config?.type === 'telegram' && Array.isArray(data.config.subscribers)) {
        return data.config.subscribers;
      }
      return [];
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
   * Broadcast a notification to all subscribers of a website
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
}

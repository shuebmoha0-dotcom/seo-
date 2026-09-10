import { NextResponse } from 'next/server';
import { TelegramService } from '@/lib/telegram/telegramService';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    const telegram = new TelegramService();
    const isConfigured = telegram.configured;

    let botInfo = null;
    if (isConfigured) {
      botInfo = await telegram.getMe();
    }

    const botUsername = botInfo?.username || 'MySeoAgentBot';
    const pairingUrl = websiteId ? `https://t.me/${botUsername}?start=${websiteId}` : `https://t.me/${botUsername}`;

    let subscribers: any[] = [];
    if (websiteId) {
      subscribers = await telegram.getSubscribers(websiteId);
    }

    return NextResponse.json({
      configured: isConfigured,
      bot_username: botUsername,
      bot_name: botInfo?.first_name || 'SEO Agent',
      pairing_url: pairingUrl,
      subscribers_count: subscribers.length,
      subscribers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, website_id, chat_id } = await request.json();

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const telegram = new TelegramService();
    const supabase = createAdminClient();

    if (action === 'test_ping') {
      const subscribers = await telegram.getSubscribers(website_id);
      if (subscribers.length === 0) {
        return NextResponse.json({ error: 'No paired devices found for this website.' }, { status: 400 });
      }

      await telegram.notifyWebsiteSubscribers(
        website_id,
        `🔔 *Test Ping Successful!*\n\nYour phone is connected to your SEO Agent. You can now send tasks and receive alerts directly here! 🚀`
      );

      return NextResponse.json({ success: true, count: subscribers.length });
    }

    if (action === 'disconnect') {
      if (chat_id) {
        // Disconnect specific chat
        const current = await telegram.getSubscribers(website_id);
        const filtered = current.filter(s => s.chat_id !== chat_id);
        await supabase
          .from('integrations')
          .update({
            config: {
              type: 'telegram',
              subscribers: filtered,
            },
            status: filtered.length > 0 ? 'connected' : 'disconnected',
            status_message: filtered.length > 0 ? `Linked to ${filtered.length} mobile device(s)` : 'No mobile devices connected',
          })
          .eq('website_id', website_id)
          .eq('provider', 'custom');
      } else {
        // Disconnect all
        await supabase
          .from('integrations')
          .update({
            status: 'disconnected',
            status_message: 'Disconnected by user',
            config: { type: 'telegram', subscribers: [] },
          })
          .eq('website_id', website_id)
          .eq('provider', 'custom');
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

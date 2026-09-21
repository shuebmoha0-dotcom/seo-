export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { TelegramService } from '@/lib/telegram/telegramService';

const PRODUCTION_WEBHOOK_URL = 'https://seo-hazel-eight.vercel.app/api/telegram/webhook';

export async function GET() {
  try {
    const telegram = new TelegramService();
    if (!telegram.configured) {
      return NextResponse.json({ ok: false, error: 'Telegram bot token not configured' }, { status: 500 });
    }

    const info = await telegram.getWebhookInfo();
    const currentUrl = info?.url || '';
    const needsHeal = currentUrl !== PRODUCTION_WEBHOOK_URL;

    let restored = false;
    if (needsHeal) {
      console.warn(`[Telegram Watchdog] Webhook drift detected! Current: "${currentUrl}". Restoring to "${PRODUCTION_WEBHOOK_URL}"...`);
      restored = await telegram.setWebhook(PRODUCTION_WEBHOOK_URL);
    }

    const updatedInfo = needsHeal && restored ? await telegram.getWebhookInfo() : info;

    return NextResponse.json({
      ok: true,
      status: 'healthy',
      webhook: {
        url: updatedInfo?.url || '',
        pending_update_count: updatedInfo?.pending_update_count || 0,
        last_error_date: updatedInfo?.last_error_message ? updatedInfo.last_error_date : undefined,
        last_error_message: updatedInfo?.last_error_message || null,
        target_url: PRODUCTION_WEBHOOK_URL,
        restored,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Telegram Watchdog Error]:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Watchdog error' }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}

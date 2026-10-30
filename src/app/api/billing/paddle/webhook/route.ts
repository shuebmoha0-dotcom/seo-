import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('paddle-signature');

    // Strict webhook signature verification when PADDLE_WEBHOOK_SECRET_KEY is configured
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET_KEY;
    if (webhookSecret) {
      if (!signature) {
        console.warn('[Paddle Webhook] Missing paddle-signature header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }
      try {
        const parts = signature.split(';');
        const tsMatch = parts.find(p => p.startsWith('ts='))?.split('=')[1];
        const h1Match = parts.find(p => p.startsWith('h1='))?.split('=')[1];

        if (!tsMatch || !h1Match) {
          return NextResponse.json({ error: 'Malformed signature header' }, { status: 401 });
        }

        const signedPayload = `${tsMatch}:${rawBody}`;
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(signedPayload)
          .digest('hex');

        if (expectedSig !== h1Match) {
          console.warn('[Paddle Webhook] Invalid signature mismatch');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      } catch (sigErr: any) {
        console.warn('[Paddle Webhook] Signature check warning:', sigErr.message);
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type;
    const eventData = payload.data;

    console.log(`[Paddle Webhook] Received event: ${eventType}`);

    const supabase = createAdminClient();

    // Handle Subscription & Transaction events
    if (
      eventType === 'subscription.created' ||
      eventType === 'subscription.updated' ||
      eventType === 'subscription.activated' ||
      eventType === 'transaction.completed'
    ) {
      const customData = eventData.custom_data || {};
      const customerEmail = eventData.customer?.email || customData.user_email;
      let userId = customData.user_id;

      // If user_id wasn't in custom_data, resolve via email in auth.users
      if (!userId && customerEmail) {
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('email', customerEmail)
          .maybeSingle();
        if (userRecord) userId = userRecord.id;
      }

      if (userId) {
        // Determine plan tier from items/price_id
        const items = eventData.items || [];
        const firstPriceId = items[0]?.price?.id || '';
        let planId = 'starter';
        if (firstPriceId.includes('growth')) planId = 'growth';
        if (firstPriceId.includes('agency')) planId = 'agency';

        const subscriptionId = eventData.id || eventData.subscription_id;
        const customerId = eventData.customer_id;
        const status = eventData.status || 'active';
        const currentPeriodEnd = eventData.current_billing_period?.ends_at || null;

        await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            customer_id: customerId,
            subscription_id: subscriptionId,
            plan_id: planId,
            status: status === 'active' ? 'active' : status === 'trialing' ? 'active' : status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        console.log(`[Paddle Webhook] Subscription synced for user ${userId} -> Plan: ${planId}, Status: ${status}`);
      }
    } else if (eventType === 'subscription.canceled') {
      const subscriptionId = eventData.id;
      if (subscriptionId) {
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);
        console.log(`[Paddle Webhook] Subscription marked canceled: ${subscriptionId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Paddle Webhook Error]:', err);
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}

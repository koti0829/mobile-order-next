import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getSupabaseServer } from '@/lib/supabase-server';

// checkout/route.ts の metadata.items と同じ型
type StockItem = { id: number; qty: number };

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET が設定されていません');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Stripe 署名を検証
  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  // ── デモセッションは完全スルー（在庫・注文に一切触れない） ──
  // /api/demo-checkout が付与する metadata.demo === 'true' を検出したら即 200。
  // デモは在庫予約していないため restore も不要。本物セッションの挙動は不変。
  const obj = event.data.object as { metadata?: Record<string, string> };
  if (obj?.metadata?.demo === 'true') {
    return NextResponse.json({ received: true });
  }

  // checkout.session.expired → 確保済み在庫を戻す
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const rawItems = session.metadata?.items;

    if (rawItems) {
      try {
        const items: StockItem[] = JSON.parse(rawItems);
        const supabase = getSupabaseServer();
        for (const item of items) {
          await supabase.rpc('restore_stock', {
            p_menu_id: item.id,
            p_qty:     item.qty,
          });
        }
        console.log(`[webhook] restore_stock: session=${session.id}, items=${rawItems}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[webhook] restore_stock 失敗:', message);
        // Stripe に 500 を返すと再送されるため、ここでは 200 を返す
      }
    }
  }

  return NextResponse.json({ received: true });
}

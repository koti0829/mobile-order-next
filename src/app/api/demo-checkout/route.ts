import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getStripe } from '@/lib/stripe';

// ── デモ専用チェックアウト（隔離） ───────────────────────────────
// 本物の /api/checkout とは別ルート。以下を一切行わない:
//   - reserve_stock（在庫予約）
//   - 受付停止チェック
//   - DB への注文書き込み
// Stripe セッションの metadata に demo:'true' を付与し、Webhook 側で
// 在庫・注文操作を完全スキップさせる。受付番号は本物と同じ英大文字8桁形式。

function genOrderNum(): string {
  // UUID の先頭8文字を大文字化（例: A3F2B1C4）。本物ルートと同形式。
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

interface CheckoutItem {
  menuId:   number;
  name:     string;
  desc?:    string;
  price:    number;
  quantity: number;
  optionNames?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const { items, slot }: { items: CheckoutItem[]; slot: string } = await req.json();
    const origin = req.headers.get('origin') ?? 'http://localhost:3000';

    // 在庫予約・受付停止チェック・DB 書き込みは一切行わない（隔離）
    const orderNumber = genOrderNum();
    const stockItems  = JSON.stringify(
      items.map(i => ({ id: i.menuId, qty: i.quantity }))
    );

    const session = await stripe.checkout.sessions.create({
      customer_creation: 'always',
      line_items: items.map((item) => ({
        price_data: {
          currency: 'jpy',
          product_data: {
            name: item.name,
            ...(item.desc ? { description: item.desc } : {}),
          },
          unit_amount: item.price,
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${origin}/demo/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/demo`,
      // demo:'true' を必ず付与 → Webhook が在庫・注文を完全スキップする
      metadata:    { orderNumber, slot, items: stockItems, demo: 'true' },
      locale:      'ja',
    });

    return NextResponse.json({ url: session.url, orderNumber });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '不明なエラー';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

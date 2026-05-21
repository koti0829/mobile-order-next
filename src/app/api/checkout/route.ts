import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getStripe } from '@/lib/stripe';
import { getSupabaseServer } from '@/lib/supabase-server';

function genOrderNum(): string {
  // UUID の先頭8文字を大文字化（例: A3F2B1C4）
  // 16^8 = 約43億通り、実用上衝突なし
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

    const supabase = getSupabaseServer();

    // ── 受付停止チェック ──
    const { data: pausedRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'order_paused')
      .maybeSingle();

    if (pausedRow?.value === true) {
      return NextResponse.json(
        { error: '現在注文受付を停止しています' },
        { status: 400 }
      );
    }

    // ── 在庫を原子的に確保（reserve_stock RPC） ──
    const reservedItems: { menuId: number; qty: number }[] = [];
    try {
      for (const item of items) {
        const { data: ok, error: rpcErr } = await supabase.rpc('reserve_stock', {
          p_menu_id: item.menuId,
          p_qty:     item.quantity,
        });
        if (rpcErr) throw rpcErr;
        if (!ok) {
          // 確保失敗 → 既に確保済みの分を戻す
          for (const r of reservedItems) {
            await supabase.rpc('restore_stock', { p_menu_id: r.menuId, p_qty: r.qty });
          }
          const { data: menuRow } = await supabase
            .from('menu').select('name, stock').eq('id', item.menuId).maybeSingle();
          const remaining = menuRow?.stock ?? 0;
          const msg = remaining <= 0
            ? `${menuRow?.name ?? 'メニュー'} は売り切れです`
            : `${menuRow?.name ?? 'メニュー'} の在庫が不足しています（残り${remaining}個）`;
          return NextResponse.json({ error: msg }, { status: 400 });
        }
        reservedItems.push({ menuId: item.menuId, qty: item.quantity });
      }

      // ── Stripe セッション作成 ──
      const orderNumber = genOrderNum();
      const stockItems  = JSON.stringify(
        items.map(i => ({ id: i.menuId, qty: i.quantity }))
      );

      const session = await stripe.checkout.sessions.create({
        // payment_method_types を省略することで Stripe Dashboard の設定が自動適用される
        // （Dynamic Payment Methods）。PayPay / Apple Pay / Google Pay を追加する場合は
        // Stripe ダッシュボード → 設定 → 決済手段 で有効化すること：
        // https://dashboard.stripe.com/settings/payment_methods
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
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/`,
        metadata:    { orderNumber, slot, items: stockItems },
        locale:      'ja',
      });

      return NextResponse.json({ url: session.url, orderNumber });
    } catch (err: unknown) {
      // Stripe 失敗 or その他例外 → 全在庫を戻す
      for (const r of reservedItems) {
        await supabase.rpc('restore_stock', { p_menu_id: r.menuId, p_qty: r.qty });
      }
      const message = err instanceof Error ? err.message : '不明なエラー';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '不明なエラー';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

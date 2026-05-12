import { getStripe } from '@/lib/stripe';
import { getSupabaseServer } from '@/lib/supabase-server';
import type { OrderData } from '@/types';
import TicketDisplay from './TicketDisplay';
import Link from 'next/link';

const SLOT_LABEL: Record<string, string> = {
  breakfast: '朝食',
  lunch:     '昼食',
  dinner:    '夕食',
};

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function SuccessPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return <ErrorView message="URLが正しくありません" />;
  }

  try {
    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    const orderNumber  = session.metadata?.orderNumber ?? '---';
    const slot         = session.metadata?.slot ?? 'lunch';
    const slotLabel    = SLOT_LABEL[slot] ?? '食事';
    // metadata.items = JSON.stringify([{ id: menuId, qty: number }])
    const parsedItems  = JSON.parse(session.metadata?.items ?? '[]') as { id: number; qty: number }[];
    const lineItems    = (session.line_items?.data ?? []).map((li, i) => ({
      name:       li.description ?? '',
      qty:        li.quantity ?? 1,
      unitAmount: li.amount_total ?? 0,
      menuId:     parsedItems[i]?.id,
    }));
    const total = session.amount_total ?? 0;

    const supabase = getSupabaseServer();

    // DBに注文を保存（重複は無視）
    // ※ 在庫は checkout 時の reserve_stock で確保済みなので、ここでは減算不要
    try {
      await supabase.from('orders').upsert(
        {
          id:                orderNumber,
          slot_label:        slotLabel,
          items:             lineItems.map(li => ({
            name:   li.name,
            qty:    li.qty,
            price:  li.unitAmount,
            menuId: li.menuId,
          })),
          total,
          status:            'pending',
          stripe_session_id: session.id,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    } catch {
      // DB保存失敗は食券表示を止めない
    }

    const orderData: OrderData = {
      orderNumber,
      slotLabel,
      lineItems,
      total,
      time:      new Date().toISOString(),
      sessionId: session.id,
    };

    return <TicketDisplay orderData={orderData} />;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '不明なエラー';
    return <ErrorView message={message} />;
  }
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="closed-view" style={{ minHeight: '100vh' }}>
      <div className="icon">❌</div>
      <h2>エラーが発生しました</h2>
      <p>{message}</p>
      <Link href="/" style={{ display: 'inline-block', marginTop: 20, color: 'var(--primary)', fontWeight: 700 }}>
        トップへ戻る
      </Link>
    </div>
  );
}

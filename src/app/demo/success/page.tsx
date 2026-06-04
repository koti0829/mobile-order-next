import type { Metadata } from 'next';
import { getStripe } from '@/lib/stripe';
import Link from 'next/link';

// デモ控えページは検索インデックスに載せない
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const APP_URL = 'https://mobile-order-try.vercel.app';

const SLOT_LABEL: Record<string, string> = {
  breakfast: '朝食',
  lunch:     '昼食',
  dinner:    '夕食',
};

const SLOT_EMOJI: Record<string, string> = {
  breakfast: '🌅',
  lunch:     '☀️',
  dinner:    '🌙',
};

type Props = { searchParams: Promise<{ session_id?: string }> };

// 隔離デモの控え画面。Stripe セッションの情報だけで食券を表示する。
// DB への読み書きは一切行わない（本物の /success と異なり upsert しない）。
export default async function DemoSuccessPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return <ErrorView message="URLが正しくありません" />;
  }

  try {
    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    const orderNumber = session.metadata?.orderNumber ?? '---';
    const slot        = session.metadata?.slot ?? 'lunch';
    const slotLabel   = SLOT_LABEL[slot] ?? '食事';
    const slotEmoji   = SLOT_EMOJI[slot] ?? '🍽️';
    const lineItems   = (session.line_items?.data ?? []).map((li) => ({
      name:       li.description ?? '',
      qty:        li.quantity ?? 1,
      unitAmount: li.amount_total ?? 0,
    }));
    const total = session.amount_total ?? 0;

    const now     = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    return (
      <div className="ticket-page">
        <div className="ticket-wrap">
          <div className="ticket-header">
            <h2>学生食堂</h2>
            <div className="shop">MOBILE ORDER</div>
            <div className="slot-label">{slotEmoji} {slotLabel}</div>
          </div>

          <div className="ticket-num-row">
            <div>
              <div className="order-num">{orderNumber}</div>
              <div className="order-num-label">受付番号</div>
            </div>
          </div>

          <div className="ticket-items">
            {lineItems.map((li, i) => (
              <div key={i}>
                <div className="t-item">
                  <span>{li.name} × {li.qty}</span>
                  <span>¥{li.unitAmount.toLocaleString()}</span>
                </div>
              </div>
            ))}
            <div className="t-total">
              <span>合計</span>
              <span>¥{total.toLocaleString()}</span>
            </div>
          </div>

          <div className="ticket-footer">
            <div className="note" style={{
              background: '#fffbe6', border: '1px solid #f0c000',
              borderRadius: 12, padding: '12px 14px', color: '#7a5c00',
            }}>
              👀 これはデモ決済の控えです。<br />
              実際の注文は登録されていません。
            </div>
            <div className="time-str">注文時刻：{timeStr}</div>

            <Link href="/demo" className="ticket-home" style={{ marginTop: 20 }}>
              もう一度試す
            </Link>
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ticket-home"
              style={{ marginTop: 10 }}
            >
              実際のアプリを開く →
            </a>
          </div>
        </div>
      </div>
    );
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
      <Link href="/demo" style={{ display: 'inline-block', marginTop: 20, color: 'var(--primary)', fontWeight: 700 }}>
        デモへ戻る
      </Link>
    </div>
  );
}

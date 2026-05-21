'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OrderData, RecentTicket } from '@/types';
import { RECENT_TICKETS_KEY } from '@/lib/menu';
import storage from '@/lib/storage';

interface Props { orderData: OrderData }

export default function TicketDisplay({ orderData }: Props) {
  const { orderNumber, slotLabel, lineItems, total, time } = orderData;
  const [received, setReceived]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  // 食券を recentTickets に保存（最大10件）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = storage.get(RECENT_TICKETS_KEY) ?? '[]';
      const tickets: RecentTicket[] = JSON.parse(raw);
      // 同じ orderNumber が既にある場合は追加しない
      if (!tickets.find(t => t.orderNumber === orderNumber)) {
        const entry: RecentTicket = {
          url:         window.location.href,
          orderNumber,
          time,
        };
        const next = [entry, ...tickets].slice(0, 10);
        storage.set(RECENT_TICKETS_KEY, JSON.stringify(next));
      }
    } catch { /* ignore */ }
  }, [orderNumber, time]);

  // 受け取り完了後、3秒でトップへ
  useEffect(() => {
    if (!received) return;
    const timer = setTimeout(() => router.push('/'), 1000);
    return () => clearTimeout(timer);
  }, [received, router]);

  // 受け取り確認：この食券のみ削除して完了
  const handleConfirm = () => {
    try {
      const raw = storage.get(RECENT_TICKETS_KEY) ?? '[]';
      const tickets: RecentTicket[] = JSON.parse(raw);
      const next = tickets.filter(t => t.orderNumber !== orderNumber);
      storage.set(RECENT_TICKETS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
    setShowConfirm(false);
    setReceived(true);
  };

  const t = new Date(time);
  const timeStr = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;

  // ── 受け取り完了画面 ──
  if (received) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a9e5c 0%, #0d7a45 100%)',
        color: '#fff', textAlign: 'center', padding: 32,
      }}>
        <div style={{ fontSize: 96, marginBottom: 24 }}>✅</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>受け取り完了！</h1>
        <p style={{ fontSize: 18, opacity: 0.85, marginBottom: 4 }}>{orderNumber}</p>
        <p style={{ fontSize: 14, opacity: 0.6, marginTop: 32 }}>1秒後にトップへ戻ります...</p>
      </div>
    );
  }

  // ── 食券画面 ──
  return (
    <div className="ticket-page">
      <div className="ticket-wrap">
        <div className="ticket-header">
          <h2>学生食堂</h2>
          <div className="shop">MOBILE ORDER</div>
          <div className="slot-label">{slotLabel}</div>
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
              {li.optionNames && li.optionNames.length > 0 && (
                <div className="t-item-options">
                  {li.optionNames.map(n => (
                    <span key={n} className="t-option-tag">{n}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="t-total">
            <span>合計</span>
            <span>¥{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="ticket-footer">
          <div className="note">
            ✅ お支払い完了<br />
            番号が呼ばれるまでお待ちください。<br />
            カウンターでこの画面をお見せください。
          </div>
          <div className="time-str">注文時刻：{timeStr}</div>

          {/* 受け取り確認ボタン → ダイアログを開く */}
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              display: 'block', width: '100%', marginTop: 20,
              padding: '16px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #1a9e5c, #0d7a45)',
              color: '#fff', fontSize: 18, fontWeight: 800,
              cursor: 'pointer', letterSpacing: 1,
            }}
          >
            ✅ 受け取り確認
          </button>

          <Link href="/" className="ticket-home" style={{ marginTop: 12 }}>
            続けて注文する
          </Link>
        </div>
      </div>

      {/* ── 受け取り確認ダイアログ ── */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--card)', borderRadius: 20,
            padding: '28px 24px', width: '100%', maxWidth: 320,
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.4)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
              受け取り確認
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
              この注文を受け取り済みにしますか？
            </p>
            <button
              onClick={handleConfirm}
              style={{
                display: 'block', width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #1a9e5c, #0d7a45)',
                color: '#fff', border: 'none', borderRadius: 30,
                fontSize: 16, fontWeight: 800, cursor: 'pointer', marginBottom: 10,
              }}
            >
              確認する ✅
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              style={{
                display: 'block', width: '100%', padding: '12px',
                background: 'none', border: 'none',
                fontSize: 14, color: 'var(--muted)', cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import type { CSSProperties } from 'react';

// ─── phone frame ──────────────────────────────────────────────────
const FRAME: CSSProperties = {
  maxWidth: 390,
  margin: '0 auto',
  borderRadius: 24,
  boxShadow: '0 8px 40px rgba(0,0,0,.18)',
  overflow: 'hidden',
  border: '1px solid var(--border)',
  background: 'var(--card)',
};

// ─── caption ─────────────────────────────────────────────────────
function Caption({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div style={{ maxWidth: 390, margin: '48px auto 12px', padding: '0 20px' }}>
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 1,
        color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase',
      }}>
        State {n}
      </p>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

// ─── app header ──────────────────────────────────────────────────
function AppHeader({ badge }: { badge?: boolean }) {
  return (
    <header className="header">
      <div className="header-top">
        <div>
          <div className="shop-name">学生食堂</div>
          <div className="shop-sub">モバイルオーダー</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="cart-btn" style={{ cursor: 'default' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ width: 24, height: 24 }}>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {badge && <span className="cart-badge show">2</span>}
          </button>
        </div>
      </div>
      <div className="cat-tabs">
        <button className="cat-tab active" style={{ cursor: 'default' }}>SET MENU</button>
        <button className="cat-tab" style={{ cursor: 'default' }}>NOODLE</button>
      </div>
    </header>
  );
}

// ─── time banner ────────────────────────────────────────────────
function TimeBanner() {
  return (
    <div className="time-banner lunch">
      <div className="tb-left">
        <span className="tb-dot" />
        <span>☀️ 昼食&nbsp;&nbsp;受付中</span>
      </div>
      <div className="tb-right">11:30〜13:30</div>
    </div>
  );
}

// ─── menu items ──────────────────────────────────────────────────
function MenuItems({ paused = false }: { paused?: boolean }) {
  const btnProps = paused
    ? { disabled: true, style: { opacity: 0.5, cursor: 'not-allowed' as const } }
    : { style: { cursor: 'default' as const } };
  return (
    <>
      <div className="menu-section">
        <div className="sec-title">SET MENU</div>
        <div className="menu-grid">
          <div className="item-card">
            <div className="item-img"><span className="emoji">🍗</span></div>
            <div className="item-info">
              <div className="item-name">唐揚げ定食</div>
              <div className="item-footer">
                <div className="item-price">¥600 <small>税込</small></div>
                <button className="add-btn" {...btnProps}>+</button>
              </div>
            </div>
          </div>
          <div className="item-card">
            <div className="item-img"><span className="emoji">🍱</span></div>
            <div className="item-info">
              <div className="item-name">日替わり弁当</div>
              <div style={{ fontSize: 10, color: '#ff3b30', fontWeight: 700, marginTop: 2 }}>
                残り 3 個
              </div>
              <div className="item-footer">
                <div className="item-price">¥500 <small>税込</small></div>
                <button className="add-btn" {...btnProps}>+</button>
              </div>
            </div>
          </div>
          <div className="item-card">
            <div className="item-img"><span className="emoji">🍛</span></div>
            <div className="item-info">
              <div className="item-name">カレーライス</div>
              <div className="item-footer">
                <div className="item-price">¥450 <small>税込</small></div>
                <button className="add-btn" {...btnProps}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="menu-section">
        <div className="sec-title">NOODLE</div>
        <div className="menu-grid">
          <div className="item-card sold-out">
            <div className="sold-badge">売り切れ</div>
            <div className="item-img"><span className="emoji">🍜</span></div>
            <div className="item-info">
              <div className="item-name">醤油ラーメン</div>
              <div className="item-footer">
                <div className="item-price">¥550 <small>税込</small></div>
                <span style={{ fontSize: 11, color: '#ff3b30', fontWeight: 700 }}>売り切れ</span>
              </div>
            </div>
          </div>
          <div className="item-card">
            <div className="item-img"><span className="emoji">🍵</span></div>
            <div className="item-info">
              <div className="item-name">月見うどん</div>
              <div className="item-footer">
                <div className="item-price">¥400 <small>税込</small></div>
                <button className="add-btn" {...btnProps}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── main page ───────────────────────────────────────────────────
export default function DemoPage() {
  const APP_URL = 'https://mobile-order-try.vercel.app';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 64 }}>

      {/* ── Sticky demo banner ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 999,
        background: '#fffbe6', borderBottom: '2px solid #f0c000',
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 700, color: '#7a5c00',
      }}>
        <span style={{ fontSize: 16 }}>👀</span>
        操作デモ — 実際の注文・決済は行われません
      </div>

      {/* ── Intro ── */}
      <div style={{
        maxWidth: 390, margin: '0 auto', padding: '32px 20px 24px', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 12 }}>
          操作デモ
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>
          このページは注文画面の各状態をまとめた操作イメージです。<br />
          実際の注文・決済は行われません。
        </p>
        <a
          href={APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block', padding: '12px 28px', borderRadius: 30,
            background: 'var(--primary)', color: '#fff',
            fontSize: 14, fontWeight: 800, textDecoration: 'none',
          }}
        >
          実際のアプリを開く →
        </a>
      </div>

      {/* ════════════════════════════════════════
          STATE 1: メニュー一覧（営業中）
      ════════════════════════════════════════ */}
      <Caption
        n={1}
        title="メニュー一覧（営業中）"
        desc="昼食時間帯のメニュー一覧。「売り切れ」と「残りわずか」の状態も確認できます。カートバーが下部に表示されます。"
      />
      <div style={FRAME}>
        <TimeBanner />
        <AppHeader />
        <main style={{ paddingBottom: 70 }}>
          <MenuItems />
        </main>
        {/* Cart bar */}
        <div className="cart-bar show" style={{ position: 'relative' }}>
          <button className="cart-bar-btn" style={{ cursor: 'default' }}>
            <span className="cart-bar-count">2点</span>
            <span>カートを確認する</span>
            <span>¥1,050</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════
          STATE 2: オプション選択モーダル
      ════════════════════════════════════════ */}
      <Caption
        n={2}
        title="オプション選択モーダル"
        desc="商品の「+」をタップすると、トッピングを選択するモーダルが開きます。"
      />
      <div style={{ ...FRAME, position: 'relative', height: 480 }}>
        {/* Background (dimmed) */}
        <div style={{ opacity: 0.3, pointerEvents: 'none' }}>
          <TimeBanner />
          <AppHeader badge />
          <main><MenuItems /></main>
        </div>
        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,.45)',
        }} />
        {/* Option modal */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--card)',
          borderRadius: '24px 24px 0 0',
          paddingBottom: 24,
        }}>
          <div className="sheet-handle" />
          <div className="sheet-header">
            <span className="sheet-title">🍗 唐揚げ定食</span>
            <button className="sheet-close" style={{ cursor: 'default' }}>✕</button>
          </div>
          <div className="option-modal-body">
            <p className="option-base-price">本体価格：¥600</p>
            <label className="option-row">
              <input type="checkbox" readOnly />
              <span className="option-name">大盛り</span>
              <span className="option-price">+¥100</span>
            </label>
            <label className="option-row">
              <input type="checkbox" readOnly />
              <span className="option-name">温泉卵</span>
              <span className="option-price">+¥80</span>
            </label>
          </div>
          <div className="option-modal-footer">
            <div className="option-total">合計：¥600</div>
            <button className="primary-btn" style={{ cursor: 'default' }}>
              カートに追加する
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          STATE 3: カート（ボトムシート）
      ════════════════════════════════════════ */}
      <Caption
        n={3}
        title="カート（ボトムシート）"
        desc="カートボタンをタップすると、追加した商品と合計金額が表示されます。数量も変更できます。"
      />
      <div style={{ ...FRAME, position: 'relative', height: 560 }}>
        {/* Background (dimmed) */}
        <div style={{ opacity: 0.3, pointerEvents: 'none' }}>
          <TimeBanner />
          <AppHeader badge />
          <main><MenuItems /></main>
        </div>
        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,.45)',
        }} />
        {/* Cart sheet */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--card)',
          borderRadius: '24px 24px 0 0',
        }}>
          <div className="sheet-handle" />
          <div className="sheet-header">
            <span className="sheet-title">🛒 カート</span>
            <button className="sheet-close" style={{ cursor: 'default' }}>✕</button>
          </div>
          <div className="cart-items">
            <div className="cart-item">
              <div className="cart-item-thumb"><span className="emoji">🍗</span></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cart-item-name">唐揚げ定食</div>
                <div className="cart-item-price">¥600</div>
              </div>
              <div className="cqty">
                <button className="cq-m" style={{ cursor: 'default' }}>−</button>
                <span className="cq-n">1</span>
                <button className="cq-p" style={{ cursor: 'default' }}>+</button>
              </div>
            </div>
            <div className="cart-item">
              <div className="cart-item-thumb"><span className="emoji">🍛</span></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cart-item-name">カレーライス</div>
                <div className="cart-item-price">¥450</div>
              </div>
              <div className="cqty">
                <button className="cq-m" style={{ cursor: 'default' }}>−</button>
                <span className="cq-n">1</span>
                <button className="cq-p" style={{ cursor: 'default' }}>+</button>
              </div>
            </div>
          </div>
          <div className="cart-footer">
            <div className="sum-row"><span>小計</span><span>¥955</span></div>
            <div className="sum-row"><span>消費税（10%）</span><span>¥95</span></div>
            <div className="sum-row total"><span>合計（税込）</span><span>¥1,050</span></div>
            <button className="primary-btn" style={{ cursor: 'default' }}>
              注文確認へ進む →
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          STATE 4: 注文確認
      ════════════════════════════════════════ */}
      <Caption
        n={4}
        title="注文確認"
        desc="注文内容と合計金額を最終確認します。確定するとStripeの決済画面へ進みます。"
      />
      <div style={{ ...FRAME, position: 'relative', height: 520 }}>
        {/* Background (dimmed) */}
        <div style={{ opacity: 0.3, pointerEvents: 'none' }}>
          <TimeBanner />
          <AppHeader badge />
          <main><MenuItems /></main>
        </div>
        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,.45)',
        }} />
        {/* Confirm sheet */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--card)',
          borderRadius: '24px 24px 0 0',
        }}>
          <div className="sheet-handle" />
          <div className="sheet-header">
            <span className="sheet-title">📋 注文確認</span>
            <button className="sheet-close" style={{ cursor: 'default' }}>✕</button>
          </div>
          <div className="confirm-body">
            <div style={{ padding: '14px 18px 0' }}>
              <div className="confirm-block">
                <div className="confirm-block-title">ご注文内容</div>
                <div className="confirm-item">
                  <span>🍗 唐揚げ定食 × 1</span>
                  <span>¥600</span>
                </div>
                <div className="confirm-item">
                  <span>🍛 カレーライス × 1</span>
                  <span>¥450</span>
                </div>
                <div className="confirm-item total">
                  <span>合計（税込）</span>
                  <span>¥1,050</span>
                </div>
              </div>
              <p className="confirm-notice">
                注文を確定するとStripeの決済画面に移動します。<br />
                決済完了後、食券番号が発行されます。
              </p>
              <button className="order-btn" style={{ cursor: 'default' }}>
                注文を確定して決済へ 💳
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          STATE 5: 食券
      ════════════════════════════════════════ */}
      <Caption
        n={5}
        title="食券（受付番号）"
        desc="決済完了後に食券が発行されます。受付番号をカウンターでご提示ください。"
      />
      <div style={FRAME}>
        <div className="ticket-page" style={{ minHeight: 'unset' }}>
          <div className="ticket-wrap">
            <div className="ticket-header">
              <h2>学生食堂</h2>
              <div className="shop">MOBILE ORDER</div>
              <div className="slot-label">☀️ 昼食</div>
            </div>
            <div className="ticket-num-row">
              <div>
                <div className="order-num">A1B2C3D4</div>
                <div className="order-num-label">受付番号</div>
              </div>
            </div>
            <div className="ticket-items">
              <div className="t-item">
                <span>唐揚げ定食 × 1</span>
                <span>¥600</span>
              </div>
              <div className="t-item">
                <span>カレーライス × 1</span>
                <span>¥450</span>
              </div>
              <div className="t-total">
                <span>合計</span>
                <span>¥1,050</span>
              </div>
            </div>
            <div className="ticket-footer">
              <div className="note">
                ✅ お支払い完了<br />
                番号が呼ばれるまでお待ちください。<br />
                カウンターでこの画面をお見せください。
              </div>
              <div className="time-str">注文時刻：12:34</div>
              <button style={{
                display: 'block', width: '100%', marginTop: 20,
                padding: '16px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #1a9e5c, #0d7a45)',
                color: '#fff', fontSize: 18, fontWeight: 800,
                cursor: 'default', letterSpacing: 1,
              }}>
                ✅ 受け取り確認
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          STATE 6: 受付停止
      ════════════════════════════════════════ */}
      <Caption
        n={6}
        title="受付停止"
        desc="管理画面から受付を一時停止すると、注文ボタンが無効化されこのバナーが表示されます。"
      />
      <div style={FRAME}>
        <TimeBanner />
        <div className="paused-banner">
          <span className="paused-banner-icon">⛔</span>
          <div>
            <div className="paused-banner-title">注文受付を停止しています</div>
            <div className="paused-banner-sub">再開までお待ちください</div>
          </div>
        </div>
        <AppHeader badge />
        <main style={{ paddingBottom: 16 }}>
          <MenuItems paused />
        </main>
      </div>

      {/* ── Footer ── */}
      <div style={{
        maxWidth: 390, margin: '56px auto 0', padding: '0 20px', textAlign: 'center',
      }}>
        <a
          href={APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block', padding: '12px 28px', borderRadius: 30,
            background: 'var(--primary)', color: '#fff',
            fontSize: 14, fontWeight: 800, textDecoration: 'none',
            marginBottom: 16,
          }}
        >
          実際のアプリを開く →
        </a>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          このページは操作イメージの確認用です。<br />
          実際の注文・決済・在庫操作は行われません。
        </p>
      </div>

    </div>
  );
}

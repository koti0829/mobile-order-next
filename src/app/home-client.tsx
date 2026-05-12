'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { MenuItem, AppStatus, Slot, OptionItem, CartEntry, RecentTicket } from '@/types';
import type { AppSettings, OperatingHours, HolidayEntry, RegularHolidayEntry } from '@/lib/settings';
import { SLOTS, TEST_MODE, TEST_SLOT, RECENT_TICKETS_KEY } from '@/lib/menu';
import storage from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { mapMenuRow, mapOptionRow } from '@/lib/db-mappers';

// ── デフォルト営業時間（settings ロード前のフォールバック） ──
const DEFAULT_HOURS: OperatingHours = {
  breakfast: { sh: [8, 30],  eh: [10, 0]  },
  lunch:     { sh: [11, 0],  eh: [14, 0]  },
  dinner:    { sh: [17, 0],  eh: [19, 20] },
};

function toMin(h: number, m: number) { return h * 60 + m; }
function nowMin() { const d = new Date(); return toMin(d.getHours(), d.getMinutes()); }
function fmtTime(h: number, m: number) { return `${h}:${String(m).padStart(2, '0')}`; }

/** 特定スロットが今日（曜日含む）休業かを判定 */
function isSlotHoliday(
  holidays: HolidayEntry[],
  regularHolidays: RegularHolidayEntry[],
  slot: Slot
): boolean {
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekday  = new Date().getDay();

  for (const h of holidays) {
    if (h.date !== todayStr) continue;
    if (!h.slots || h.slots.length === 0) return true;   // 終日
    if (h.slots.includes(slot)) return true;
  }
  for (const r of regularHolidays) {
    if (r.weekday !== weekday) continue;
    if (!r.slots || r.slots.length === 0) return true;   // 終日
    if (r.slots.includes(slot)) return true;
  }
  return false;
}

function getStatus(settings: AppSettings | null): AppStatus {
  if (TEST_MODE) return { status: 'open', slot: TEST_SLOT, slotInfo: SLOTS[TEST_SLOT] };

  if (!settings) return { status: 'closed' };

  // 最優先: 受付停止
  if (settings.orderPaused) {
    const pausedHours = settings.operatingHours ?? DEFAULT_HOURS;
    const pn = nowMin();
    for (const [key, h] of Object.entries(pausedHours) as [Slot, { sh: [number, number]; eh: [number, number] }][]) {
      const [sh, sm] = h.sh, [eh, em] = h.eh;
      if (pn >= toMin(sh, sm) && pn < toMin(eh, em)) {
        return { status: 'paused', slot: key, slotInfo: SLOTS[key] };
      }
    }
    // 営業時間外でもデフォルトスロットを設定（メニュー表示用）
    return { status: 'paused', slot: 'lunch', slotInfo: SLOTS['lunch'] };
  }

  const holidays        = settings?.holidays        ?? [];
  const regularHolidays = settings?.regularHolidays ?? [];
  const todayStr        = new Date().toISOString().slice(0, 10);
  const weekday         = new Date().getDay();

  // 終日休業チェック（全スロット対象）
  const isAllDayHoliday =
    holidays.some(h => h.date === todayStr && (!h.slots || h.slots.length === 0)) ||
    regularHolidays.some(r => r.weekday === weekday && (!r.slots || r.slots.length === 0));

  if (isAllDayHoliday) return { status: 'holiday' };

  const hours = settings?.operatingHours ?? DEFAULT_HOURS;
  const n = nowMin();

  // 今が営業時間内のスロットを探す → スロット休業なら holiday を返す
  for (const [key, h] of Object.entries(hours) as [Slot, { sh: [number, number]; eh: [number, number] }][]) {
    const [sh, sm] = h.sh, [eh, em] = h.eh;
    if (n >= toMin(sh, sm) && n < toMin(eh, em)) {
      if (isSlotHoliday(holidays, regularHolidays, key)) {
        return { status: 'holiday', slot: key, slotInfo: SLOTS[key] };
      }
      return { status: 'open', slot: key, slotInfo: SLOTS[key] };
    }
  }
  // 次のスロットまで待機
  for (const [key, h] of Object.entries(hours) as [Slot, { sh: [number, number]; eh: [number, number] }][]) {
    const [sh, sm] = h.sh;
    const st = toMin(sh, sm);
    if (n < st) return { status: 'waiting', slot: key, slotInfo: SLOTS[key], minutesUntil: st - n };
  }
  return { status: 'closed' };
}

type Sheet = 'cart' | 'confirm' | null;

const entryKey = (menuId: number, opts: OptionItem[]) =>
  `${menuId}:${opts.map(o => o.id).sort().join(',')}`;

export default function HomePage() {
  const [menu,           setMenu]           = useState<MenuItem[]>([]);
  const [cart,           setCart]           = useState<CartEntry[]>([]);
  const [customOptions,  setCustomOptions]  = useState<OptionItem[]>([]);
  const [modalItem,      setModalItem]      = useState<MenuItem | null>(null);
  const [modalSelected,  setModalSelected]  = useState<OptionItem[]>([]);
  const [activeCategory, setCategory]       = useState('すべて');
  const [sheet,          setSheet]          = useState<Sheet>(null);
  const [settings,       setSettings]       = useState<AppSettings | null>(null);
  const [status,         setStatus]         = useState<AppStatus>(() => getStatus(null));
  const [loading,        setLoading]        = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);
  const [recentTickets,  setRecentTickets]  = useState<RecentTicket[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // メニュー・オプション取得
  useEffect(() => {
    (async () => {
      try {
        const { data: menuRows } = await supabase
          .from('menu')
          .select('*')
          .eq('enabled', true)
          .is('deleted_at', null)
          .order('id');
        setMenu((menuRows ?? []).map(mapMenuRow));

        const { data: optRows } = await supabase.from('options').select('*');
        setCustomOptions((optRows ?? []).map(mapOptionRow));
      } catch {
        setMenu([]);
        setCustomOptions([]);
      }
    })();
  }, []);

  // 設定取得（営業時間・休業日・受付停止）
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('settings fetch failed');
        const data: AppSettings = await res.json();
        setSettings(data);
      } catch {
        setSettings(null);
      }
    })();
  }, []);

  // settings が変わるたびにステータスを再計算・インターバルをリセット
  useEffect(() => {
    setStatus(getStatus(settings));
    const t = setInterval(() => setStatus(getStatus(settings)), 60_000);
    return () => clearInterval(t);
  }, [settings]);

  // 食券履歴
  useEffect(() => {
    try {
      const raw = storage.get(RECENT_TICKETS_KEY) ?? '[]';
      setRecentTickets(JSON.parse(raw));
    } catch {
      setRecentTickets([]);
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const openSheet  = (s: Sheet) => { setSheet(s); document.body.style.overflow = 'hidden'; };
  const closeSheet = ()          => { setSheet(null); document.body.style.overflow = ''; };

  const totalItems = () => cart.reduce((s, e) => s + e.qty, 0);
  const totalPrice = () =>
    cart.reduce((s, e) => {
      const item = menu.find(i => i.id === e.menuId);
      if (!item) return s;
      const optTotal = e.selectedOptions.reduce((os, o) => os + o.price, 0);
      return s + (item.price + optTotal) * e.qty;
    }, 0);

  const entryUnitPrice = (e: CartEntry) => {
    const item = menu.find(i => i.id === e.menuId);
    if (!item) return 0;
    return item.price + e.selectedOptions.reduce((s, o) => s + o.price, 0);
  };

  const itemTotalQty = (id: number) =>
    cart.filter(e => e.menuId === id).reduce((s, e) => s + e.qty, 0);

  const chgQty = (menuId: number, opts: OptionItem[], d: number) => {
    const key = entryKey(menuId, opts);
    setCart(c => {
      const idx = c.findIndex(e => entryKey(e.menuId, e.selectedOptions) === key);
      if (idx === -1) return c;
      const next = c[idx].qty + d;
      if (next <= 0) return c.filter((_, i) => i !== idx);
      return c.map((e, i) => i === idx ? { ...e, qty: next } : e);
    });
  };

  const availableOptions = (item: MenuItem): OptionItem[] => {
    const todayWeekday = new Date().getDay();
    const currSlot = status.slot;
    return customOptions.filter(o => {
      if (o.appliesTo !== 'all' && o.appliesTo !== item.category) return false;
      if (o.weekdays && o.weekdays.length > 0 && o.weekdays.length < 7) {
        if (!o.weekdays.includes(todayWeekday)) return false;
      }
      if (o.slots && o.slots.length > 0 && o.slots.length < 3) {
        if (!currSlot || !o.slots.includes(currSlot)) return false;
      }
      return true;
    });
  };

  const openModal = (item: MenuItem) => { setModalItem(item); setModalSelected([]); };
  const closeModal = () => { setModalItem(null); setModalSelected([]); };
  const toggleOption = (opt: OptionItem) => {
    setModalSelected(prev =>
      prev.find(o => o.id === opt.id) ? prev.filter(o => o.id !== opt.id) : [...prev, opt]
    );
  };
  const addFromModal = () => {
    if (!modalItem) return;
    const key = entryKey(modalItem.id, modalSelected);
    setCart(c => {
      const idx = c.findIndex(e => entryKey(e.menuId, e.selectedOptions) === key);
      if (idx !== -1) return c.map((e, i) => i === idx ? { ...e, qty: e.qty + 1 } : e);
      return [...c, { menuId: modalItem.id, selectedOptions: [...modalSelected], qty: 1 }];
    });
    showToast('カートに追加しました 🛒');
    closeModal();
  };

  const handleCheckout = async () => {
    setLoading(true);

    // ── クライアント側 事前チェック ──
    for (const entry of cart) {
      const item = menu.find(i => i.id === entry.menuId);
      if (!item) continue;
      if (item.soldOut) {
        showToast(`${item.name} は売り切れです`);
        setLoading(false);
        return;
      }
      if (item.stock !== null && item.stock !== undefined && item.stock < entry.qty) {
        showToast(`${item.name} の在庫が不足しています`);
        setLoading(false);
        return;
      }
    }

    const items = cart
      .filter(e => e.qty > 0)
      .map(e => {
        const item = menu.find(i => i.id === e.menuId)!;
        const optionNames = e.selectedOptions.map(o => o.name);
        const unitPrice   = entryUnitPrice(e);
        const displayName = optionNames.length > 0
          ? `${item.name}（${optionNames.join('・')}）`
          : item.name;
        return {
          menuId:   e.menuId,
          name:     displayName,
          desc:     item.desc,
          price:    unitPrice,
          quantity: e.qty,
          optionNames,
        };
      });

    try {
      const res  = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, slot: status.slot ?? 'lunch' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast(`エラー: ${data.error ?? '不明なエラー'}`);
        setLoading(false);
      }
    } catch {
      showToast('通信エラーが発生しました');
      setLoading(false);
    }
  };

  const currentSlot: Slot = (status.slot ?? 'lunch') as Slot;
  const isMenuVisible = status.status === 'open' || status.status === 'paused';
  const activeMenu  = menu.filter(i => i.enabled && isMenuVisible && i.slot === currentSlot);
  const categories  = ['すべて', ...Array.from(new Set(activeMenu.map(i => i.category)))];
  const filtered    = activeMenu.filter(i => activeCategory === 'すべて' || i.category === activeCategory);
  const groups      = filtered.reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});
  const cartEntries = cart.filter(e => e.qty > 0);

  const isOpen    = status.status === 'open';
  const isClosed  = status.status === 'closed';
  const isWaiting = status.status === 'waiting';
  const isPaused  = status.status === 'paused';
  const isHoliday = status.status === 'holiday';

  const bannerClass =
    isOpen    ? status.slot! :
    isWaiting ? 'between' : 'closed';

  // 表示用の有効営業時間
  const effectiveHours = settings?.operatingHours ?? DEFAULT_HOURS;

  return (
    <>
      {/* ── Time Banner ── */}
      <div className={`time-banner ${bannerClass}`}>
        <div className="tb-left">
          <span className="tb-dot" />
          <span>
            {isOpen    ? `${status.slotInfo!.emoji} ${status.slotInfo!.label}営業中`
            : isWaiting ? '⏳ 次の営業まで待機中'
            : isPaused  ? '⛔ 注文受付を一時停止しています'
            : isHoliday
              ? status.slot
                ? `🏫 本日${status.slotInfo!.label}はお休みです`
                : '🏫 本日は休業日です'
            : '🌙 本日の営業は終了しました'}
          </span>
        </div>
        <div className="tb-right">
          {isOpen    ? `終了まで約${toMin(...effectiveHours[status.slot!].eh) - nowMin()}分`
          : isWaiting ? `${Math.floor(status.minutesUntil! / 60)}h${status.minutesUntil! % 60}m後 ${status.slotInfo!.label}開始`
          : isPaused  ? '再開までお待ちください'
          : isHoliday ? '次回の営業日をご確認ください'
          : '明日もよろしくどうぞ'}
        </div>
      </div>

      {/* ── Paused Banner ── */}
      {isPaused && (
        <div className="paused-banner">
          <span className="paused-banner-icon">⛔</span>
          <div>
            <div className="paused-banner-title">注文受付を停止しています</div>
            <div className="paused-banner-sub">再開までお待ちください</div>
          </div>
        </div>
      )}

      {/* ── Test Mode Indicator ── */}
      {TEST_MODE && (
        <div style={{
          background: '#1c1c1e', color: '#ffd60a',
          fontSize: 11, fontWeight: 700,
          textAlign: 'center', padding: '4px 0', letterSpacing: '.5px',
        }}>
          🧪 テストモード（NEXT_PUBLIC_DEV_TEST_MODE=true）
        </div>
      )}

      {/* ── Header ── */}
      <header className="header">
        <div className="header-top">
          <div>
            <div className="shop-name">世田谷キャンパス 学生食堂</div>
            <div className="shop-sub">モバイルオーダー</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {recentTickets.length > 0 && (
              <button
                className="cart-btn"
                onClick={() => {
                  if (recentTickets.length === 1) {
                    window.location.href = recentTickets[0].url;
                  } else {
                    setShowTicketModal(true);
                  }
                }}
                aria-label="食券を表示する"
                title="食券を表示する"
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>🎫</span>
              </button>
            )}
            <button className="cart-btn" onClick={() => openSheet('cart')} aria-label="カート">
              <svg viewBox="0 0 24 24">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <span className={`cart-badge ${totalItems() > 0 ? 'show' : ''}`}>{totalItems()}</span>
            </button>
          </div>
        </div>
        {(isOpen || isPaused) && (
          <div className="cat-tabs">
            {categories.map(cat => (
              <button
                key={cat}
                className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >{cat}</button>
            ))}
          </div>
        )}
      </header>

      {/* ── Menu ── */}
      <main>
        {!isOpen && !isPaused ? (
          <div className="closed-view">
            <div className="icon">
              {isHoliday ? '🏫' : isClosed ? '🌙' : '⏳'}
            </div>
            <h2>
              {isHoliday
                ? status.slot
                  ? `本日${status.slotInfo!.label}はお休みです`
                  : '本日は休業日です'
              : isClosed  ? '本日の営業は終了しました'
              : '準備中...'}
            </h2>
            <p>
              {isHoliday ? '次回の営業日をお待ちください'
              : '次の営業時間をお待ちください'}
            </p>
            {(isClosed || isWaiting) && (
              <div className="hours-table">
                {(Object.entries(SLOTS) as [Slot, typeof SLOTS[Slot]][]).map(([key, s]) => {
                  const h = effectiveHours[key];
                  return (
                    <div key={s.label} className="hours-row">
                      <span className="label">{s.emoji} {s.label}</span>
                      <span className="time">{fmtTime(...h.sh)} 〜 {fmtTime(...h.eh)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          Object.entries(groups).map(([cat, items]) => (
            <section key={cat} className="menu-section">
              <div className="sec-title">{cat}</div>
              <div className="menu-grid">
                {items.map(item => {
                  const qty = itemTotalQty(item.id);
                  const stockLow = item.stock != null && item.stock > 0 && item.stock <= 5;
                  return (
                    <div key={item.id} className={`item-card ${item.soldOut ? 'sold-out' : ''}`}>
                      {item.soldOut && <div className="sold-badge">売り切れ</div>}
                      <div className="item-img">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} />
                          : <span className="emoji">{item.emoji || '🍽️'}</span>}
                      </div>
                      <div className="item-info">
                        <div className="item-name">{item.name}</div>
                        {item.kcal && <div className="item-kcal">{item.kcal} kcal</div>}
                        {stockLow && (
                          <div style={{ fontSize: 10, color: '#ff3b30', fontWeight: 700, marginTop: 2 }}>
                            残り {item.stock} 個
                          </div>
                        )}
                        <div className="item-footer">
                          <div className="item-price">¥{item.price.toLocaleString()} <small>税込</small></div>
                          {item.soldOut ? (
                            <span style={{ fontSize: 11, color: '#ff3b30', fontWeight: 700 }}>売り切れ</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {qty > 0 && <span className="item-in-cart">{qty}</span>}
                              <button
                            className="add-btn"
                            onClick={() => !isPaused && openModal(item)}
                            disabled={isPaused}
                            style={isPaused ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                          >+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <div className="page-bottom" />
      <footer className="page-footer">
        <Link href="/admin" className="admin-link">管理者ログイン</Link>
      </footer>

      {/* ── Cart Bar ── */}
      <div className={`cart-bar ${totalItems() > 0 ? 'show' : ''}`}>
        <button className="cart-bar-btn" onClick={() => openSheet('cart')}>
          <span className="cart-bar-count">{totalItems()}点</span>
          <span>カートを確認する</span>
          <span>¥{totalPrice().toLocaleString()}</span>
        </button>
      </div>

      {/* ── Overlay ── */}
      <div className={`overlay ${sheet ? 'show' : ''}`} onClick={closeSheet} />

      {/* ── Cart Sheet ── */}
      <div className={`sheet ${sheet === 'cart' ? 'show' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-title">🛒 カート</span>
          <button className="sheet-close" onClick={closeSheet}>✕</button>
        </div>
        <div className="cart-items">
          {cartEntries.length === 0 ? (
            <div className="cart-empty">
              <div className="icon">🛒</div>
              <p>カートに商品がありません</p>
            </div>
          ) : cartEntries.map((entry, idx) => {
            const item = menu.find(i => i.id === entry.menuId);
            if (!item) return null;
            const unitPrice = entryUnitPrice(entry);
            return (
              <div key={idx} className="cart-item">
                <div className="cart-item-thumb">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" />
                    : <span className="emoji">{item.emoji || '🍽️'}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cart-item-name">{item.name}</div>
                  {entry.selectedOptions.length > 0 && (
                    <div className="cart-item-options">
                      {entry.selectedOptions.map(o => (
                        <span key={o.id} className="cart-option-tag">+{o.name} ¥{o.price}</span>
                      ))}
                    </div>
                  )}
                  <div className="cart-item-price">¥{(unitPrice * entry.qty).toLocaleString()}</div>
                </div>
                <div className="cqty">
                  <button className="cq-m" onClick={() => chgQty(entry.menuId, entry.selectedOptions, -1)}>−</button>
                  <span className="cq-n">{entry.qty}</span>
                  <button className="cq-p" onClick={() => chgQty(entry.menuId, entry.selectedOptions, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="cart-footer">
          {cartEntries.length > 0 && (
            <>
              <div className="sum-row"><span>小計</span><span>¥{Math.round(totalPrice() / 1.1).toLocaleString()}</span></div>
              <div className="sum-row"><span>消費税（10%）</span><span>¥{Math.round(totalPrice() * 10 / 110).toLocaleString()}</span></div>
              <div className="sum-row total"><span>合計（税込）</span><span>¥{totalPrice().toLocaleString()}</span></div>
            </>
          )}
          <button
            className={`primary-btn ${cartEntries.length === 0 ? 'disabled' : ''}`}
            style={{ marginTop: 12 }}
            onClick={() => { closeSheet(); setTimeout(() => openSheet('confirm'), 50); }}
          >
            注文確認へ進む →
          </button>
        </div>
      </div>

      {/* ── Confirm Sheet ── */}
      <div className={`sheet ${sheet === 'confirm' ? 'show' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-title">📋 注文確認</span>
          <button className="sheet-close" onClick={closeSheet}>✕</button>
        </div>
        <div className="confirm-body">
          <div style={{ padding: '14px 18px 0' }}>
            <div className="confirm-block">
              <div className="confirm-block-title">ご注文内容</div>
              {cartEntries.map((entry, idx) => {
                const item = menu.find(i => i.id === entry.menuId);
                if (!item) return null;
                const unitPrice   = entryUnitPrice(entry);
                const optNames    = entry.selectedOptions.map(o => o.name).join('・');
                const displayName = optNames ? `${item.name}（${optNames}）` : item.name;
                return (
                  <div key={idx} className="confirm-item">
                    <span>{item.emoji} {displayName} × {entry.qty}</span>
                    <span>¥{(unitPrice * entry.qty).toLocaleString()}</span>
                  </div>
                );
              })}
              <div className="confirm-item total">
                <span>合計（税込）</span>
                <span>¥{totalPrice().toLocaleString()}</span>
              </div>
            </div>
            <p className="confirm-notice">
              注文を確定するとStripeの決済画面に移動します。<br />
              決済完了後、食券番号が発行されます。
            </p>
            <button className="order-btn" onClick={handleCheckout} disabled={loading || isPaused}>
              {isPaused ? '受付停止中' : loading ? '処理中...' : '注文を確定して決済へ 💳'}
            </button>
            <button
              style={{ display: 'block', width: '100%', padding: '12px', textAlign: 'center', fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}
              onClick={closeSheet}
            >戻る</button>
          </div>
        </div>
      </div>

      {/* ── Option Modal ── */}
      {modalItem && (
        <>
          <div className="overlay show" onClick={closeModal} />
          <div className="option-modal">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">{modalItem.emoji} {modalItem.name}</span>
              <button className="sheet-close" onClick={closeModal}>✕</button>
            </div>
            <div className="option-modal-body">
              <p className="option-base-price">本体価格：¥{modalItem.price.toLocaleString()}</p>
              {availableOptions(modalItem).map(opt => {
                const checked = !!modalSelected.find(o => o.id === opt.id);
                return (
                  <label key={opt.id} className="option-row">
                    <input type="checkbox" checked={checked} onChange={() => toggleOption(opt)} />
                    <span className="option-name">{opt.name}</span>
                    <span className="option-price">+¥{opt.price}</span>
                  </label>
                );
              })}
              {availableOptions(modalItem).length === 0 && (
                <p className="option-none">追加オプションはありません</p>
              )}
            </div>
            <div className="option-modal-footer">
              <div className="option-total">
                合計：¥{(modalItem.price + modalSelected.reduce((s, o) => s + o.price, 0)).toLocaleString()}
              </div>
              <button className="primary-btn" onClick={addFromModal}>
                カートに追加する
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 食券一覧モーダル ── */}
      {showTicketModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--card)', borderRadius: 20,
            padding: '24px 20px', width: '100%', maxWidth: 340,
            boxShadow: '0 20px 60px rgba(0,0,0,.4)',
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 16, color: 'var(--text)', textAlign: 'center' }}>
              🎫 食券一覧
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {recentTickets.map(ticket => {
                const t = new Date(ticket.time);
                const timeStr = `${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
                return (
                  <div key={ticket.orderNumber} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 12,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)' }}>{ticket.orderNumber}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{timeStr}</div>
                    </div>
                    <button
                      onClick={() => { window.location.href = ticket.url; }}
                      style={{
                        padding: '8px 16px', borderRadius: 20, border: 'none',
                        background: 'var(--primary)', color: '#fff',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      表示する
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setShowTicketModal(false)}
              style={{
                display: 'block', width: '100%', padding: '12px',
                background: 'none', border: 'none',
                fontSize: 14, color: 'var(--muted)', cursor: 'pointer',
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}

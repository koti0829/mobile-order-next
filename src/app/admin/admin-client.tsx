'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MenuItem, Order, Slot, OptionItem } from '@/types';
import type { AppSettings, OperatingHours, HolidayEntry, RegularHolidayEntry } from '@/lib/settings';
import { SLOTS } from '@/lib/menu';
import {
  addMenuItem, updateMenuItem, toggleSoldOut, deleteMenuItem,
  restoreMenuItem, permanentlyDeleteMenuItem, replenishStock,
  addOption, updateOption, deleteOption,
  markOrderReady, deleteOrder, bulkDeleteOrders,
  addAdminEmail, removeAdminEmail,
  updateOperatingHours, setOrderPaused,
  addHoliday, addHolidayBatch, removeHoliday, updateRegularHolidays,
} from './actions';
import { formatDate, formatDateTime } from '@/lib/format';

type AdminTab = 'menu' | 'orders' | 'options' | 'trash' | 'settings';

interface EditState {
  id: number | null;
  imageUrl: string; emoji: string; name: string; desc: string;
  price: string; kcal: string; category: string; slot: Slot; stock: string;
  weekdays: number[];
}

const EMPTY_EDIT: EditState = {
  id: null, imageUrl: '', emoji: '', name: '', desc: '',
  price: '', kcal: '', category: '', slot: 'lunch', stock: '',
  weekdays: [],
};

const SLOT_CLASS  = { breakfast: 'slot-breakfast', lunch: 'slot-lunch', dinner: 'slot-dinner' };
const SLOT_NAME   = { breakfast: '朝食', lunch: '昼食', dinner: '夕食' };
const STATUS_LABEL: Record<string, string> = { pending: '🔴 準備中', ready: '🟢 受取可' };

interface Props {
  currentEmail: string;
  isCurrentEnvAdmin: boolean;
  initialMenu: MenuItem[];
  initialDeletedMenu: MenuItem[];
  initialOrders: Order[];
  initialOptions: OptionItem[];
  initialDbAdmins: string[];
  envAdmins: string[];
  settings: AppSettings;
  isDemo?: boolean;
}

const DEMO_BTN: React.CSSProperties = { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' };

export default function AdminClient(props: Props) {
  const { isDemo = false } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tab,           setTab]          = useState<AdminTab>('menu');
  const [edit,          setEdit]         = useState<EditState | null>(null);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [activeWeekday, setActiveWeekday] = useState(() => new Date().getDay());

  const menu        = props.initialMenu;
  const deletedMenu = props.initialDeletedMenu;
  const orders      = props.initialOrders;
  const options     = props.initialOptions;
  const dbAdmins    = props.initialDbAdmins;

  const run = (fn: () => Promise<void>) => {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });
  };

  // ── Menu management ──
  const categories = Array.from(new Set(menu.map(m => m.category))).sort();

  const openEdit = (id: number | null) => {
    if (id === null) {
      const defaultCat = categories[0] ?? '';
      setIsNewCategory(categories.length === 0);
      setEdit({ ...EMPTY_EDIT, category: defaultCat });
      return;
    }
    const item = menu.find(i => i.id === id)!;
    const inList = categories.includes(item.category);
    setIsNewCategory(!inList);
    setEdit({
      id, imageUrl: item.imageUrl ?? '', emoji: item.emoji,
      name: item.name, desc: item.desc, price: String(item.price),
      kcal: item.kcal ? String(item.kcal) : '', category: item.category,
      slot: item.slot, stock: item.stock != null ? String(item.stock) : '',
      weekdays: item.weekdays ?? [],
    });
  };

  const saveItem = () => {
    if (!edit) return;
    const { id, name, price, category, emoji, desc, kcal, imageUrl, slot, stock, weekdays } = edit;
    if (!name.trim() || !price || !category.trim()) {
      alert('メニュー名・価格・カテゴリは必須です'); return;
    }
    const isNoodle  = category.trim().toUpperCase() === 'NOODLE';
    const stockVal  = stock.trim() !== '' ? Number(stock) : null;
    // 空 or 全曜日選択 → null（毎日）
    const weekdaysVal: number[] | null =
      weekdays.length > 0 && weekdays.length < 7 ? weekdays : null;
    const data = {
      name: name.trim(), price: +price, category: category.trim(),
      emoji: emoji.trim() || '🍽️', desc: desc.trim(),
      kcal: kcal ? +kcal : undefined, imageUrl: imageUrl.trim(),
      slot, isNoodle, stock: stockVal, weekdays: weekdaysVal,
    };
    run(async () => {
      if (id !== null) {
        await updateMenuItem(id, data);
      } else {
        await addMenuItem(data);
      }
      setEdit(null);
    });
  };

  const toggleSold = (id: number, current: boolean) =>
    run(() => toggleSoldOut(id, !current));

  const deleteItem = (id: number) => {
    if (!confirm('このメニューをゴミ箱に移動しますか？')) return;
    run(() => deleteMenuItem(id));
  };

  const restoreItem = (id: number) => run(() => restoreMenuItem(id));

  const permanentlyDeleteItem = (id: number) => {
    if (!confirm('完全に削除しますか？この操作は元に戻せません。')) return;
    run(() => permanentlyDeleteMenuItem(id));
  };

  const handleReplenish = (id: number, currentStock: number | null | undefined) => {
    const defaultVal = currentStock != null ? String(currentStock) : '';
    const val = prompt('補充後の在庫数を入力してください\n（空欄で無制限に設定）', defaultVal);
    if (val === null) return;
    const stock = val.trim() === '' ? null : parseInt(val, 10);
    if (stock !== null && (isNaN(stock) || stock < 0)) {
      alert('0以上の整数を入力してください'); return;
    }
    run(() => replenishStock(id, stock));
  };

  // ── Orders ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === orders.length ? new Set() : new Set(orders.map(o => o.id))
    );
  };

  const setOrderReady = (id: string) => run(() => markOrderReady(id));

  const handleDeleteOrder = (id: string) => {
    if (!confirm('この注文を削除しますか？')) return;
    run(() => deleteOrder(id));
  };

  const handleBulkDelete = () => {
    if (!confirm(`選択した ${selectedIds.size} 件の注文を削除しますか？`)) return;
    run(async () => {
      await bulkDeleteOrders(Array.from(selectedIds));
      setSelectedIds(new Set());
    });
  };

  // ── Options ──
  const handleAddOption = (
    name: string, price: number, appliesTo: string,
    weekdays: number[] | null, slots: Slot[] | null
  ) => run(() => addOption(name, price, appliesTo, weekdays, slots as ('breakfast'|'lunch'|'dinner')[] | null));

  const handleUpdateOption = (
    id: string,
    data: { name?: string; price?: number; appliesTo?: string; weekdays?: number[] | null; slots?: Slot[] | null }
  ) => run(() => updateOption(id, { ...data, slots: data.slots as ('breakfast'|'lunch'|'dinner')[] | null | undefined }));

  const handleDeleteOption = (id: string) => {
    if (!confirm('このトッピングを削除しますか？')) return;
    run(() => deleteOption(id));
  };

  // ── Admins ──
  const handleAddAdmin = (email: string) => run(() => addAdminEmail(email));
  const handleRemoveAdmin = (email: string) => {
    if (!confirm(`${email} を管理者から外しますか？`)) return;
    run(() => removeAdminEmail(email));
  };

  // ── Settings ──
  const handleUpdateHours       = (hours: OperatingHours)           => run(() => updateOperatingHours(hours));
  const handleSetPaused         = (paused: boolean)                 => run(() => setOrderPaused(paused));
  const handleAddHoliday        = (entry: HolidayEntry)             => run(() => addHoliday(entry));
  const handleAddHolidayBatch   = (entries: HolidayEntry[])         => run(() => addHolidayBatch(entries));
  const handleRemoveHoliday     = (date: string, slots?: Slot[])    => run(() => removeHoliday(date, slots));
  const handleRemoveHolidayDates = (dates: string[], slots?: Slot[]) =>
    run(async () => { for (const d of dates) await removeHoliday(d, slots); });
  const handleUpdateRegularHols = (hols: RegularHolidayEntry[])     => run(() => updateRegularHolidays(hols));

  // ── Render ──
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', opacity: isPending ? 0.7 : 1 }}>
      <div className="admin-header">
        <h1>⚙️ 管理者パネル</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" className="admin-exit">← 注文画面へ</Link>
        </div>
      </div>
      <div className="admin-tabs">
        {(['menu', 'orders', 'options', 'trash', 'settings'] as AdminTab[]).map(t => (
          <button key={t} className={`a-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'menu'    ? 'メニュー管理'
            : t === 'orders'  ? '注文履歴'
            : t === 'options' ? 'オプション'
            : t === 'trash'   ? `🗑️ ゴミ箱${deletedMenu.length > 0 ? `(${deletedMenu.length})` : ''}`
            : '設定'}
          </button>
        ))}
      </div>

      {/* ── Menu tab ── */}
      {tab === 'menu' && (
        <div className="admin-section">
          <br />
          <button className="add-item-btn" onClick={() => openEdit(null)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>＋ メニューを追加する</button>

          {/* 曜日タブ */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {WEEKDAY_NAMES.map((name, wd) => (
              <button
                key={wd}
                onClick={() => setActiveWeekday(wd)}
                style={{
                  flex: 1, padding: '6px 2px', borderRadius: 8,
                  fontSize: 12, fontWeight: 700,
                  background: activeWeekday === wd ? 'var(--primary)' : 'var(--bg)',
                  color:      activeWeekday === wd ? '#fff' : 'var(--muted)',
                  border:     `1px solid ${activeWeekday === wd ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >{name}</button>
            ))}
          </div>

          {/* スロット別メニュー */}
          {menu.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>メニューがありません</p>
          ) : (['breakfast', 'lunch', 'dinner'] as Slot[]).map(slot => {
            const slotItems = menu.filter(item =>
              item.slot === slot &&
              (!item.weekdays || item.weekdays.length === 0 || item.weekdays.includes(activeWeekday))
            );
            if (slotItems.length === 0) return null;
            return (
              <div key={slot}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                  padding: '8px 0 6px', letterSpacing: '.5px', textTransform: 'uppercase',
                }}>
                  {SLOT_EMOJI[slot]} {SLOT_LABEL_MAP[slot]}
                </div>
                {slotItems.map(item => (
                  <div key={item.id} className="admin-card">
                    <div className="admin-card-head">
                      <div className="admin-thumb">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt="" />
                          : <span className="emoji">{item.emoji || '🍽️'}</span>}
                      </div>
                      <div className="admin-card-info">
                        <div className="admin-card-name">{item.soldOut ? '【売切】' : ''}{item.name}</div>
                        <div className="admin-card-sub">
                          ¥{item.price} {item.kcal ? `· ${item.kcal}kcal` : ''}
                          {' '}
                          {item.weekdays && item.weekdays.length > 0 && item.weekdays.length < 7 && (
                            <span style={{ fontSize: 10, color: 'var(--accent)' }}>
                              [{item.weekdays.map(d => WEEKDAY_NAMES[d]).join('')}]
                            </span>
                          )}
                          {' '}
                          {item.stock == null
                            ? <span style={{ fontSize: 10, color: 'var(--muted)' }}>無制限</span>
                            : item.stock > 0
                            ? <span style={{ fontSize: 10, color: 'var(--success, #34c759)', fontWeight: 600 }}>残り{item.stock}個</span>
                            : <span style={{ fontSize: 10, color: '#ff3b30', fontWeight: 700 }}>在庫切れ</span>}
                        </div>
                      </div>
                    </div>
                    <div className="admin-card-acts">
                      <button className="act-btn act-edit"  onClick={() => openEdit(item.id)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>編集</button>
                      <button className={`act-btn ${item.soldOut ? 'act-unsold' : 'act-sold'}`}
                        onClick={() => toggleSold(item.id, item.soldOut)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>
                        {item.soldOut ? '販売再開' : '売り切れ'}
                      </button>
                      <button className="act-btn"
                        style={{ background: '#e8f4fd', color: '#007aff', ...(isDemo ? DEMO_BTN : {}) }}
                        onClick={() => handleReplenish(item.id, item.stock)} disabled={isDemo}>補充</button>
                      <button className="act-btn act-del" onClick={() => deleteItem(item.id)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>削除</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Orders tab ── */}
      {tab === 'orders' && (
        <div className="admin-section">
          <br />
          {orders.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>注文履歴がありません</p>
          ) : (
            <>
              {/* ── ヘッダー：全選択 + 一括削除ボタン ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: isDemo ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: isDemo ? 0.4 : 1 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === orders.length && orders.length > 0}
                    onChange={toggleSelectAll}
                    disabled={isDemo}
                  />
                  すべて選択
                </label>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    style={{
                      marginLeft: 'auto', padding: '6px 14px', borderRadius: 10,
                      background: '#e53935', color: '#fff', border: 'none',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      ...(isDemo ? DEMO_BTN : {}),
                    }}
                    disabled={isDemo}
                  >
                    🗑️ 選択した注文を削除（{selectedIds.size}件）
                  </button>
                )}
              </div>

              {/* ── 注文一覧 ── */}
              {orders.map(o => {
                const tStr = formatDateTime(o.time);
                return (
                  <div key={o.id} className="admin-card" style={{ marginBottom: 10 }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelect(o.id)}
                        style={{ flexShrink: 0 }}
                        disabled={isDemo}
                      />
                      <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)', minWidth: 70 }}>{o.id}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {o.items.map(i => `${i.name}×${i.qty}`).join('、')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                          {tStr} · ¥{o.total.toLocaleString()} · {o.slotLabel}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>{STATUS_LABEL[o.status] ?? o.status}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px' }}>
                      {o.status === 'pending'
                        ? <button className="act-btn act-sold" style={{ flex: 2, ...(isDemo ? DEMO_BTN : {}) }} onClick={() => setOrderReady(o.id)} disabled={isDemo}>✅ 準備完了</button>
                        : <span style={{ fontSize: 12, color: 'var(--success)', padding: 4, fontWeight: 700 }}>受け取り可能</span>}
                      <button className="act-btn act-del" onClick={() => handleDeleteOrder(o.id)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>削除</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── Options tab ── */}
      {tab === 'options' && (
        <OptionsPanel menu={menu} options={options} onAdd={handleAddOption} onUpdate={handleUpdateOption} onDelete={handleDeleteOption} isDemo={isDemo} />
      )}

      {/* ── Trash tab ── */}
      {tab === 'trash' && (
        <div className="admin-section">
          <br />
          {deletedMenu.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
              <p>ゴミ箱は空です</p>
            </div>
          ) : deletedMenu.map(item => (
            <div key={item.id} className="admin-card" style={{ opacity: 0.75 }}>
              <div className="admin-card-head">
                <div className="admin-thumb">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" />
                    : <span className="emoji">{item.emoji || '🍽️'}</span>}
                </div>
                <div className="admin-card-info">
                  <div className="admin-card-name">{item.name}</div>
                  <div className="admin-card-sub">
                    ¥{item.price}
                    {' '}<span className={`slot-badge ${SLOT_CLASS[item.slot]}`}>{SLOT_NAME[item.slot]}</span>
                  </div>
                </div>
              </div>
              <div className="admin-card-acts">
                <button className="act-btn act-unsold" onClick={() => restoreItem(item.id)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>復元</button>
                <button className="act-btn act-del"    onClick={() => permanentlyDeleteItem(item.id)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>完全削除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Settings tab ── */}
      {tab === 'settings' && (
        <SettingsPanel
          settings={props.settings}
          envAdmins={props.envAdmins}
          dbAdmins={dbAdmins}
          onAddAdmin={handleAddAdmin}
          onRemoveAdmin={handleRemoveAdmin}
          onUpdateHours={handleUpdateHours}
          onSetPaused={handleSetPaused}
          onAddHoliday={handleAddHoliday}
          onAddHolidayBatch={handleAddHolidayBatch}
          onRemoveHoliday={handleRemoveHoliday}
          onRemoveHolidayDates={handleRemoveHolidayDates}
          onUpdateRegularHols={handleUpdateRegularHols}
          isDemo={isDemo}
        />
      )}

      {/* ── Edit modal ── */}
      {edit && (
        <div className="edit-modal">
          <div className="edit-box">
            <h2>{edit.id ? 'メニューを編集' : 'メニューを追加'}</h2>
            <div className="form-row">
              <label className="form-label">写真URL（任意）</label>
              <div className="img-preview">
                {edit.imageUrl
                  ? <img src={edit.imageUrl} alt="" />
                  : <span>{edit.emoji || '🍽️'}</span>}
              </div>
              <input className="form-input" type="url" placeholder="https://..." value={edit.imageUrl}
                onChange={e => setEdit({ ...edit, imageUrl: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="form-label">絵文字</label>
              <input className="form-input" type="text" placeholder="🍛" maxLength={2} value={edit.emoji}
                onChange={e => setEdit({ ...edit, emoji: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="form-label">メニュー名 *</label>
              <input className="form-input" type="text" placeholder="例：酢豚定食" value={edit.name}
                onChange={e => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="form-label">説明</label>
              <input className="form-input" type="text" placeholder="例：甘酸っぱい本格酢豚" value={edit.desc}
                onChange={e => setEdit({ ...edit, desc: e.target.value })} />
            </div>
            <div className="form-row-2">
              <div className="form-row">
                <label className="form-label">価格（円・税込）*</label>
                <input className="form-input" type="number" placeholder="530" value={edit.price}
                  onChange={e => setEdit({ ...edit, price: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="form-label">カロリー（kcal）</label>
                <input className="form-input" type="number" placeholder="821" value={edit.kcal}
                  onChange={e => setEdit({ ...edit, kcal: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">在庫数（空欄＝無制限）</label>
              <input className="form-input" type="number" min="0" placeholder="例：50" value={edit.stock}
                onChange={e => setEdit({ ...edit, stock: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="form-label">カテゴリ *</label>
              <select
                className="form-select"
                value={isNewCategory ? '__new__' : edit.category}
                onChange={e => {
                  if (e.target.value === '__new__') {
                    setIsNewCategory(true);
                    setEdit({ ...edit, category: '' });
                  } else {
                    setIsNewCategory(false);
                    setEdit({ ...edit, category: e.target.value });
                  }
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__new__">＋ 新規カテゴリを追加</option>
              </select>
              {isNewCategory && (
                <input
                  className="form-input"
                  type="text"
                  placeholder="例：SET MENU、DON、NOODLE"
                  value={edit.category}
                  style={{ marginTop: 6 }}
                  onChange={e => setEdit({ ...edit, category: e.target.value })}
                />
              )}
            </div>
            <div className="form-row">
              <label className="form-label">提供時間帯 *</label>
              <select className="form-select" value={edit.slot}
                onChange={e => setEdit({ ...edit, slot: e.target.value as Slot })}>
                {Object.entries(SLOTS).map(([key, s]) => (
                  <option key={key} value={key}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">提供曜日（未選択 = 毎日）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
                {WEEKDAY_NAMES.map((name, wd) => (
                  <label key={wd} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={edit.weekdays.includes(wd)}
                      onChange={() => {
                        const next = edit.weekdays.includes(wd)
                          ? edit.weekdays.filter(d => d !== wd)
                          : [...edit.weekdays, wd].sort((a, b) => a - b);
                        setEdit({ ...edit, weekdays: next });
                      }}
                    />
                    {name}
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)' }}>※ 未選択または全選択 = 毎日提供</p>
            </div>
            <button className="save-btn" onClick={saveItem}>保存する</button>
            <button className="cancel-btn" onClick={() => setEdit(null)}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Options Panel helpers ────────────────────────────────────────
const OPT_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月〜日

function formatWeekdays(weekdays: number[] | null | undefined): string {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return '毎日';
  return [...weekdays]
    .sort((a, b) => OPT_WEEKDAY_ORDER.indexOf(a) - OPT_WEEKDAY_ORDER.indexOf(b))
    .map(d => WEEKDAY_NAMES[d])
    .join('・');
}

function formatSlots(slots: Slot[] | null | undefined): string {
  if (!slots || slots.length === 0 || slots.length === 3) return '全時間帯';
  const labels: Record<Slot, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食' };
  return slots.map(s => labels[s]).join('・');
}

// ── Options Panel ────────────────────────────────────────────────
function OptionsPanel({
  menu, options, onAdd, onUpdate, onDelete, isDemo = false,
}: {
  menu: MenuItem[];
  options: OptionItem[];
  onAdd: (name: string, price: number, appliesTo: string, weekdays: number[] | null, slots: Slot[] | null) => void;
  onUpdate: (id: string, data: { name?: string; price?: number; appliesTo?: string; weekdays?: number[] | null; slots?: Slot[] | null }) => void;
  onDelete: (id: string) => void;
  isDemo?: boolean;
}) {
  const [editingOption, setEditingOption] = useState<OptionItem | null>(null);
  const [name,          setName]          = useState('');
  const [price,         setPrice]         = useState('');
  const [appliesTo,     setAppliesTo]     = useState<string>('all');
  const [optWeekdays,   setOptWeekdays]   = useState<number[]>([]);
  const [optSlots,      setOptSlots]      = useState<Slot[]>([]);

  const categories = Array.from(new Set(menu.map(m => m.category))).sort();

  const openEdit = (opt: OptionItem) => {
    setEditingOption(opt);
    setName(opt.name);
    setPrice(String(opt.price));
    setAppliesTo(opt.appliesTo);
    setOptWeekdays(opt.weekdays ?? []);
    setOptSlots(opt.slots ?? []);
  };

  const cancelEdit = () => {
    setEditingOption(null);
    setName(''); setPrice(''); setAppliesTo('all');
    setOptWeekdays([]); setOptSlots([]);
  };

  const handleSave = () => {
    if (!name.trim() || !price) { alert('名前と価格は必須です'); return; }
    const wds = optWeekdays.length > 0 && optWeekdays.length < 7 ? optWeekdays : null;
    const sls = optSlots.length > 0 && optSlots.length < 3 ? optSlots : null;
    if (editingOption) {
      onUpdate(editingOption.id, { name: name.trim(), price: +price, appliesTo, weekdays: wds, slots: sls });
      cancelEdit();
    } else {
      onAdd(name.trim(), +price, appliesTo, wds, sls);
      setName(''); setPrice(''); setAppliesTo('all'); setOptWeekdays([]); setOptSlots([]);
    }
  };

  const allWeekdaysSelected = optWeekdays.length === 7;
  const allSlotsSelected    = optSlots.length === SLOT_KEYS.length;
  const appliesToLabel = (val: string) => val === 'all' ? '全メニュー' : val;

  return (
    <div className="admin-section">
      <br />
      {/* フォーム（追加 / 編集共用） */}
      <div className="admin-card" style={{ padding: 14, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {editingOption ? `✏️ ${editingOption.name} を編集` : '＋ トッピングを追加'}
        </p>
        <div className="form-row">
          <label className="form-label">名前 *</label>
          <input className="form-input" type="text" placeholder="例：温泉玉子" value={name}
            onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">追加料金（円）*</label>
          <input className="form-input" type="number" placeholder="例：50" value={price}
            onChange={e => setPrice(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">対象メニュー</label>
          <select className="form-select" value={appliesTo}
            onChange={e => setAppliesTo(e.target.value)}>
            <option value="all">全メニュー</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* 提供曜日 */}
        <div className="form-row">
          <label className="form-label">提供曜日（未選択 = 毎日）</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {OPT_WEEKDAY_ORDER.map(wd => (
                <label key={wd} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={optWeekdays.includes(wd)}
                    onChange={() => setOptWeekdays(prev =>
                      prev.includes(wd) ? prev.filter(d => d !== wd) : [...prev, wd]
                    )}
                  />
                  {WEEKDAY_NAMES[wd]}
                </label>
              ))}
            </div>
            <button className="toggle-all-btn"
              onClick={() => setOptWeekdays(allWeekdaysSelected ? [] : [0,1,2,3,4,5,6])}>
              {allWeekdaysSelected ? '全解除' : '全選択'}
            </button>
          </div>
        </div>

        {/* 提供時間帯 */}
        <div className="form-row">
          <label className="form-label">提供時間帯（未選択 = 全時間帯）</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {(SLOT_KEYS as Slot[]).map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={optSlots.includes(s)}
                    onChange={() => setOptSlots(prev =>
                      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                    )}
                  />
                  {SLOT_EMOJI[s]} {SLOT_LABEL_MAP[s]}
                </label>
              ))}
            </div>
            <button className="toggle-all-btn"
              onClick={() => setOptSlots(allSlotsSelected ? [] : [...SLOT_KEYS as Slot[]])}>
              {allSlotsSelected ? '全解除' : '全選択'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="save-btn" style={{ flex: 1, ...(isDemo ? DEMO_BTN : {}) }} onClick={handleSave} disabled={isDemo}>
            {editingOption ? '更新する' : '追加する'}
          </button>
          {editingOption && (
            <button onClick={cancelEdit}
              style={{ flex: 1, padding: 14, textAlign: 'center', fontSize: 14, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              キャンセル
            </button>
          )}
        </div>
      </div>

      {/* 一覧 */}
      {options.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 20, fontSize: 13 }}>
          追加したトッピングはありません
        </p>
      ) : options.map(opt => (
        <div key={opt.id} className="admin-card" style={{ padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                +¥{opt.price}
                {' · '}{appliesToLabel(opt.appliesTo)}
                {' · '}{formatWeekdays(opt.weekdays)}
                {' · '}{formatSlots(opt.slots)}
              </div>
            </div>
            <button className="act-btn act-edit" onClick={() => openEdit(opt)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>編集</button>
            <button className="act-btn act-del"  onClick={() => onDelete(opt.id)} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>削除</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Settings Panel helpers ──────────────────────────────────────
function toTimeStr(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function fromTimeStr(s: string): [number, number] {
  const parts = s.split(':');
  return [Number(parts[0] ?? 0), Number(parts[1] ?? 0)];
}

type SlotKey = 'breakfast' | 'lunch' | 'dinner';
const SLOT_KEYS: SlotKey[]                       = ['breakfast', 'lunch', 'dinner'];
const SLOT_EMOJI: Record<SlotKey, string>        = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };
const SLOT_LABEL_MAP: Record<SlotKey, string>    = { breakfast: '朝食', lunch: '昼食', dinner: '夕食' };
const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

type HoursState = Record<SlotKey, { sh: string; eh: string }>;

/** RegularHoliday を 7×3 の boolean 行列に変換 */
function initRegHolMatrix(regularHolidays: RegularHolidayEntry[]): boolean[][] {
  const mat: boolean[][] = Array.from({ length: 7 }, () => [false, false, false]);
  for (const entry of regularHolidays) {
    const slots = entry.slots ?? [];
    if (slots.length === 0) {
      mat[entry.weekday] = [true, true, true];
    } else {
      for (let i = 0; i < 3; i++) {
        if (slots.includes(SLOT_KEYS[i] as Slot)) mat[entry.weekday]![i] = true;
      }
    }
  }
  return mat;
}

/** 7×3 行列 → RegularHolidayEntry[] */
function buildRegHolidays(mat: boolean[][]): RegularHolidayEntry[] {
  const result: RegularHolidayEntry[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const checked = SLOT_KEYS.filter((_, i) => mat[wd]![i]);
    if (checked.length === 0) continue;
    result.push({ weekday: wd, slots: checked.length === 3 ? [] : (checked as Slot[]) });
  }
  return result;
}

/** HolidayEntry の表示ラベル */
function holidayEntryLabel(slots: Slot[] | undefined): string {
  if (!slots || slots.length === 0) return '終日休業';
  return slots.map(s => SLOT_LABEL_MAP[s]).join('・') + 'のみ休み';
}

interface HolidayGroup {
  startDate: string;
  endDate: string;
  slots?: Slot[];
  dates: string[];
}

/** 連続する同一スロットの休業日をグループ化 */
function groupHolidays(holidays: HolidayEntry[]): HolidayGroup[] {
  if (holidays.length === 0) return [];
  const groups: HolidayGroup[] = [];
  let current: HolidayGroup | null = null;

  for (const entry of holidays) {
    const slotsKey = JSON.stringify((entry.slots ?? []).slice().sort());
    if (current === null) {
      current = { startDate: entry.date, endDate: entry.date, slots: entry.slots, dates: [entry.date] };
    } else {
      const prev = new Date(current.endDate);
      prev.setDate(prev.getDate() + 1);
      const isNextDay = prev.toISOString().slice(0, 10) === entry.date;
      const prevKey   = JSON.stringify((current.slots ?? []).slice().sort());
      if (isNextDay && slotsKey === prevKey) {
        current.endDate = entry.date;
        current.dates.push(entry.date);
      } else {
        groups.push(current);
        current = { startDate: entry.date, endDate: entry.date, slots: entry.slots, dates: [entry.date] };
      }
    }
  }
  if (current) groups.push(current);
  return groups;
}

// ── Settings Panel ──────────────────────────────────────────────
function SettingsPanel({
  settings, envAdmins, dbAdmins,
  onAddAdmin, onRemoveAdmin,
  onUpdateHours, onSetPaused,
  onAddHoliday, onAddHolidayBatch, onRemoveHoliday, onRemoveHolidayDates, onUpdateRegularHols,
  isDemo = false,
}: {
  settings: AppSettings;
  envAdmins: string[];
  dbAdmins: string[];
  onAddAdmin: (email: string) => void;
  onRemoveAdmin: (email: string) => void;
  onUpdateHours: (hours: OperatingHours) => void;
  onSetPaused: (paused: boolean) => void;
  onAddHoliday: (entry: HolidayEntry) => void;
  onAddHolidayBatch: (entries: HolidayEntry[]) => void;
  onRemoveHoliday: (date: string, slots?: Slot[]) => void;
  onRemoveHolidayDates: (dates: string[], slots?: Slot[]) => void;
  onUpdateRegularHols: (hols: RegularHolidayEntry[]) => void;
  isDemo?: boolean;
}) {
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newHoliday,      setNewHoliday]      = useState('');
  const [newHolidaySlots, setNewHolidaySlots] = useState<Slot[]>([]);
  const [holidayMode,     setHolidayMode]     = useState<'single' | 'period'>('single');
  const [periodStart,     setPeriodStart]     = useState('');
  const [periodEnd,       setPeriodEnd]       = useState('');
  const [regHolMat,       setRegHolMat]       = useState<boolean[][]>(() =>
    initRegHolMatrix(settings.regularHolidays)
  );

  const initHours = (): HoursState => ({
    breakfast: {
      sh: toTimeStr(...settings.operatingHours.breakfast.sh),
      eh: toTimeStr(...settings.operatingHours.breakfast.eh),
    },
    lunch: {
      sh: toTimeStr(...settings.operatingHours.lunch.sh),
      eh: toTimeStr(...settings.operatingHours.lunch.eh),
    },
    dinner: {
      sh: toTimeStr(...settings.operatingHours.dinner.sh),
      eh: toTimeStr(...settings.operatingHours.dinner.eh),
    },
  });
  const [hours, setHours] = useState<HoursState>(initHours);

  const today = new Date().toISOString().split('T')[0]!;

  const saveHours = () => {
    onUpdateHours({
      breakfast: { sh: fromTimeStr(hours.breakfast.sh), eh: fromTimeStr(hours.breakfast.eh) },
      lunch:     { sh: fromTimeStr(hours.lunch.sh),     eh: fromTimeStr(hours.lunch.eh)     },
      dinner:    { sh: fromTimeStr(hours.dinner.sh),    eh: fromTimeStr(hours.dinner.eh)    },
    });
  };

  const submitAdmin = () => {
    if (!newAdminUsername.trim()) return;
    onAddAdmin(`${newAdminUsername.trim()}@gmail.com`); setNewAdminUsername('');
  };

  const allSlotsSelected = newHolidaySlots.length === SLOT_KEYS.length;
  const toggleAllSlots   = () =>
    setNewHolidaySlots(allSlotsSelected ? [] : [...SLOT_KEYS]);

  const toggleNewHolidaySlot = (s: Slot) =>
    setNewHolidaySlots(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );

  const submitHoliday = () => {
    if (!newHoliday) return;
    onAddHoliday({ date: newHoliday, slots: newHolidaySlots.length > 0 ? newHolidaySlots : undefined });
    setNewHoliday(''); setNewHolidaySlots([]);
  };

  const submitPeriodHoliday = () => {
    if (!periodStart || !periodEnd) { alert('開始日と終了日を入力してください'); return; }
    if (periodEnd < periodStart) { alert('終了日は開始日以降にしてください'); return; }
    const entries: HolidayEntry[] = [];
    const cur = new Date(periodStart);
    const end = new Date(periodEnd);
    while (cur <= end) {
      entries.push({
        date:  cur.toISOString().slice(0, 10),
        slots: newHolidaySlots.length > 0 ? newHolidaySlots : undefined,
      });
      cur.setDate(cur.getDate() + 1);
    }
    onAddHolidayBatch(entries);
    setPeriodStart(''); setPeriodEnd(''); setNewHolidaySlots([]);
  };

  const toggleRegHol = (wd: number, si: number) => {
    setRegHolMat(prev => {
      const next = prev.map(row => [...row]);
      next[wd]![si] = !next[wd]![si];
      return next;
    });
  };

  return (
    <div className="admin-section">
      <br />

      {/* ── 受付状態 ── */}
      <div className="admin-card" style={{ padding: 16, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🔌 受付状態</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {settings.orderPaused
              ? <span style={{ fontSize: 15, fontWeight: 800, color: '#ff3b30' }}>⛔ 受付停止中</span>
              : <span style={{ fontSize: 15, fontWeight: 800, color: '#34c759' }}>✅ 受付中</span>}
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              停止中は注文画面に「受付停止中」と表示されます
            </p>
          </div>
          <button
            className={`act-btn ${settings.orderPaused ? 'act-unsold' : 'act-sold'}`}
            style={{ fontSize: 13, padding: '10px 18px', ...(isDemo ? DEMO_BTN : {}) }}
            onClick={() => onSetPaused(!settings.orderPaused)}
            disabled={isDemo}
          >
            {settings.orderPaused ? '再開する' : '停止する'}
          </button>
        </div>
      </div>

      {/* ── 営業時間 ── */}
      <div className="admin-card" style={{ padding: 16, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🕐 営業時間</p>
        {SLOT_KEYS.map(key => (
          <div key={key} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
              {SLOT_EMOJI[key]} {SLOT_LABEL_MAP[key]}
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="form-input" type="time" value={hours[key].sh} style={{ flex: 1 }}
                onChange={e => setHours(h => ({ ...h, [key]: { ...h[key], sh: e.target.value } }))} />
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>〜</span>
              <input className="form-input" type="time" value={hours[key].eh} style={{ flex: 1 }}
                onChange={e => setHours(h => ({ ...h, [key]: { ...h[key], eh: e.target.value } }))} />
            </div>
          </div>
        ))}
        <button className="save-btn" onClick={saveHours} style={isDemo ? DEMO_BTN : undefined} disabled={isDemo}>保存する</button>
      </div>

      {/* ── 特定日 休業日 ── */}
      <div className="admin-card" style={{ padding: 16, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📅 特定日 休業設定</p>

        {/* 単発 / 期間 切り替え */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['single', 'period'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setHolidayMode(mode)}
              style={{
                flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: holidayMode === mode ? 'var(--primary)' : 'var(--bg)',
                color:      holidayMode === mode ? '#fff' : 'var(--muted)',
                border:     `1px solid ${holidayMode === mode ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >{mode === 'single' ? '単発' : '期間'}</button>
          ))}
        </div>

        {/* 追加フォーム */}
        <div style={{ marginBottom: 12 }}>
          {holidayMode === 'single' ? (
            <input className="form-input" type="date" value={newHoliday} min={today}
              style={{ marginBottom: 8 }}
              onChange={e => setNewHoliday(e.target.value)} />
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <input className="form-input" type="date" value={periodStart} min={today}
                style={{ flex: 1 }}
                onChange={e => setPeriodStart(e.target.value)} />
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>〜</span>
              <input className="form-input" type="date" value={periodEnd}
                min={periodStart || today}
                style={{ flex: 1 }}
                onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          )}

          {/* スロット選択 + 全選択ボタン */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {SLOT_KEYS.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newHolidaySlots.includes(s)}
                    onChange={() => toggleNewHolidaySlot(s)}
                  />
                  {SLOT_EMOJI[s]} {SLOT_LABEL_MAP[s]}
                </label>
              ))}
            </div>
            <button className="toggle-all-btn" onClick={toggleAllSlots}>
              {allSlotsSelected ? '全解除' : '全選択'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
            ※ 時間帯未選択 = 終日休業
          </p>
          <button
            className="act-btn act-edit"
            onClick={holidayMode === 'single' ? submitHoliday : submitPeriodHoliday}
            style={isDemo ? DEMO_BTN : undefined}
            disabled={isDemo}
          >追加</button>
        </div>

        {/* 一覧（グループ表示） */}
        {settings.holidays.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 8 }}>
            休業日は登録されていません
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groupHolidays(settings.holidays).map((group, idx) => {
              const isPast = group.endDate < today;
              const label  = holidayEntryLabel(group.slots);
              const dateDisplay = group.startDate === group.endDate
                ? formatDate(group.startDate)
                : `${formatDate(group.startDate)} 〜 ${formatDate(group.endDate)}`;
              return (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', borderRadius: 8,
                  background: 'var(--bg)', opacity: isPast ? 0.5 : 1,
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {isPast ? '（過去）' : ''}{dateDisplay}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{label}</span>
                  </div>
                  <button className="act-btn act-del"
                    onClick={() => onRemoveHolidayDates(
                      group.dates,
                      group.slots && group.slots.length > 0 ? group.slots : undefined
                    )}
                    style={isDemo ? DEMO_BTN : undefined}
                    disabled={isDemo}
                  >削除</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 定期休業（曜日別） ── */}
      <div className="admin-card" style={{ padding: 16, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🗓️ 定期休業（曜日設定）</p>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
          チェックを付けた時間帯を毎週その曜日に休みにします
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', width: 40 }}>曜日</th>
                {SLOT_KEYS.map(s => (
                  <th key={s} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 600, color: 'var(--muted)' }}>
                    {SLOT_EMOJI[s]}<br />{SLOT_LABEL_MAP[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAY_NAMES.map((name, wd) => {
                const allChecked = regHolMat[wd]!.every(Boolean);
                return (
                  <tr key={wd} style={{ borderTop: '1px solid var(--border)', background: allChecked ? 'rgba(255,59,48,.06)' : undefined }}>
                    <td style={{ padding: '8px', fontWeight: 700 }}>{name}</td>
                    {SLOT_KEYS.map((_, si) => (
                      <td key={si} style={{ padding: '8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={regHolMat[wd]![si] ?? false}
                          onChange={() => toggleRegHol(wd, si)}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button className="save-btn" style={{ marginTop: 14, ...(isDemo ? DEMO_BTN : {}) }}
          onClick={() => onUpdateRegularHols(buildRegHolidays(regHolMat))}
          disabled={isDemo}>
          保存する
        </button>
      </div>

      {/* ── 管理者リスト ── */}
      <div className="admin-card" style={{ padding: 16, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>👥 管理者リスト</p>

        {isDemo ? (
          <p style={{ color: '#999', fontSize: 14, padding: '8px 0' }}>
            デモモードのためメールアドレスは非表示です
          </p>
        ) : (
          <>
            {envAdmins.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>固定管理者（変更不可）</p>
                {envAdmins.map(email => (
                  <div key={email} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                    fontSize: 13, borderBottom: '1px solid var(--border)',
                  }}>
                    <span>🔒 {email}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>固定</span>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>追加管理者</p>
            {dbAdmins.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>追加管理者はいません</p>
            ) : dbAdmins.map(email => (
              <div key={email} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)',
              }}>
                <span>{email}</span>
                <button className="act-btn act-del" onClick={() => onRemoveAdmin(email)}>削除</button>
              </div>
            ))}

            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input className="form-input" type="text" placeholder="example"
                  value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitAdmin()}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap' }}>@gmail.com</span>
              </div>
              <button className="save-btn" onClick={submitAdmin} style={{ marginTop: 6 }}>追加する</button>
            </div>
          </>
        )}

      </div>

      <div className="admin-card" style={{ padding: 16, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🔑 Stripe設定</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Stripeのシークレットキーは <code>.env.local</code> で設定します。<br />
          Vercelデプロイ後は環境変数 <code>STRIPE_SECRET_KEY</code> を設定してください。
        </p>
      </div>

      <div className="admin-card" style={{ padding: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🔐 認証設定</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          管理者ログインはGoogleアカウント認証を使用しています。<br />
          固定管理者は環境変数 <code>ADMIN_EMAILS</code> で設定してください。
        </p>
      </div>
    </div>
  );
}

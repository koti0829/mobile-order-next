# オプション機能 実装仕様書

## 概要

注文時にオプション（大盛り・本日のサラダ・トッピング）を選択できる機能を追加する。
「+」ボタン押下でモーダルを開き、オプション選択後にカートへ追加する。
同じメニューでもオプション違いはカートの別行として扱う。

---

## 1. `src/types/index.ts` の変更

以下を追記する。

```ts
// オプション定義（管理者が作成するトッピングと、固定オプションで共通利用）
export interface OptionItem {
  id: string;       // 一意ID（'oomori' | 'salad' | 任意の文字列）
  name: string;     // 表示名（例：大盛り、本日のサラダ）
  price: number;    // 追加料金（例：100）
  appliesTo: 'all' | 'noodle';  // 全メニュー対象 or 麺類のみ
}

// カートの1行（メニュー + 選択オプションの組み合わせ）
export interface CartEntry {
  menuId: number;
  selectedOptions: OptionItem[];
  qty: number;
}
```

`MenuItem` に `isNoodle: boolean` を追加する。

```ts
export interface MenuItem {
  id: number;
  name: string;
  desc: string;
  price: number;
  kcal?: number;
  category: string;
  slot: Slot;
  emoji: string;
  imageUrl?: string;
  enabled: boolean;
  soldOut: boolean;
  isNoodle: boolean;  // ← 追加
}
```

`Order.items` にオプション表示用フィールドを追加する。

```ts
export interface Order {
  id: string;
  time: string;
  slotLabel: string;
  items: { name: string; qty: number; price: number; optionNames?: string[] }[];
  total: number;
  status: 'pending' | 'ready';
}
```

---

## 2. `src/lib/menu.ts` の変更

### 2-1. ストレージキーを追加

```ts
export const OPTION_KEY = 'cafe_options';
```

### 2-2. システム固定オプションを定数として追加

```ts
import type { OptionItem } from '@/types';

export const SYSTEM_OPTIONS: OptionItem[] = [
  { id: 'oomori', name: '大盛り',       price: 100, appliesTo: 'noodle' },
  { id: 'salad',  name: '本日のサラダ', price: 100, appliesTo: 'all'    },
];
```

### 2-3. `DEFAULT_MENU` の各エントリに `isNoodle` を追加

- `category: 'NOODLE'` のもの（id: 7, 8, 9）は `isNoodle: true`
- それ以外はすべて `isNoodle: false`

例：
```ts
{ id: 7, name: 'かけそば', ..., isNoodle: true  },
{ id: 8, name: '大判きつねそば', ..., isNoodle: true  },
{ id: 9, name: '塩バターコーンラーメン', ..., isNoodle: true  },
// 他はすべて isNoodle: false
```

---

## 3. `src/app/page.tsx` の変更

### 3-1. import 追加

```ts
import type { MenuItem, AppStatus, Slot, OptionItem, CartEntry } from '@/types';
import { SLOTS, DEFAULT_MENU, MENU_KEY, OPTION_KEY, SYSTEM_OPTIONS } from '@/lib/menu';
```

### 3-2. 型・state の変更

```ts
// Cart の型を変更
// 旧: type Cart = Record<number, number>;
// 新:
// CartEntry[] を使用（import済み）

// state 変更
const [cart, setCart] = useState<CartEntry[]>([]);
const [adminOptions, setAdminOptions] = useState<OptionItem[]>([]);  // 管理者が追加したトッピング
const [modalItem, setModalItem] = useState<MenuItem | null>(null);   // オプション選択モーダル
const [modalSelected, setModalSelected] = useState<OptionItem[]>([]); // モーダル内の選択状態
```

### 3-3. useEffect でオプションをロード

```ts
useEffect(() => {
  const saved = localStorage.getItem(MENU_KEY);
  setMenu(saved ? JSON.parse(saved) : DEFAULT_MENU);
  const opts = localStorage.getItem(OPTION_KEY);
  setAdminOptions(opts ? JSON.parse(opts) : []);
}, []);
```

### 3-4. ヘルパー関数の変更

```ts
// エントリの一意キー（menuId + optionIds のハッシュ）
const entryKey = (menuId: number, opts: OptionItem[]) =>
  `${menuId}:${opts.map(o => o.id).sort().join(',')}`;

// 合計点数
const totalItems = () => cart.reduce((s, e) => s + e.qty, 0);

// 合計金額（メニュー価格 + オプション合計）× 数量
const totalPrice = () =>
  cart.reduce((s, e) => {
    const item = menu.find(i => i.id === e.menuId);
    if (!item) return s;
    const optTotal = e.selectedOptions.reduce((os, o) => os + o.price, 0);
    return s + (item.price + optTotal) * e.qty;
  }, 0);

// 数量増減（CartEntry[] の中から同一キーを探す）
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
```

### 3-5. モーダルを開く関数（「+」ボタン用）

```ts
const openModal = (item: MenuItem) => {
  setModalItem(item);
  setModalSelected([]);
};

const closeModal = () => {
  setModalItem(null);
  setModalSelected([]);
};

// モーダル内でオプションをトグル
const toggleOption = (opt: OptionItem) => {
  setModalSelected(prev =>
    prev.find(o => o.id === opt.id)
      ? prev.filter(o => o.id !== opt.id)
      : [...prev, opt]
  );
};

// モーダルから「カートに追加」
const addFromModal = () => {
  if (!modalItem) return;
  const key = entryKey(modalItem.id, modalSelected);
  setCart(c => {
    const idx = c.findIndex(e => entryKey(e.menuId, e.selectedOptions) === key);
    if (idx !== -1) {
      return c.map((e, i) => i === idx ? { ...e, qty: e.qty + 1 } : e);
    }
    return [...c, { menuId: modalItem.id, selectedOptions: [...modalSelected], qty: 1 }];
  });
  showToast('カートに追加しました 🛒');
  closeModal();
};
```

### 3-6. モーダルで表示するオプション一覧の算出

```ts
// モーダル内で使う（modalItem が確定している前提）
const availableOptions = (item: MenuItem): OptionItem[] => {
  const system = SYSTEM_OPTIONS.filter(o => o.appliesTo === 'all' || item.isNoodle);
  const admin = adminOptions.filter(o => o.appliesTo === 'all' || item.isNoodle);
  return [...system, ...admin];
};
```

### 3-7. カートエントリ1行あたりの表示価格

```ts
const entryUnitPrice = (e: CartEntry) => {
  const item = menu.find(i => i.id === e.menuId);
  if (!item) return 0;
  return item.price + e.selectedOptions.reduce((s, o) => s + o.price, 0);
};
```

### 3-8. cartEntries の変更

```ts
// 旧: const cartEntries = Object.entries(cart).filter(([, q]) => q > 0);
// 新:
const cartEntries = cart.filter(e => e.qty > 0);
```

### 3-9. checkout 関数の変更

```ts
const handleCheckout = async () => {
  setLoading(true);
  const items = cartEntries.map(e => {
    const item = menu.find(i => i.id === e.menuId)!;
    const optionNames = e.selectedOptions.map(o => o.name);
    const unitPrice = entryUnitPrice(e);
    const displayName = optionNames.length > 0
      ? `${item.name}（${optionNames.join('・')}）`
      : item.name;
    return {
      name: displayName,
      desc: item.desc,
      price: unitPrice,
      quantity: e.qty,
      optionNames,
    };
  });
  // 以降は既存と同様
};
```

### 3-10. メニューカードの「+」ボタンの変更

```ts
// 旧: <button className="add-btn" onClick={() => addItem(item.id)}>+</button>
// 新:
<button className="add-btn" onClick={() => openModal(item)}>+</button>
```

カート内の数量コントローラも変更（CartEntry ベースに）：
```tsx
// メニューカード上の qty 表示ロジック
// カート内に同menuIdのエントリが複数ある可能性があるため、合計を表示
const itemTotalQty = (id: number) => cart.filter(e => e.menuId === id).reduce((s, e) => s + e.qty, 0);
// qty === 0 の判定
const qty = itemTotalQty(item.id);
// qty > 0 のときはカート確認ボタン（モーダルへ誘導しない）を表示
// 「+」ボタンはopenModal(item) のまま維持
```

カード上の数量コントローラは、オプション違いが複数ある場合は複雑になるため、
**カード上では常に「+」ボタン（openModal）を表示し、数量調整はカートシートのみで行う**形にする。
つまり qty > 0 でも「+」ボタンを表示し続ける（バッジでカート内合計を表示）。

実装：
```tsx
// item-footer の中
{item.soldOut ? (
  <span style={{ fontSize: 11, color: '#ff3b30', fontWeight: 700 }}>売り切れ</span>
) : (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    {itemTotalQty(item.id) > 0 && (
      <span className="item-in-cart">{itemTotalQty(item.id)}</span>
    )}
    <button className="add-btn" onClick={() => openModal(item)}>+</button>
  </div>
)}
```

`item-in-cart` のスタイルを `globals.css` に追加：
```css
.item-in-cart {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  min-width: 16px;
  text-align: center;
}
```

### 3-11. カートシートの変更

```tsx
{cartEntries.map((entry, idx) => {
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
```

`cart-item-options` と `cart-option-tag` のスタイルを `globals.css` に追加：
```css
.cart-item-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 2px 0 4px;
}
.cart-option-tag {
  font-size: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--muted);
}
```

### 3-12. 確認シートの変更

```tsx
{cartEntries.map((entry, idx) => {
  const item = menu.find(i => i.id === entry.menuId);
  if (!item) return null;
  const unitPrice = entryUnitPrice(entry);
  const optNames = entry.selectedOptions.map(o => o.name).join('・');
  const displayName = optNames ? `${item.name}（${optNames}）` : item.name;
  return (
    <div key={idx} className="confirm-item">
      <span>{item.emoji} {displayName} × {entry.qty}</span>
      <span>¥{(unitPrice * entry.qty).toLocaleString()}</span>
    </div>
  );
})}
```

### 3-13. オプション選択モーダルの追加（JSX）

既存の `{/* ── Toast ── */}` の直前に追加：

```tsx
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
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOption(opt)}
              />
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
```

`option-modal` 関連のスタイルを `globals.css` に追加：
```css
.option-modal {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  background: var(--card);
  border-radius: 20px 20px 0 0;
  z-index: 500;
  padding-bottom: env(safe-area-inset-bottom);
}
.option-modal-body {
  padding: 0 18px;
  max-height: 50vh;
  overflow-y: auto;
}
.option-base-price {
  font-size: 13px;
  color: var(--muted);
  margin: 8px 0 14px;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  font-size: 15px;
}
.option-row input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: var(--primary);
  cursor: pointer;
}
.option-name {
  flex: 1;
  font-weight: 600;
}
.option-price {
  font-size: 13px;
  color: var(--primary);
  font-weight: 700;
}
.option-none {
  font-size: 13px;
  color: var(--muted);
  text-align: center;
  padding: 24px 0;
}
.option-modal-footer {
  padding: 16px 18px;
  border-top: 1px solid var(--border);
}
.option-total {
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 10px;
  color: var(--text);
}
```

---

## 4. `src/app/admin/page.tsx` の変更

### 4-1. AdminTab に 'options' を追加

```ts
type AdminTab = 'menu' | 'orders' | 'options' | 'settings';
```

### 4-2. import に追加

```ts
import type { MenuItem, Order, Slot, OptionItem } from '@/types';
import { DEFAULT_MENU, MENU_KEY, ORDER_KEY, CFG_KEY, DEFAULT_PIN, SLOTS, OPTION_KEY } from '@/lib/menu';
```

### 4-3. state 追加

```ts
const [options, setOptions] = useState<OptionItem[]>([]);
```

### 4-4. useEffect でオプションをロード

```ts
useEffect(() => {
  setMenu(JSON.parse(localStorage.getItem(MENU_KEY) ?? 'null') ?? DEFAULT_MENU);
  setOrders(JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]'));
  setOptions(JSON.parse(localStorage.getItem(OPTION_KEY) ?? '[]'));
  const cfg = JSON.parse(localStorage.getItem(CFG_KEY) ?? '{}');
  setStoredPin(cfg.pin ?? DEFAULT_PIN);
}, []);
```

### 4-5. オプション保存関数

```ts
const saveOptions = (next: OptionItem[]) => {
  setOptions(next);
  localStorage.setItem(OPTION_KEY, JSON.stringify(next));
};

const addOption = (name: string, price: number, appliesTo: 'all' | 'noodle') => {
  const newOpt: OptionItem = {
    id: `opt_${Date.now()}`,
    name,
    price,
    appliesTo,
  };
  saveOptions([...options, newOpt]);
};

const deleteOption = (id: string) => {
  if (!confirm('このトッピングを削除しますか？')) return;
  saveOptions(options.filter(o => o.id !== id));
};
```

### 4-6. タブバーに「オプション」を追加

```tsx
{(['menu', 'orders', 'options', 'settings'] as AdminTab[]).map(t => (
  <button key={t} className={`a-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
    {t === 'menu' ? 'メニュー管理'
      : t === 'orders' ? '注文履歴'
      : t === 'options' ? 'オプション'
      : '設定'}
  </button>
))}
```

### 4-7. オプションタブのコンテンツ

`{tab === 'settings' && ...}` の直前に追加：

```tsx
{tab === 'options' && (
  <OptionsPanel options={options} onAdd={addOption} onDelete={deleteOption} />
)}
```

### 4-8. OptionsPanel コンポーネント（SettingsPanel の下に追加）

```tsx
function OptionsPanel({
  options, onAdd, onDelete,
}: {
  options: OptionItem[];
  onAdd: (name: string, price: number, appliesTo: 'all' | 'noodle') => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName]           = useState('');
  const [price, setPrice]         = useState('');
  const [appliesTo, setAppliesTo] = useState<'all' | 'noodle'>('all');

  const handleAdd = () => {
    if (!name.trim() || !price) { alert('名前と価格は必須です'); return; }
    onAdd(name.trim(), +price, appliesTo);
    setName(''); setPrice('');
  };

  return (
    <div className="admin-section">
      <br />
      {/* 固定オプション（参照用） */}
      <div className="admin-card" style={{ padding: 14, marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--muted)' }}>
          🔒 システム固定オプション（変更不可）
        </p>
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          <div>大盛り：+¥100（麺類のみ）</div>
          <div>本日のサラダ：+¥100（全メニュー）</div>
        </div>
      </div>

      {/* トッピング追加フォーム */}
      <div className="admin-card" style={{ padding: 14, marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>＋ トッピングを追加</p>
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
          <label className="form-label">対象</label>
          <select className="form-select" value={appliesTo}
            onChange={e => setAppliesTo(e.target.value as 'all' | 'noodle')}>
            <option value="all">全メニュー</option>
            <option value="noodle">麺類のみ</option>
          </select>
        </div>
        <button className="save-btn" onClick={handleAdd}>追加する</button>
      </div>

      {/* トッピング一覧 */}
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
                +¥{opt.price} · {opt.appliesTo === 'all' ? '全メニュー' : '麺類のみ'}
              </div>
            </div>
            <button className="act-btn act-del" onClick={() => onDelete(opt.id)}>削除</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 5. `src/app/success/TicketDisplay.tsx` の変更

### 5-1. `lineItems` にオプション名を追加できるよう `OrderData` を更新

`src/types/index.ts` の `OrderData` を変更：
```ts
export interface OrderData {
  orderNumber: string;
  slotLabel: string;
  lineItems: { name: string; qty: number; unitAmount: number; optionNames?: string[] }[];
  total: number;
  time: string;
  sessionId: string;
}
```

### 5-2. チケット表示でオプションをインデント表示

```tsx
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
```

`globals.css` に追加：
```css
.t-item-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 0 8px 12px;
}
.t-option-tag {
  font-size: 10px;
  background: rgba(255,255,255,0.15);
  border-radius: 4px;
  padding: 2px 6px;
}
```

---

## 6. `src/app/api/checkout/route.ts` の変更

`CheckoutItem` に `optionNames` を追加し、`OrderData` のメタデータに渡す：

```ts
interface CheckoutItem {
  name: string;
  desc?: string;
  price: number;
  quantity: number;
  optionNames?: string[];
}
```

Stripe に送るアイテム名はそのまま（すでに `page.tsx` 側でオプション込みの名前にしている）。
チェックアウトセッションの `metadata` にオプション情報を含める必要はなく、名前に含まれているので変更は最小限。

---

## 7. まとめ：変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/types/index.ts` | `OptionItem`, `CartEntry` 追加、`MenuItem` に `isNoodle` 追加、`Order.items` に `optionNames` 追加、`OrderData.lineItems` に `optionNames` 追加 |
| `src/lib/menu.ts` | `OPTION_KEY` 追加、`SYSTEM_OPTIONS` 追加、`DEFAULT_MENU` に `isNoodle` 追加 |
| `src/app/page.tsx` | Cart型をCartEntry[]に変更、モーダル追加、各ヘルパー関数更新 |
| `src/app/admin/page.tsx` | オプション管理タブ・OptionsPanel追加 |
| `src/app/success/TicketDisplay.tsx` | オプションのインデント表示追加 |
| `src/app/globals.css` | 新UIパーツ用スタイル追加 |

以上を実装してください。TypeScript の型エラーが出ないよう、全ファイルの整合性に注意すること。

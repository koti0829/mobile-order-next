# 学食モバイルオーダー — Project Instructions

> Claude Code がこのプロジェクトを理解するための引き継ぎ文書。  
> 作業を始める前に必ずこのファイルを読むこと。

---

## 1. プロジェクト概要

**東京都市大学（TCU）学食向けモバイルオーダーシステム。**

- 学生がスマートフォンのブラウザからメニューを選び、Stripe で決済
- 決済完了後に QR コード付き食券を表示
- 厨房スタッフは `/admin` で注文を確認し「準備完了」に更新
- ログイン不要（学生側）/ Google OAuth 必須（管理者側）

**GitHub**: https://github.com/koti0829/mobile-order-next  
**デプロイ**: Vercel（main ブランチへのプッシュで自動デプロイ）

---

## 2. 技術スタック

| カテゴリ | 技術 | バージョン | 備考 |
|---------|------|-----------|------|
| フレームワーク | Next.js | 16.2.6 | App Router + Turbopack |
| UI | React / react-dom | 19.2.6 | |
| 言語 | TypeScript | 5.x strict | `npx tsc --noEmit` でエラー0を確認 |
| DB | Supabase (PostgreSQL) | @supabase/supabase-js 2.x | |
| 認証 | NextAuth.js | 4.x | Google OAuth プロバイダのみ |
| 決済 | Stripe Checkout | stripe 17.x | JPY 固定、Checkout Sessions 方式 |
| スタイル | CSS（globals.css） | — | CSS Variables でダーク対応 |
| デプロイ | Vercel | — | main push で自動デプロイ |

---

## 3. ファイル構成

```
/（プロジェクトルート）
├── .env.local              ← 環境変数（git 除外済み・絶対コミット禁止）
├── .env.local.example      ← テンプレート（コミット済み）
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── project-instructions.md ← このファイル
├── mobile-order-handoff.md ← 別途引き継ぎ文書
└── src/
    ├── app/
    │   ├── layout.tsx              # ルートレイアウト（SessionProvider ラップ）
    │   ├── page.tsx                # トップページ（SSR: メニュー・設定を Supabase から取得）
    │   ├── home-client.tsx         # メイン UI（Client Component）★主要ロジック
    │   ├── globals.css             # 全体スタイル（CSS Variables, ダーク対応）
    │   ├── admin/
    │   │   ├── page.tsx            # 管理ページ（SSR: 認証チェック・全データ取得）
    │   │   ├── admin-client.tsx    # 管理 UI（Client Component）★大きいファイル
    │   │   └── actions.ts          # Server Actions（全管理操作）
    │   ├── api/
    │   │   ├── checkout/route.ts   # POST /api/checkout（在庫確保 + Stripe セッション作成）
    │   │   ├── settings/route.ts   # GET /api/settings（設定取得）
    │   │   └── auth/[...nextauth]/route.ts  # NextAuth ハンドラ
    │   └── success/
    │       ├── page.tsx            # 決済完了ページ（Stripe セッション取得・注文保存）
    │       └── TicketDisplay.tsx   # 食券 UI（Client Component）
    ├── lib/
    │   ├── auth.ts                 # NextAuth 設定・管理者判定ロジック
    │   ├── db-mappers.ts           # DB Row → アプリ型への変換関数
    │   ├── format.ts               # formatDate / formatDateTime ユーティリティ
    │   ├── menu.ts                 # SLOTS 定義、TEST_MODE、RECENT_TICKETS_KEY
    │   ├── settings.ts             # fetchSettings()・AppSettings 型定義
    │   ├── storage.ts              # LocalStorage ユーティリティ（SSR 安全）
    │   ├── stripe.ts               # Stripe クライアント（getStripe()）
    │   ├── supabase.ts             # Supabase クライアント（ブラウザ用・anon key）
    │   └── supabase-server.ts      # Supabase クライアント（サーバー用・service_role key）
    ├── types/
    │   ├── index.ts                # アプリ共通型定義
    │   └── database.ts             # Supabase テーブル型定義（手動管理）
    └── instrumentation.ts          # Next.js instrumentation フック
```

---

## 4. 型定義（src/types/index.ts）

```typescript
type Slot = 'breakfast' | 'lunch' | 'dinner';

interface MenuItem {
  id: number; name: string; desc: string; price: number;
  kcal?: number; category: string; slot: Slot; emoji: string;
  imageUrl?: string; enabled: boolean; soldOut: boolean; isNoodle: boolean;
  stock?: number | null;    // null=無制限, 0以下=売切, 正=残数
  weekdays?: number[] | null; // null=毎日, [0-6]=特定曜日のみ（0=日）
}

interface OptionItem {
  id: string; name: string; price: number;
  appliesTo: string;          // 'all' または カテゴリ名
  weekdays?: number[] | null; // null=毎日
  slots?: Slot[] | null;      // null=全時間帯
}

interface CartEntry {
  menuId: number; selectedOptions: OptionItem[]; qty: number;
}

interface AppStatus {
  status: 'open' | 'waiting' | 'closed' | 'paused' | 'holiday';
  slot?: Slot; slotInfo?: SlotInfo; minutesUntil?: number;
}

// settings.ts より
interface AppSettings {
  operatingHours: OperatingHours;
  holidays: HolidayEntry[];         // 特定日休業 { date: 'YYYY-MM-DD', slots?: Slot[] }
  regularHolidays: RegularHolidayEntry[]; // 定期休業 { weekday: 0-6, slots?: Slot[] }
  orderPaused: boolean;
}
```

---

## 5. Supabase テーブル構成

### `menu` テーブル
| カラム | 型 | 説明 |
|--------|----|------|
| `id` | int8 PK | 自動採番 |
| `name` | text | メニュー名 |
| `description` | text? | 説明文 |
| `price` | int4 | 価格（円） |
| `kcal` | int4? | カロリー |
| `category` | text | カテゴリ（例: "定食", "麺類"） |
| `slot` | text | `breakfast` / `lunch` / `dinner` |
| `emoji` | text? | 絵文字アイコン |
| `image_url` | text? | 画像 URL |
| `enabled` | bool | 表示フラグ（false=非表示） |
| `sold_out` | bool | 売切フラグ |
| `is_noodle` | bool | 麺類フラグ（オプション適用判定用） |
| `stock` | int4? | 在庫数（null=無制限） |
| `weekdays` | int4[]? | 提供曜日（null=毎日、0=日〜6=土） |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz? | null=通常、値あり=論理削除（ゴミ箱） |

### `orders` テーブル
| カラム | 型 | 説明 |
|--------|----|------|
| `id` | text PK | 注文番号（例: `A-123`、英字1文字+3桁数字） |
| `created_at` | timestamptz | 注文日時 |
| `slot_label` | text | スロットラベル（例: "昼食"） |
| `items` | jsonb | `OrderItem[]` 型（name, qty, price, optionNames?, menuId?） |
| `total` | int4 | 合計金額（円） |
| `status` | text | `pending`（待機中）/ `ready`（準備完了）/ `completed`（完了） |
| `stripe_session_id` | text? | Stripe Checkout Session ID |

### `options` テーブル（トッピング・オプション）
| カラム | 型 | 説明 |
|--------|----|------|
| `id` | text PK | `opt_` + timestamp |
| `name` | text | オプション名（例: "大盛り", "ライス追加"） |
| `price` | int4 | 追加料金（円） |
| `applies_to` | text | `all`=全品対象 / カテゴリ名=特定カテゴリのみ |
| `weekdays` | int4[]? | 提供曜日（null=毎日） |
| `slots` | text[]? | 提供スロット（null=全時間帯） |
| `created_at` | timestamptz | |

### `settings` テーブル（KV ストア）
| key | value の型 | 説明 |
|-----|-----------|------|
| `operating_hours` | `OperatingHours` | スロットごとの開始・終了時刻 `{ breakfast: { sh: [8,30], eh: [10,0] }, ... }` |
| `holidays` | `HolidayEntry[]` | 特定日休業リスト |
| `regular_holidays` | `RegularHolidayEntry[]` | 定期休業リスト |
| `order_paused` | boolean | 受付停止フラグ |

### `admins` テーブル
| カラム | 型 | 説明 |
|--------|----|------|
| `email` | text PK | 管理者メール（小文字で保存） |
| `created_at` | timestamptz | |

### DB 関数（RPC）
| 関数名 | 引数 | 返り値 | 説明 |
|--------|------|--------|------|
| `reserve_stock` | `p_menu_id int, p_qty int` | `boolean` | 在庫を原子的に確保。在庫不足なら false を返す |
| `restore_stock` | `p_menu_id int, p_qty int` | `void` | 在庫を戻す（決済失敗・注文削除時） |
| `decrement_stock` | `p_menu_id int, p_qty int` | `void` | 旧実装（現在未使用） |

---

## 6. 主要な実装パターン・設計ルール

### 在庫管理（重要）
```
checkout 時: reserve_stock() で原子的に在庫確保
  → 失敗した場合: restore_stock() でそれまでの確保分を全てロールバック
  → Stripe セッション作成失敗時も同様にロールバック

success ページ: 注文レコードを DB に保存（在庫の減算はしない。reserve_stock が既に減算済み）

注文削除時（管理画面）: status='pending' の注文のみ restore_stock() で在庫を戻す
```

### 管理者認証の二段構え
```
① ADMIN_EMAILS 環境変数 → 固定管理者（DB から削除不可）
② admins テーブル → 動的に追加・削除可能な管理者
```

### AppStatus の遷移ロジック（home-client.tsx の getStatus()）
```
優先順位:
1. TEST_MODE=true → 強制 'open'（TEST_SLOT=lunch）
2. orderPaused=true → 'paused'（メニューは表示、注文ボタン無効）
3. 今日が終日休業日 → 'holiday'
4. 現在時刻が営業時間内かつ当スロットが休業日 → 'holiday'
5. 現在時刻が営業時間内 → 'open'
6. 次の営業開始まで待機中 → 'waiting'
7. 全スロット終了後 → 'closed'
```

### 曜日フィルタリング
- `menu.weekdays`: null=毎日表示、`[1,2,3,4,5]`=平日のみ など
- `options.weekdays`: null=毎日表示
- `options.slots`: null=全スロットで表示
- フロント側で `new Date().getDay()` と比較してフィルタ

### Stripe 決済
- `mode: 'payment'`（都度払い）、`currency: 'jpy'` 固定
- `payment_method_types` を省略して Dynamic Payment Methods（ダッシュボード設定）を使用
- `automatic_payment_methods: { enabled: true }` を型拡張で設定済み
- Apple Pay・Google Pay は card が有効なら自動対応
- PayPay は Stripe ダッシュボード → 設定 → 決済手段 で別途有効化が必要

### Server Actions（src/app/admin/actions.ts）
- 全関数の先頭で `requireAdmin()` を呼んで認証チェック
- `revalidatePath('/admin')` と `revalidatePath('/')` を必ず呼ぶ
- Supabase は必ず `getSupabaseServer()`（service_role key）を使う

---

## 7. 環境変数

`.env.local` に設定。Vercel では Environment Variables に登録。

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `SUPABASE_URL` | Supabase プロジェクト URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anon key（ブラウザ側で使用） | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key（サーバー側で使用） | ✅ |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー（`sk_live_...`） | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook シークレット（`whsec_...`） | ✅ |
| `NEXTAUTH_SECRET` | NextAuth 署名キー（`openssl rand -base64 32`） | ✅ |
| `NEXTAUTH_URL` | 本番 URL（例: `https://xxx.vercel.app`） | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | ✅ |
| `ADMIN_EMAILS` | 固定管理者メール（カンマ区切り複数可） | ✅ |
| `NEXT_PUBLIC_DEV_TEST_MODE` | `true` でテストモード有効（本番では設定しない） | ❌ |

> ⚠️ `.env.local` は `.gitignore` で除外済み。絶対にコミットしないこと。

---

## 8. 完成済み機能一覧

### ユーザー側（`/`）
- [x] 営業時間判定（朝食 8:30-10:00 / 昼食 11:00-14:00 / 夕食 17:00-19:20）
- [x] スロット自動切替・次の営業開始までのカウントダウン表示
- [x] 休業日表示（特定日・定期・スロット指定すべて対応）
- [x] 受付停止バナー（paused 中でもメニュー閲覧は可能、注文ボタンは無効）
- [x] 曜日限定メニューフィルタ（weekdays カラム）
- [x] カテゴリタブでメニューフィルタ
- [x] 在庫表示・残り数表示・売切表示
- [x] トッピング/オプション選択（曜日・スロット絞り込み対応）
- [x] カート（LocalStorage 保持、ページリロードで復元）
- [x] Stripe Checkout による決済
- [x] 決済完了ページ（QR コード付き食券表示）
- [x] 食券履歴（LocalStorage、最大表示あり）
- [x] テストモード（`NEXT_PUBLIC_DEV_TEST_MODE=true` で昼食スロット固定で常時オープン）
- [x] 🧪 テストモードインジケーター表示

### 管理者側（`/admin`）
- [x] Google OAuth ログイン（管理者のみアクセス可）
- [x] メニュー管理（追加・編集・論理削除・復元・物理削除）
- [x] 在庫補充・売切切替
- [x] 曜日タブによるメニューフィルタ表示
- [x] メニューへの曜日限定設定（checkboxUI）
- [x] オプション管理（追加・編集・削除・曜日/スロット絞り込み設定）
- [x] 注文一覧（Supabase Realtime でリアルタイム更新）
- [x] 注文「準備完了」マーク
- [x] 注文削除（pending の場合は在庫を自動復元）
- [x] 特定日休業設定（単日・期間指定・スロット指定）
- [x] 定期休業設定（毎週 X 曜日・スロット指定）
- [x] 営業時間設定（スロットごとに開始・終了時刻を変更）
- [x] 受付停止 ON/OFF トグル
- [x] 管理者メール追加・削除（環境変数の固定管理者は削除不可）
- [x] ゴミ箱（論理削除されたメニューの一覧・復元・物理削除）

---

## 9. 開発コマンド

```bash
# 依存インストール
npm install

# 開発サーバー起動（テストモード有効）
NEXT_PUBLIC_DEV_TEST_MODE=true npm run dev
# → http://localhost:3000

# 型チェック（エラー0を確認してからコミット）
npx tsc --noEmit

# 本番ビルド確認
npm run build
```

---

## 10. デプロイフロー

```bash
# 変更 → 型チェック → コミット → プッシュ（Vercel が自動デプロイ）
npx tsc --noEmit
git add <files>
git commit -m "..."
git push origin main
```

> **SSH が使えない場合**: ネットワーク環境によって port 22 がブロックされることがある。  
> その場合は GitHub Personal Access Token（PAT）を使った HTTPS 方式でプッシュ:  
> `git remote set-url origin https://<PAT>@github.com/koti0829/mobile-order-next.git`  
> プッシュ後は SSH に戻す: `git remote set-url origin git@github.com:koti0829/mobile-order-next.git`

---

## 11. 注意事項・既知の問題

### ⚠️ 絶対に守ること
1. **`.env.local` をコミットしない**（.gitignore で除外済み）
2. **`getSupabaseServer()` はサーバー側でのみ使う**（service_role key が漏洩するため）
3. **Server Actions は必ず `requireAdmin()` を先頭で呼ぶ**
4. **型変更時は `database.ts` も必ず更新する**（Supabase の型は手動管理）
5. **`payment_method_types` と `automatic_payment_methods` は併用不可**

### 🐛 既知の問題・制限
| # | 内容 | 影響 | 優先度 |
|---|------|------|--------|
| 1 | Stripe セッションタイムアウト時（24h）に在庫が戻らない | 在庫が消費されたまま残る | 中 |
| 2 | 画像アップロード機能なし | `image_url` は手動 URL 入力 | 低 |
| 3 | 注文番号の衝突可能性（確率は低い） | 極稀に重複 | 低 |
| 4 | ユーザー側メニューはリアルタイム更新されない | 管理者がメニュー変更してもユーザーはリロードまで反映されない | 低 |

> 問題1の恒久対応: Stripe の `checkout.session.expired` Webhook イベントを受けて `restore_stock` RPC を呼ぶ処理を `/api/webhook` に追加する。

---

## 12. 次フェーズの実装予定（Phase 2）

### キッチン画面 `/kitchen`
- 認証なし or PIN 認証のフルスクリーン表示
- Supabase Realtime で新着注文をリアルタイム一覧表示
- 「準備完了」ボタンで orders.status を `ready` に更新

### 呼び出し画面 `/display`
- テレビ・大型モニタ向けの表示専用ページ
- `ready` になった注文番号をアニメーション付きで表示
- 一定時間後に自動で `completed` に遷移・消去

### 売上集計（管理画面内に追加）
- 日別・スロット別・メニュー別の売上集計
- CSV エクスポート機能
- `orders` テーブルへの集計クエリ（Supabase の RPC か view を活用）

### Stripe キャンセル時の在庫復元（Webhook 追加）
- `/api/webhook` に `checkout.session.expired` イベントのハンドラを追加
- セッションの metadata から items を取り出し `restore_stock` を呼ぶ

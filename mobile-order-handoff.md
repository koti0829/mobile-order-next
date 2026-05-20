# 学食モバイルオーダー 引き継ぎドキュメント

> 最終更新: 2026-05-13

---

## 1. プロジェクト概要

学生食堂向けモバイルオーダーシステム。  
学生がスマートフォンからメニューを選び Stripe で決済、QR コード付き食券を受け取る。  
厨房スタッフは管理画面で注文を確認し「準備完了」に更新する。

**対象ユーザー**
- 学生（注文者）— モバイルブラウザでアクセス
- 厨房スタッフ（管理者）— `/admin` にアクセス（Google OAuth でログイン必須）

---

## 2. 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router + Turbopack) | 16.2.6 |
| UI ライブラリ | React | 19.2.6 |
| 言語 | TypeScript | 5.x (strict) |
| データベース | Supabase (PostgreSQL) | @supabase/supabase-js 2.x |
| 認証 | NextAuth.js (Google OAuth) | 4.x |
| 決済 | Stripe Checkout | 17.x |
| デプロイ | Vercel | — |
| スタイリング | CSS Modules (globals.css) | — |

---

## 3. 完成している機能一覧

### ユーザー側
- [x] 営業時間判定（朝食 / 昼食 / 夕食 スロット自動切替）
- [x] メニュー表示（スロット別・カテゴリ別タブ）
- [x] 休業日・定期休業表示（holiday / 終日 or スロット指定）
- [x] 受付停止バナー表示（paused 中もメニューは閲覧可能、注文不可）
- [x] 在庫表示・売切表示（stock カラム連動）
- [x] 曜日限定メニュー（weekdays カラム）
- [x] トッピング / オプション選択（曜日・スロット絞り込み対応）
- [x] カート（LocalStorage 保持）
- [x] Stripe Checkout による決済（JPY）
- [x] 決済完了ページ（食券 QR コード表示）
- [x] 食券履歴（LocalStorage）
- [x] テストモード（`NEXT_PUBLIC_DEV_TEST_MODE=true` で常時オープン扱い）

### 管理者側 (`/admin`)
- [x] Google OAuth ログイン（`ADMIN_EMAILS` または `admins` テーブルで制御）
- [x] メニュー管理（追加 / 編集 / 論理削除 / 復元 / 物理削除）
- [x] 在庫補充・売切切替
- [x] 曜日タブでメニューをフィルタ表示
- [x] メニューへの曜日限定設定（曜日チェックボックス）
- [x] オプション管理（追加 / 編集 / 削除 / 曜日・スロット絞り込み）
- [x] 注文一覧（リアルタイム Supabase リアルタイム購読）
- [x] 注文「準備完了」マーク・注文削除（pending 削除時は在庫自動復元）
- [x] 特定日休業設定（単日 / 期間指定 / スロット指定）
- [x] 定期休業設定（毎週 X 曜日）
- [x] 営業時間設定
- [x] 受付停止 ON/OFF
- [x] 管理者メール追加 / 削除
- [x] ゴミ箱（論理削除されたメニューの一覧・復元・物理削除）

### バックエンド / インフラ
- [x] 原子的在庫確保（`reserve_stock` RPC → 決済失敗時は `restore_stock` でロールバック）
- [x] Stripe Webhook（決済完了後に注文レコード作成）
- [x] Server Actions（管理操作はすべてサーバーサイド、`requireAdmin()` で保護）

---

## 4. ファイル構成

```
src/
├── app/
│   ├── page.tsx                    # トップページ（SSR: メニュー・設定取得）
│   ├── home-client.tsx             # メインUI（Client Component）
│   ├── globals.css                 # 全体スタイル
│   ├── layout.tsx                  # ルートレイアウト
│   ├── admin/
│   │   ├── page.tsx                # 管理ページ（SSR: 認証チェック）
│   │   ├── admin-client.tsx        # 管理UI（Client Component）
│   │   └── actions.ts              # Server Actions（全管理操作）
│   ├── api/
│   │   ├── checkout/route.ts       # POST /api/checkout（在庫確保 + Stripe セッション作成）
│   │   ├── settings/route.ts       # GET /api/settings（設定取得）
│   │   └── auth/[...nextauth]/route.ts  # NextAuth ハンドラ
│   └── success/
│       ├── page.tsx                # 決済完了ページ（Stripe Webhook で注文保存）
│       └── TicketDisplay.tsx       # 食券表示 UI
├── lib/
│   ├── auth.ts                     # NextAuth 設定・管理者チェック
│   ├── db-mappers.ts               # DB Row → アプリ型への変換
│   ├── format.ts                   # formatDate / formatDateTime ユーティリティ
│   ├── menu.ts                     # SLOTS 定義・TEST_MODE・RECENT_TICKETS_KEY
│   ├── settings.ts                 # fetchSettings・型定義（AppSettings 等）
│   ├── storage.ts                  # LocalStorage ユーティリティ
│   ├── stripe.ts                   # Stripe クライアント
│   ├── supabase.ts                 # Supabase クライアント（ブラウザ用）
│   └── supabase-server.ts          # Supabase クライアント（サーバー用）
├── types/
│   ├── index.ts                    # アプリ共通型（MenuItem, Order, AppStatus 等）
│   └── database.ts                 # Supabase テーブル型定義
└── instrumentation.ts              # Next.js instrumentation フック
```

---

## 5. 環境変数一覧

`.env.local` に設定（Vercel では Environment Variables に登録）

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `SUPABASE_URL` | Supabase プロジェクト URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anon key（クライアント用） | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key（サーバー用） | ✅ |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー（`sk_live_...`） | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook シークレット（`whsec_...`） | ✅ |
| `NEXTAUTH_SECRET` | NextAuth 署名キー（`openssl rand -base64 32`） | ✅ |
| `NEXTAUTH_URL` | デプロイ先 URL（例: `https://xxx.vercel.app`） | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | ✅ |
| `ADMIN_EMAILS` | 管理者メール（カンマ区切り複数可） | ✅ |
| `NEXT_PUBLIC_DEV_TEST_MODE` | `true` でテストモード有効（本番では未設定） | ❌ |

> ⚠️ `.env.local` は `.gitignore` で除外済み。絶対にコミットしないこと。  
> 参考: `.env.local.example` にテンプレートあり。

---

## 6. URL

| 環境 | URL |
|------|-----|
| GitHub リポジトリ | https://github.com/koti0829/mobile-order-next |
| 本番（Vercel） | ※デプロイ後に記入 |
| Supabase ダッシュボード | https://supabase.com/dashboard |
| Stripe ダッシュボード | https://dashboard.stripe.com |

---

## 7. Supabase テーブル構成

### `menu` テーブル
| カラム | 型 | 説明 |
|--------|----|------|
| `id` | `int8` (PK) | 自動採番 |
| `name` | `text` | メニュー名 |
| `description` | `text?` | 説明 |
| `price` | `int4` | 価格（円） |
| `kcal` | `int4?` | カロリー |
| `category` | `text` | カテゴリ（例: "定食"）|
| `slot` | `text` | `breakfast` / `lunch` / `dinner` |
| `emoji` | `text?` | 絵文字アイコン |
| `image_url` | `text?` | 画像 URL |
| `enabled` | `bool` | 表示フラグ |
| `sold_out` | `bool` | 売切フラグ |
| `is_noodle` | `bool` | 麺類フラグ（麺替え玉オプション判定用）|
| `stock` | `int4?` | 在庫数（null=無制限）|
| `weekdays` | `int4[]?` | 提供曜日（null=毎日, 0=日〜6=土）|
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `deleted_at` | `timestamptz?` | null=通常, 値あり=論理削除 |

### `orders` テーブル
| カラム | 型 | 説明 |
|--------|----|------|
| `id` | `text` (PK) | 注文番号（例: `A-123`）|
| `created_at` | `timestamptz` | 注文日時 |
| `slot_label` | `text` | スロットラベル（例: "昼食"）|
| `items` | `jsonb` | 注文明細（`OrderItem[]`）|
| `total` | `int4` | 合計金額 |
| `status` | `text` | `pending` / `ready` / `completed` |
| `stripe_session_id` | `text?` | Stripe セッション ID |

### `options` テーブル
| カラム | 型 | 説明 |
|--------|----|------|
| `id` | `text` (PK) | `opt_` + timestamp |
| `name` | `text` | オプション名（例: "大盛り"）|
| `price` | `int4` | 追加料金 |
| `applies_to` | `text` | `all` / カテゴリ名 |
| `weekdays` | `int4[]?` | 提供曜日（null=毎日）|
| `slots` | `text[]?` | 提供スロット（null=全時間帯）|
| `created_at` | `timestamptz` | |

### `settings` テーブル（KV ストア）
| key | value の型 | 説明 |
|-----|-----------|------|
| `operating_hours` | `OperatingHours` | 各スロットの開始・終了時刻 |
| `holidays` | `HolidayEntry[]` | 特定日休業（date + slots?）|
| `regular_holidays` | `RegularHolidayEntry[]` | 定期休業（weekday + slots?）|
| `order_paused` | `boolean` | 受付停止フラグ |

### `admins` テーブル
| カラム | 型 | 説明 |
|--------|----|------|
| `email` | `text` (PK) | 管理者メールアドレス（小文字）|
| `created_at` | `timestamptz` | |

### DB 関数（RPC）
| 関数名 | 引数 | 返り値 | 説明 |
|--------|------|--------|------|
| `reserve_stock` | `p_menu_id int, p_qty int` | `boolean` | 在庫を原子的に確保（不足時 false）|
| `restore_stock` | `p_menu_id int, p_qty int` | `void` | 在庫を戻す（決済失敗・注文削除時）|
| `decrement_stock` | `p_menu_id int, p_qty int` | `void` | 在庫をデクリメント（旧実装、現在未使用）|

---

## 8. 次に実装予定の機能（Phase 2）

### 8-1. キッチン画面 `/kitchen`
- 認証不要（またはシンプルな PIN 認証）のフルスクリーン表示
- 新着注文をリアルタイムで一覧表示（Supabase Realtime）
- 「準備完了」ボタンで status を `ready` に更新
- 音・バイブ通知オプション

### 8-2. 呼び出し画面 `/display`
- テレビや大型モニタ向けの表示専用画面
- `ready` になった注文番号をアニメーション表示
- 呼び出し済みは一定時間後に自動消去（`completed` に遷移）

### 8-3. 売上集計画面（管理画面内）
- 日別 / スロット別 / メニュー別の売上集計
- CSV エクスポート
- Supabase の `orders` テーブルを集計クエリで表示

---

## 9. 注意事項・既知の問題

### ⚠️ 注意事項

1. **在庫管理の設計**  
   `reserve_stock` が checkout 時に在庫を確保し、決済完了後（Stripe Webhook）に注文レコードを保存する。  
   Stripe セッション作成後にユーザーがキャンセルした場合、在庫は **Stripe の `cancel_url` リダイレクトでは戻らない**（現状）。  
   → Phase 2 で Stripe の `checkout.session.expired` Webhook を受けて `restore_stock` を呼ぶ実装が必要。

2. **Stripe Webhook のエンドポイント**  
   本番デプロイ後に Stripe Dashboard でエンドポイント URL を更新し、`STRIPE_WEBHOOK_SECRET` を再設定すること。  
   URL: `https://<本番ドメイン>/api/webhook`（現在 `/success` ページで処理）

3. **Google OAuth のリダイレクト URI**  
   本番 URL に変わった場合は Google Cloud Console で承認済みリダイレクト URI を更新すること。  
   URI: `https://<本番ドメイン>/api/auth/callback/google`

4. **管理者の初期設定**  
   `ADMIN_EMAILS` 環境変数に最低1つのメールアドレスを設定すること。  
   未設定の場合、管理画面にアクセスできる管理者がいなくなる。

5. **テストモードを本番に持ち込まない**  
   `NEXT_PUBLIC_DEV_TEST_MODE` は Vercel の環境変数に**設定しないこと**。  
   この変数がないと自動的に `false` になり、通常の営業時間判定が有効になる。

### 🐛 既知の問題・制限

| # | 内容 | 影響 | 対処方法 |
|---|------|------|---------|
| 1 | Stripe キャンセル時に在庫が戻らない | 在庫が過剰に消費される可能性 | `checkout.session.expired` Webhook を実装 |
| 2 | 画像アップロード機能なし | `image_url` は手動で URL を入力 | Supabase Storage 連携を実装予定 |
| 3 | 注文番号の衝突可能性 | 同時アクセス時に極稀に重複 | UUID への変更、または DB UNIQUE 制約を追加 |
| 4 | 管理画面はリアルタイム更新だがメニューは手動リロード | 管理者がメニュー変更してもユーザー側は即時反映されない | ISR or Supabase Realtime を `/` にも適用 |

---

## 10. ローカル開発の手順

```bash
# 依存関係インストール
npm install

# 環境変数を設定（.env.local.example を参考に）
cp .env.local.example .env.local
# → .env.local を編集して各値を設定

# 開発サーバー起動（テストモード有効）
NEXT_PUBLIC_DEV_TEST_MODE=true npm run dev

# 型チェック
npx tsc --noEmit

# ビルド確認
npm run build
```

> 開発中は `NEXT_PUBLIC_DEV_TEST_MODE=true` を設定すると、時間帯に関わらず昼食スロットでメニューが表示される。

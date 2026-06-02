# 学食モバイルオーダー — Claude Code ガイド

学生食堂向けのモバイルオーダーシステム。メニュー表示・カート・Stripe 決済までをスマホで完結させ、管理画面から在庫・休業日・オプション・注文を運用する。

## 本番環境

| 項目 | 値 |
|---|---|
| 本番URL | https://mobile-order-try.vercel.app |
| GitHub | https://github.com/koti0829/mobile-order-next |
| ローカル起動 | リポジトリ直下で `npm run dev`（http://localhost:3000 または :3001） |
| デプロイ方式 | `main` マージ → Vercel が本番へ自動デプロイ（ブランチ/PR はプレビューデプロイを自動生成） |

## 技術スタック

- **フロントエンド**: Next.js 16（App Router）+ TypeScript ※`README.md` には「Next.js 15」とあるが `package-lock.json` 実体は 16.2.6。揃えるなら README を更新
- **データベース**: Supabase（PostgreSQL）。`SUPABASE_SERVICE_ROLE_KEY` は RLS をバイパスするため必ずサーバー側でのみ使用
- **認証**: NextAuth.js（Google OAuth）。管理画面のみ認証必須で、`signIn` コールバックで管理者だけログイン可
- **決済**: Stripe Checkout（`/api/checkout`）+ Webhook（`/api/webhook`）
- **キャッシュ**: `unstable_cache`（ISR、`revalidate: 60`）。メニュー変更時は `revalidateTag('menu')` で即時パージ

## ファイル構成

```
src/
  app/
    layout.tsx                  # ルートレイアウト（ja, viewport固定）
    page.tsx / home-client.tsx  # 注文画面（カート・確認シート・オプションモーダル）
    success/                    # 決済完了・食券番号表示
    admin/
      page.tsx                  # 管理画面（サーバーで初期データ取得）
      admin-client.tsx          # 管理UI（menu/orders/options/trash/settings タブ）
      actions.ts                # Server Actions（全て requireAdmin で保護）
    api/
      checkout/route.ts         # Stripe セッション作成＋在庫の原子的確保
      webhook/route.ts          # checkout.session.expired で確保済み在庫を戻す
      settings/route.ts         # 設定取得
      auth/[...nextauth]/       # NextAuth エンドポイント
  lib/
    auth.ts                     # NextAuth設定・管理者判定
    supabase-server.ts          # service_role クライアント
    stripe.ts                   # Stripe クライアント
    settings.ts                 # 設定取得（営業時間・休業日・受付停止）
    menu.ts                     # SLOT 定義
    menu-cache.ts               # ISRキャッシュ付きメニュー/オプション取得
    db-mappers.ts               # DB行 → アプリ型 変換
    format.ts / storage.ts      # 日時整形 / SSR安全な localStorage ラッパ
  types/
    index.ts / database.ts      # アプリ型 / Supabase 型定義
  instrumentation.ts            # 起動時パッチ（壊れた localStorage 対策）
```

## 管理者ログイン（固定パスワードなし）

固定テストアカウントは持たない。Google アカウントでログインし、許可されるのは以下のみ。

| 種別 | 判定元 | 削除 |
|---|---|---|
| 固定管理者 | 環境変数 `ADMIN_EMAILS`（カンマ区切り） | 不可（UIで🔒表示） |
| 追加管理者 | DB の `admins` テーブル | 管理画面から追加・削除可 |

## 開発ワークフロー（必ず守ること）

1. **専用ブランチで作業**（`main` へ直接 push しない）
2. **コード変更 → `npx tsc --noEmit` で型エラー0を確認 → コミット → push → ドラフトPR作成**
3. **Vercel のプレビューURLで動作確認**
4. **「マージしていい？」とユーザーに確認してから** `main` へマージ
5. マージ後、Vercel が本番へ自動デプロイ。結果（成功/失敗）をユーザーに報告。失敗なら即追加修正

> **閾値ルール**: 決済・在庫・認証まわりに触る変更は必ず上記のPRフローを通すこと。文言修正や軽微なスタイル調整など些末な変更は直 push 可。
>
> **PR操作の前提**: `merge_pull_request` 等を使う場合は GitHub コネクタの有効化、または `gh` CLI が必要。未設定なら素の git 運用に留めること。

## 環境変数

`.env.local`（ローカル）および Vercel の環境変数に設定する。**値はこのファイルに書かない**（名前のみ記載）。

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=        # サーバー専用・絶対に公開しない

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=            # Webhook 検証用

# NextAuth（Google OAuth）
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
ADMIN_EMAILS=                     # 固定管理者（カンマ区切り）
```

> ⚠️ `.env.local` 本体・APIキー・鍵・生パスワードは絶対にコミットしない（`.gitignore` で `.env*.local` は除外済み）。秘密情報は常に `.env.local` か Vercel の環境変数に置き、このガイドには「名前」だけを残すこと。
>
> ⚠️ 環境変数を変更したら Vercel ダッシュボードから **Redeploy** する。

## 主なデータモデル（Supabase）

| テーブル | 用途 |
|---|---|
| `menu` | メニュー（価格・在庫`stock`・売切`sold_out`・論理削除`deleted_at`・`enabled`・`weekdays`・`slot`） |
| `orders` | 注文（`items`・`status`・`total`・`stripe_session_id`・`created_at`） |
| `options` | トッピング（`applies_to`・`weekdays`・`slots`） |
| `settings` | key-value 設定（`order_paused` / `operating_hours` / `holidays` など） |
| `admins` | 追加管理者のメール |

**RPC（在庫を原子的に操作）**: `reserve_stock`（確保 → bool）/ `restore_stock`（戻し）/ `decrement_stock`（確定減算）

> ⚠️ **DBの構造（テーブル・RPC）は Supabase 側にあり、リポジトリには無い**（構造を作る SQL ファイルは含まれていない）。テーブルの列追加・RPC の変更などスキーマ変更は Supabase の SQL エディタで手動で行う。コードを push しても構造は反映されない。コード変更で新しい列・テーブルを前提にする場合は、先に Supabase 側へ反映すること。

## 注文ステータス

| ステータス | 意味 |
|---|---|
| `pending` | 🔴 準備中（決済済み・調理待ち） |
| `ready` | 🟢 受け取り可能 |
| `completed` | 受け取り完了 |

## 提供スロット

| スロット | 表示 |
|---|---|
| `breakfast` | 🌅 朝食 |
| `lunch` | 🍱 昼食 |
| `dinner` | 🌙 夕食 |

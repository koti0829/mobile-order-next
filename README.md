# 学食モバイルオーダーシステム

学生食堂向けのモバイルオーダー Web アプリケーション。
事前注文・キャッシュレス決済・受付番号発行までを一貫して提供します。

## 本番URL

https://mobile-order-try.vercel.app

## 主な機能

- メニュー閲覧・カート追加
- Stripe による決済（カード・Apple Pay・Google Pay 自動対応）
- 食券（受付番号）の発行
- 在庫管理・売り切れ自動切替
- 営業時間・休業日制御
- 管理者による注文履歴閲覧・一括削除
- メニュー変更の即時反映（ISR + revalidateTag）

## モード

### 通常モード
学生が利用する注文画面（`/`）。
メニューを選んでカートに追加 → Stripe Checkout で決済 → 受付番号を発行する流れ。

### Demo（テスト）モード
環境変数 `NEXT_PUBLIC_DEV_TEST_MODE=true` で有効化。
Stripe のテスト環境で動作し、テストカード（`4242 4242 4242 4242`）で決済フローを通せます。
実際の課金は発生しません。

### Admin モード
URL: `/admin`

- Google アカウントでログイン（NextAuth + Google OAuth）
- 環境変数 `ADMIN_EMAILS` に登録されたメールアドレスのみアクセス可能
- 機能一覧:
  - メニュー管理（追加・編集・在庫補充・売り切れ切替・論理削除/復元/完全削除）
  - オプション管理（追加・編集・削除）
  - 注文履歴（一括選択・一括削除、削除時は pending 注文の在庫を自動復元）
  - 営業時間設定
  - 休業日設定
  - 管理者リスト管理（固定管理者 + 追加管理者）

## 技術スタック

- **フロントエンド**: Next.js 16 (App Router) / React / TypeScript
- **バックエンド**: Next.js API Routes / Server Actions
- **DB**: Supabase (PostgreSQL)
- **認証**: NextAuth (Google OAuth)
- **決済**: Stripe Checkout（Webhook で在庫復元）
- **ホスティング**: Vercel

## セットアップ

### 必要な環境変数

`.env.local.example` を参考に `.env.local` を作成してください。

| 変数名 | 用途 |
|--------|------|
| `NEXTAUTH_URL` | NextAuth のベース URL |
| `NEXTAUTH_SECRET` | NextAuth のセッション暗号化キー |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `ADMIN_EMAILS` | 管理者メールアドレス（カンマ区切り） |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名検証用シークレット |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー（Webhook 用） |
| `NEXT_PUBLIC_DEV_TEST_MODE` | テストモード有効化（`true` で有効） |

### ローカル起動

```bash
npm install
npm run dev
```

http://localhost:3000 でアクセスできます。

### 型チェック

```bash
npx tsc --noEmit
```

## デプロイ

`main` ブランチへの push で Vercel に自動デプロイされます。
環境変数を変更した場合は Vercel ダッシュボードから Redeploy が必要です。

## Stripe Webhook

`/api/webhook` で `checkout.session.expired` を受信し、Stripe Checkout のセッション期限切れ時に在庫を自動復元します。
Stripe ダッシュボードで Webhook 登録が必要です。

## ライセンス

MIT

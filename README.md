# 学食モバイルオーダー (TCU Mobile Order)

東京都市大学の学食向けモバイルオーダーシステム。

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + TypeScript
- **データベース**: Supabase (PostgreSQL)
- **認証**: NextAuth.js (Google OAuth)
- **決済**: Stripe
- **デプロイ**: Vercel

## 機能

- メニュー表示（朝食・昼食・夕食）
- カート・Stripe 決済
- 管理画面（メニュー管理・注文管理・設定）
- 在庫管理・売り切れ表示
- 休業日・受付停止機能
- オプション（トッピング）管理

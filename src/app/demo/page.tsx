import type { Metadata } from 'next';
import { getCachedMenuItems, getCachedOptions } from '@/lib/menu-cache';
import HomeClient from '../home-client';

// デモページは検索インデックスに載せない
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// 隔離デモ: 実メニュー（ランチ）を表示し、Stripe テスト決済まで動かせる。
// 在庫・注文履歴には一切影響しない（demo-checkout / webhook / demo/success で隔離）。
// 営業時間・休業日・受付停止は無視して lunch・営業中固定（HomeClient の isDemo）。
export default async function DemoPage() {
  const [initialMenu, initialOptions] = await Promise.all([
    getCachedMenuItems(),
    getCachedOptions(),
  ]);

  return (
    <HomeClient
      initialMenu={initialMenu}
      initialOptions={initialOptions}
      isDemo
    />
  );
}

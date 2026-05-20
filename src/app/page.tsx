import { getCachedMenuItems, getCachedOptions } from '@/lib/menu-cache';
import HomeClient from './home-client';

// サーバーコンポーネント: メニュー・オプションを ISR キャッシュ付きで取得し
// クライアントコンポーネントに初期値として渡す。
// 管理画面でメニューを変更すると revalidateTag('menu') でキャッシュがパージされ、
// 次のリクエスト時に最新データが反映される。
export default async function Page() {
  const [initialMenu, initialOptions] = await Promise.all([
    getCachedMenuItems(),
    getCachedOptions(),
  ]);

  return (
    <HomeClient
      initialMenu={initialMenu}
      initialOptions={initialOptions}
    />
  );
}

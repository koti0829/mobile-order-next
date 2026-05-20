import { unstable_cache } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';
import { mapMenuRow, mapOptionRow } from '@/lib/db-mappers';
import type { MenuItem, OptionItem } from '@/types';

/** キャッシュタグ（admin/actions.ts の revalidateTag と合わせること） */
export const MENU_CACHE_TAG = 'menu';

/**
 * メニューアイテム一覧を ISR キャッシュ付きで取得する。
 * 管理画面でメニューを変更すると revalidateTag('menu') でキャッシュが即時パージされる。
 * フォールバックとして最大60秒で自動更新。
 */
export const getCachedMenuItems = unstable_cache(
  async (): Promise<MenuItem[]> => {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('menu')
      .select('*')
      .is('deleted_at', null)
      .eq('enabled', true)
      .order('id');
    return (data ?? []).map(mapMenuRow);
  },
  ['menu-items'],
  { tags: [MENU_CACHE_TAG], revalidate: 60 }
);

/**
 * オプション一覧を ISR キャッシュ付きで取得する。
 */
export const getCachedOptions = unstable_cache(
  async (): Promise<OptionItem[]> => {
    const supabase = getSupabaseServer();
    const { data } = await supabase.from('options').select('*');
    return (data ?? []).map(mapOptionRow);
  },
  ['menu-options'],
  { tags: [MENU_CACHE_TAG], revalidate: 60 }
);

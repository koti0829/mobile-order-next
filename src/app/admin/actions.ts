'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions, isEnvAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase-server';
import type { MenuItem, OptionItem } from '@/types';
import type { Database } from '@/types/database';
import type { OperatingHours, HolidayEntry, RegularHolidayEntry } from '@/lib/settings';

type MenuUpdate = Database['public']['Tables']['menu']['Update'];

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error('未ログイン');
  return session.user.email;
}

// ── メニュー ──
export async function addMenuItem(item: Omit<MenuItem, 'id' | 'enabled' | 'soldOut'>) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('menu').insert({
    name:        item.name,
    description: item.desc,
    price:       item.price,
    kcal:        item.kcal ?? null,
    category:    item.category,
    slot:        item.slot,
    emoji:       item.emoji,
    image_url:   item.imageUrl ?? '',
    enabled:     true,
    sold_out:    false,
    is_noodle:   item.isNoodle,
    stock:       item.stock ?? null,
    weekdays:    item.weekdays && item.weekdays.length > 0 && item.weekdays.length < 7
                   ? item.weekdays
                   : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function updateMenuItem(id: number, item: Partial<MenuItem>) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const update: MenuUpdate = {};
  if (item.name     !== undefined) update.name        = item.name;
  if (item.desc     !== undefined) update.description = item.desc;
  if (item.price    !== undefined) update.price       = item.price;
  if (item.kcal     !== undefined) update.kcal        = item.kcal;
  if (item.category !== undefined) update.category    = item.category;
  if (item.slot     !== undefined) update.slot        = item.slot;
  if (item.emoji    !== undefined) update.emoji       = item.emoji;
  if (item.imageUrl !== undefined) update.image_url   = item.imageUrl;
  if (item.isNoodle !== undefined) update.is_noodle   = item.isNoodle;
  if (item.soldOut  !== undefined) update.sold_out    = item.soldOut;
  if (item.stock    !== undefined) update.stock       = item.stock;
  if (item.weekdays !== undefined) {
    update.weekdays = item.weekdays && item.weekdays.length > 0 && item.weekdays.length < 7
      ? item.weekdays
      : null;
  }
  update.updated_at = new Date().toISOString();
  const { error } = await supabase.from('menu').update(update).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function toggleSoldOut(id: number, soldOut: boolean) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('menu')
    .update({ sold_out: soldOut, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

// 論理削除（ゴミ箱へ）
export async function deleteMenuItem(id: number) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('menu')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

// 復元（ゴミ箱から戻す）
export async function restoreMenuItem(id: number) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('menu')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

// 完全削除（物理削除）
export async function permanentlyDeleteMenuItem(id: number) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('menu').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

// 在庫補充 + soldOut 再計算
export async function replenishStock(id: number, stock: number | null) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  // null=無制限→sold_out=false, 0以下→sold_out=true, 正→sold_out=false
  const soldOut = stock !== null && stock <= 0;
  const { error } = await supabase
    .from('menu')
    .update({ stock, sold_out: soldOut, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

// ── オプション ──
type SlotVal = 'breakfast' | 'lunch' | 'dinner';

function normalizeWeekdays(w: number[] | null): number[] | null {
  if (!w || w.length === 0 || w.length === 7) return null;
  return w;
}
function normalizeSlots(s: SlotVal[] | null): SlotVal[] | null {
  if (!s || s.length === 0 || s.length === 3) return null;
  return s;
}

export async function addOption(
  name: string,
  price: number,
  appliesTo: string,
  weekdays: number[] | null,
  slots: SlotVal[] | null
) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const id = `opt_${Date.now()}`;
  const { error } = await supabase.from('options').insert({
    id,
    name,
    price,
    applies_to: appliesTo,
    weekdays:   normalizeWeekdays(weekdays),
    slots:      normalizeSlots(slots),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function updateOption(
  id: string,
  data: {
    name?: string;
    price?: number;
    appliesTo?: string;
    weekdays?: number[] | null;
    slots?: SlotVal[] | null;
  }
) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  type OptionsUpdate = Database['public']['Tables']['options']['Update'];
  const update: OptionsUpdate = {};
  if (data.name      !== undefined) update.name       = data.name;
  if (data.price     !== undefined) update.price      = data.price;
  if (data.appliesTo !== undefined) update.applies_to = data.appliesTo;
  if (data.weekdays  !== undefined) update.weekdays   = normalizeWeekdays(data.weekdays);
  if (data.slots     !== undefined) update.slots      = normalizeSlots(data.slots);
  const { error } = await supabase.from('options').update(update).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function deleteOption(id: string) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('options').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

// ── 注文 ──
export async function markOrderReady(id: string) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('orders').update({ status: 'ready' }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function deleteOrder(id: string) {
  await requireAdmin();
  const supabase = getSupabaseServer();

  // pending 注文を削除する場合は在庫を戻す
  const { data: orderRow } = await supabase
    .from('orders')
    .select('items, status')
    .eq('id', id)
    .maybeSingle();

  if (orderRow?.status === 'pending' && Array.isArray(orderRow.items)) {
    for (const item of orderRow.items) {
      if (item.menuId != null) {
        await supabase.rpc('restore_stock', {
          p_menu_id: item.menuId,
          p_qty:     item.qty,
        });
      }
    }
  }

  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// ── 管理者 ──
export async function addAdminEmail(email: string) {
  await requireAdmin();
  const lower = email.trim().toLowerCase();
  if (!lower.includes('@')) throw new Error('無効なメールアドレスです');
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('admins').insert({ email: lower });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function removeAdminEmail(email: string) {
  await requireAdmin();
  const lower = email.trim().toLowerCase();
  if (isEnvAdmin(lower)) throw new Error('環境変数で固定された管理者は削除できません');
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('admins').delete().eq('email', lower);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// ── 設定 ──
export async function updateOperatingHours(hours: OperatingHours) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'operating_hours', value: hours as unknown as Record<string, unknown> });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function setOrderPaused(paused: boolean) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'order_paused', value: paused as unknown as Record<string, unknown> });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function addHolidayBatch(entries: HolidayEntry[]) {
  await requireAdmin();
  if (entries.length === 0) return;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('settings').select('value').eq('key', 'holidays').maybeSingle();
  const raw    = data?.value;
  const current: HolidayEntry[] = Array.isArray(raw)
    ? (raw as unknown[]).map((x: unknown) =>
        typeof x === 'string' ? { date: x } : (x as HolidayEntry))
    : [];
  const updated = [...current, ...entries].sort((a, b) => a.date.localeCompare(b.date));
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'holidays', value: updated as unknown as Record<string, unknown> });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function addHoliday(entry: HolidayEntry) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('settings').select('value').eq('key', 'holidays').maybeSingle();
  const raw    = data?.value;
  const current: HolidayEntry[] = Array.isArray(raw)
    ? (raw as unknown[]).map((x: unknown) =>
        typeof x === 'string' ? { date: x } : (x as HolidayEntry))
    : [];
  // 同じ date+slots の重複は追加しない（同一の date は並列可能）
  const updated = [...current, entry].sort((a, b) => a.date.localeCompare(b.date));
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'holidays', value: updated as unknown as Record<string, unknown> });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function removeHoliday(date: string, slots?: string[]) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('settings').select('value').eq('key', 'holidays').maybeSingle();
  const raw    = data?.value;
  const current: HolidayEntry[] = Array.isArray(raw)
    ? (raw as unknown[]).map((x: unknown) =>
        typeof x === 'string' ? { date: x } : (x as HolidayEntry))
    : [];
  const updated = current.filter(h => {
    if (h.date !== date) return true;
    if (!slots || slots.length === 0) {
      // 終日エントリの削除：slots が undefined or 空のものを対象
      return !(!h.slots || h.slots.length === 0);
    }
    // スロット指定削除：完全一致のものを除外
    return JSON.stringify((h.slots ?? []).slice().sort()) !== JSON.stringify(slots.slice().sort());
  });
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'holidays', value: updated as unknown as Record<string, unknown> });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function updateRegularHolidays(holidays: RegularHolidayEntry[]) {
  await requireAdmin();
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'regular_holidays', value: holidays as unknown as Record<string, unknown> });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

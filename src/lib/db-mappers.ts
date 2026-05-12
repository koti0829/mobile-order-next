import type { Database } from '@/types/database';
import type { MenuItem, Order, OptionItem } from '@/types';

type MenuRow   = Database['public']['Tables']['menu']['Row'];
type OrderRow  = Database['public']['Tables']['orders']['Row'];
type OptionRow = Database['public']['Tables']['options']['Row'];

export function mapMenuRow(r: MenuRow): MenuItem {
  return {
    id:       r.id,
    name:     r.name,
    desc:     r.description ?? '',
    price:    r.price,
    kcal:     r.kcal ?? undefined,
    category: r.category,
    slot:     r.slot,
    emoji:    r.emoji ?? '',
    imageUrl: r.image_url ?? '',
    enabled:  r.enabled,
    soldOut:  r.sold_out,
    isNoodle: r.is_noodle,
    stock:    r.stock,
    weekdays: r.weekdays,
  };
}

export function mapOrderRow(r: OrderRow): Order {
  return {
    id:        r.id,
    time:      r.created_at,
    slotLabel: r.slot_label,
    items:     r.items,
    total:     r.total,
    // Order型は pending | ready のみ。completed は ready 扱いに統合
    status:    r.status === 'completed' ? 'ready' : r.status,
  };
}

export function mapOptionRow(r: OptionRow): OptionItem {
  return {
    id:        r.id,
    name:      r.name,
    price:     r.price,
    appliesTo: r.applies_to,
    weekdays:  r.weekdays,
    slots:     (r.slots ?? null) as import('@/types').Slot[] | null,
  };
}

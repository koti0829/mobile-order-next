import { getSupabaseServer } from '@/lib/supabase-server';
import type { Slot } from '@/types';

export interface OperatingHours {
  breakfast: { sh: [number, number]; eh: [number, number] };
  lunch:     { sh: [number, number]; eh: [number, number] };
  dinner:    { sh: [number, number]; eh: [number, number] };
}

/** 特定日休業エントリ */
export interface HolidayEntry {
  date: string;       // YYYY-MM-DD
  slots?: Slot[];     // 省略 or 空配列 = 終日休み
}

/** 定期休業エントリ（毎週X曜日） */
export interface RegularHolidayEntry {
  weekday: number;    // 0=日 〜 6=土
  slots?: Slot[];     // 省略 or 空配列 = 終日休み
}

export interface AppSettings {
  operatingHours:  OperatingHours;
  holidays:        HolidayEntry[];
  regularHolidays: RegularHolidayEntry[];
  orderPaused:     boolean;
}

export const DEFAULT_HOURS: OperatingHours = {
  breakfast: { sh: [8, 30],  eh: [10, 0]  },
  lunch:     { sh: [11, 0],  eh: [14, 0]  },
  dinner:    { sh: [17, 0],  eh: [19, 20] },
};

/** DB の holidays 値を正規化（旧 string[] 形式との後方互換） */
function normalizeHolidays(raw: unknown): HolidayEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    if (typeof item === 'string') return { date: item };
    if (typeof item === 'object' && item !== null && 'date' in item) {
      return item as HolidayEntry;
    }
    return null;
  }).filter((x): x is HolidayEntry => x !== null);
}

export async function fetchSettings(): Promise<AppSettings> {
  const supabase = getSupabaseServer();
  const { data } = await supabase.from('settings').select('*');
  const map = new Map((data ?? []).map(r => [r.key, r.value]));

  return {
    operatingHours:  (map.get('operating_hours') as OperatingHours) ?? DEFAULT_HOURS,
    holidays:        normalizeHolidays(map.get('holidays')),
    regularHolidays: (map.get('regular_holidays') as RegularHolidayEntry[]) ?? [],
    orderPaused:     Boolean(map.get('order_paused') ?? false),
  };
}

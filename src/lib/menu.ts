import type { Slot, SlotInfo } from '@/types';

export const SLOTS: Record<Slot, SlotInfo> = {
  breakfast: { label: '朝食', emoji: '🌅', sh: [8, 30],  eh: [10, 0]  },
  lunch:     { label: '昼食', emoji: '☀️', sh: [11, 0], eh: [14, 0]  },
  dinner:    { label: '夕食', emoji: '🌙', sh: [17, 0], eh: [19, 20] },
};

// 食券URLは端末ローカルなのでlocalStorageのままでOK
export const RECENT_TICKETS_KEY = 'tcuCafe_recentTickets';

// テスト用：NEXT_PUBLIC_DEV_TEST_MODE=true の時のみ有効
// .env.local で設定、本番(Vercel)では未設定のため自動的に false
export const TEST_MODE: boolean = process.env.NEXT_PUBLIC_DEV_TEST_MODE === 'true';
export const TEST_SLOT: Slot = 'lunch';


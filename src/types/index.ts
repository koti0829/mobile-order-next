export type Slot = 'breakfast' | 'lunch' | 'dinner';

export interface OptionItem {
  id: string;
  name: string;
  price: number;
  appliesTo: string;           // 'all' または カテゴリ名
  weekdays?: number[] | null;  // null=毎日, [0-6]=特定曜日のみ
  slots?: Slot[] | null;       // null=全時間帯, ['lunch',...]=特定スロットのみ
}

export interface CartEntry {
  menuId: number;
  selectedOptions: OptionItem[];
  qty: number;
}

export interface MenuItem {
  id: number;
  name: string;
  desc: string;
  price: number;
  kcal?: number;
  category: string;
  slot: Slot;
  emoji: string;
  imageUrl?: string;
  enabled: boolean;
  soldOut: boolean;
  isNoodle: boolean;
  stock?: number | null;     // null=無制限, 0以下=売切, 正=残数
  weekdays?: number[] | null; // null=毎日, [0-6]=特定曜日のみ
}

export interface Order {
  id: string;
  time: string;
  slotLabel: string;
  items: { name: string; qty: number; price: number; optionNames?: string[] }[];
  total: number;
  status: 'pending' | 'ready';
}

export interface SlotInfo {
  label: string;
  emoji: string;
  sh: [number, number];
  eh: [number, number];
}

export interface AppStatus {
  status: 'open' | 'waiting' | 'closed' | 'paused' | 'holiday';
  slot?: Slot;
  slotInfo?: SlotInfo;
  minutesUntil?: number;
}

export interface RecentTicket {
  url: string;
  orderNumber: string;
  time: string;
}

export interface OrderData {
  orderNumber: string;
  slotLabel: string;
  lineItems: { name: string; qty: number; unitAmount: number; optionNames?: string[] }[];
  total: number;
  time: string;
  sessionId: string;
}

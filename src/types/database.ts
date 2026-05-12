export type OrderItem = { name: string; qty: number; price: number; optionNames?: string[]; menuId?: number };

export interface Database {
  public: {
    Tables: {
      menu: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          price: number;
          kcal: number | null;
          category: string;
          slot: 'breakfast' | 'lunch' | 'dinner';
          emoji: string | null;
          image_url: string | null;
          enabled: boolean;
          sold_out: boolean;
          is_noodle: boolean;
          stock: number | null;
          weekdays: number[] | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          name: string;
          description?: string | null;
          price: number;
          kcal?: number | null;
          category: string;
          slot: 'breakfast' | 'lunch' | 'dinner';
          emoji?: string | null;
          image_url?: string | null;
          enabled?: boolean;
          sold_out?: boolean;
          is_noodle?: boolean;
          stock?: number | null;
          weekdays?: number[] | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          price?: number;
          kcal?: number | null;
          category?: string;
          slot?: 'breakfast' | 'lunch' | 'dinner';
          emoji?: string | null;
          image_url?: string | null;
          enabled?: boolean;
          sold_out?: boolean;
          is_noodle?: boolean;
          stock?: number | null;
          weekdays?: number[] | null;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          created_at: string;
          slot_label: string;
          items: OrderItem[];
          total: number;
          status: 'pending' | 'ready' | 'completed';
          stripe_session_id: string | null;
        };
        Insert: {
          id: string;
          slot_label: string;
          items: OrderItem[];
          total: number;
          status?: 'pending' | 'ready' | 'completed';
          stripe_session_id?: string | null;
        };
        Update: {
          slot_label?: string;
          items?: OrderItem[];
          total?: number;
          status?: 'pending' | 'ready' | 'completed';
          stripe_session_id?: string | null;
        };
        Relationships: [];
      };
      options: {
        Row: {
          id: string;
          name: string;
          price: number;
          applies_to: string;
          weekdays: number[] | null;
          slots: ('breakfast' | 'lunch' | 'dinner')[] | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          price: number;
          applies_to: string;
          weekdays?: number[] | null;
          slots?: ('breakfast' | 'lunch' | 'dinner')[] | null;
        };
        Update: {
          name?: string;
          price?: number;
          applies_to?: string;
          weekdays?: number[] | null;
          slots?: ('breakfast' | 'lunch' | 'dinner')[] | null;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: unknown;
          updated_at: string;
        };
        Insert: { key: string; value: unknown };
        Update: { value?: unknown };
        Relationships: [];
      };
      admins: {
        Row: {
          email: string;
          created_at: string;
        };
        Insert: { email: string };
        Update: { email?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      decrement_stock: {
        Args: { p_menu_id: number; p_qty: number };
        Returns: undefined;
      };
      reserve_stock: {
        Args: { p_menu_id: number; p_qty: number };
        Returns: boolean;
      };
      restore_stock: {
        Args: { p_menu_id: number; p_qty: number };
        Returns: undefined;
      };
    };
  };
}

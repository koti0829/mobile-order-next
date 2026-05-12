import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// service_roleキーはRLSをバイパスするので必ずサーバー側でのみ使用
export function getSupabaseServer() {
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

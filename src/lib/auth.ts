import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getSupabaseServer } from '@/lib/supabase-server';

function getEnvAdmins(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdmin(email: string): Promise<boolean> {
  const lower = email.toLowerCase();
  // ① 環境変数で固定管理者を判定（削除不可）
  if (getEnvAdmins().includes(lower)) return true;
  // ② DBの admins テーブルを判定（追加・削除可能）
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('admins')
      .select('email')
      .eq('email', lower)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return await isAdmin(user.email);
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// 環境変数で固定された管理者かどうかを判定（UIで「削除不可」表示用）
export function isEnvAdmin(email: string): boolean {
  return getEnvAdmins().includes(email.toLowerCase());
}

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions, isEnvAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase-server';
import { mapMenuRow, mapOrderRow, mapOptionRow } from '@/lib/db-mappers';
import { fetchSettings } from '@/lib/settings';
import AdminClient from './admin-client';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/api/auth/signin?callbackUrl=/admin');

  const supabase = getSupabaseServer();
  const [menuRes, deletedMenuRes, orderRes, optionRes, adminRes, settings] = await Promise.all([
    supabase.from('menu').select('*').is('deleted_at', null).order('id'),
    supabase.from('menu').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('options').select('*'),
    supabase.from('admins').select('*'),
    fetchSettings(),
  ]);

  const envAdmins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  return (
    <AdminClient
      currentEmail={session.user.email}
      isCurrentEnvAdmin={isEnvAdmin(session.user.email)}
      initialMenu={(menuRes.data ?? []).map(mapMenuRow)}
      initialDeletedMenu={(deletedMenuRes.data ?? []).map(mapMenuRow)}
      initialOrders={(orderRes.data ?? []).map(mapOrderRow)}
      initialOptions={(optionRes.data ?? []).map(mapOptionRow)}
      initialDbAdmins={(adminRes.data ?? []).map(r => r.email)}
      envAdmins={envAdmins}
      settings={settings}
    />
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readDatabaseRole } from '@/lib/auth/roles';
import { getDashboardForRole } from '@/lib/utils/rbac';
import { deletionDueAt } from '@/lib/account/deletion';
import { RestoreAccountPanel } from './RestoreAccountPanel';

export const metadata: Metadata = { title: 'Restore your account | Justicia' };

/**
 * Shown when an account that asked to be deleted signs in again during the 7-day window.
 * The proxy sends such sessions here until the owner restores the account or signs out.
 */
export default async function RestoreAccountPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = (await createServiceClient()) as unknown as SupabaseClient;
  const { data: profile } = await db
    .from('profiles')
    .select('account_status, deletion_requested_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.account_status !== 'pending_deletion' || !profile.deletion_requested_at) {
    redirect(getDashboardForRole((await readDatabaseRole(db, user.id)) ?? 'client'));
  }
  const dueAt = deletionDueAt(profile.deletion_requested_at).toISOString();
  return <RestoreAccountPanel email={user.email ?? ''} dueAt={dueAt} />;
}

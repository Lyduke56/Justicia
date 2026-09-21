import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'User' };
interface Props { params: Promise<{ userId: string }> }

/**
 * User Detail (Admin View)
 * TODO: Full user account info, role badge, verification_status, mfa_enabled
 * TODO: Actions: change role, suspend/unsuspend, delete, force logout (invalidate sessions)
 * TODO: Audit log entries for this user (from audit_log_entries)
 * TODO: Associated reports / support tickets
 */
export default async function AdminUserDetailPage({ params }: Props) {
  const { userId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">User Details</h1>
      <p className="text-xs text-muted-foreground font-mono">{userId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/users/[userId]/page.tsx</code>
      </div>
    </main>
  );
}

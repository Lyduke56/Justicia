import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin Accounts' };

/**
 * Admin Accounts — RBAC Role Management
 * TODO: List all admin users (user_accounts where role = 'admin')
 * TODO: Promote user to admin, demote admin to client
 * TODO: Assign admin permissions / sub-roles (super-admin, moderator, support)
 * TODO: Every role change must be logged to audit_log_entries
 */
export default function AdminAccountsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Admin Accounts</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/settings/admin-accounts/page.tsx</code>
        <br />TODO: Admin user list, promote/demote actions, audit log integration
      </div>
    </main>
  );
}

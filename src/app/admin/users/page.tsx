import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Users' };

/**
 * User Management
 * TODO: Paginated user list from user_accounts (all roles)
 * TODO: Search by email, filter by role / verification_status
 * TODO: Bulk actions: suspend, delete
 * TODO: Link to [userId] for detail / role management
 */
export default function AdminUsersPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/users/page.tsx</code>
        <br />TODO: User table, search/filter, bulk actions
      </div>
    </main>
  );
}

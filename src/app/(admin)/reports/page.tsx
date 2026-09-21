import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Reports' };

/**
 * Content & User Reports
 * TODO: Fetch all reports (from reports table), filter by status (open/resolved)
 * TODO: Filter by target_type (user, review, message)
 * TODO: Assign to admin, resolve with notes
 */
export default function AdminReportsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/reports/page.tsx</code>
        <br />TODO: Reports table, status filter, assign/resolve actions
      </div>
    </main>
  );
}

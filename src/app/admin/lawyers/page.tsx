import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Lawyers' };

/**
 * Admin Lawyer Management
 * TODO: All lawyers list with verification_status, rating, active cases
 * TODO: Link to verification-queue and individual [lawyerId] pages
 */
export default function AdminLawyersPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lawyers</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/lawyers/page.tsx</code>
        <br />TODO: Lawyer table, verification status filter, quick verify action
      </div>
    </main>
  );
}

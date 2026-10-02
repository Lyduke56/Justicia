import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Consultations' };

/**
 * Admin Consultations Overview
 * TODO: All consultations across all users (admin view of consultations table)
 * TODO: Filter by status, method, date range, lawyer
 * TODO: Manual status override (e.g. force-cancel a stuck consultation)
 */
export default function AdminConsultationsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">All Consultations</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/consultations/page.tsx</code>
      </div>
    </main>
  );
}

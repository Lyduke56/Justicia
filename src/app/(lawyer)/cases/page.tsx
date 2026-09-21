import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Cases' };

/**
 * Lawyer Cases List
 * TODO: Fetch cases where lawyer_id = current user
 * TODO: Create new case record (title, client, gr_number, status)
 * TODO: Filter by status
 */
export default function LawyerCasesPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Cases</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/cases/page.tsx</code>
        <br />TODO: Cases list, create new case, status filter
      </div>
    </main>
  );
}

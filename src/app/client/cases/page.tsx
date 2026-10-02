import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Cases' };

/**
 * Cases List
 * Shows legal cases the client has with their lawyer(s).
 * TODO: Fetch cases where client_id = current user
 * TODO: Show: title, gr_number (if any), assigned lawyer, status, version_tag
 * TODO: Filter by status (active, closed, etc.)
 * TODO: Link to [caseId] for full case details / document viewer
 */
export default function CasesPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Cases</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/cases/page.tsx</code>
        <br />TODO: Cases list, status filter, link to case detail
      </div>
    </main>
  );
}

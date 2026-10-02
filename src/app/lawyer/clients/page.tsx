import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Clients' };

/**
 * Client List
 * TODO: Fetch clients who have had consultations with this lawyer (consultations table, lawyer_id = current)
 * TODO: Show client name, last consultation date, case count, message button
 * TODO: Search / filter by name
 */
export default function LawyerClientsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Clients</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/clients/page.tsx</code>
        <br />TODO: Client list, search, last consultation, case count
      </div>
    </main>
  );
}

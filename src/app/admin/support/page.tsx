import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Support' };

/**
 * Support Tickets
 * TODO: Fetch support_tickets, filter by status/category, assign to admin
 */
export default function SupportPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Support Tickets</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/support/page.tsx</code>
        <br />TODO: Ticket list, status filter, assign to admin
      </div>
    </main>
  );
}

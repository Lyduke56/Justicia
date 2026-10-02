import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Support Ticket' };
interface Props { params: Promise<{ ticketId: string }> }

/**
 * Support Ticket Detail
 * TODO: View full ticket, conversation thread, assign admin, resolve
 */
export default async function TicketDetailPage({ params }: Props) {
  const { ticketId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Support Ticket</h1>
      <p className="text-xs text-muted-foreground font-mono">{ticketId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/support/[ticketId]/page.tsx</code>
      </div>
    </main>
  );
}

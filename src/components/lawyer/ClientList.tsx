/**
 * ClientList — Lawyer-facing component
 * Displays a list of the lawyer's clients with last interaction info.
 * TODO: Render client avatar, name, last consultation date, case count, message button
 * TODO: Search by name
 * TODO: Sort by last active, alphabetical
 */
interface ClientItem {
  clientId: string;
  name: string;
  lastConsultationDate: string;
  caseCount: number;
}

interface ClientListProps {
  clients: ClientItem[];
}

export function ClientList({ clients }: ClientListProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No clients yet. Clients will appear here after your first consultation.
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Client list">
      {clients.map((client) => (
        <li key={client.clientId} className="flex items-center gap-4 rounded-xl border p-4">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
            {client.name.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">{client.name}</p>
            <p className="text-xs text-muted-foreground">
              Last: {client.lastConsultationDate} · {client.caseCount} case{client.caseCount !== 1 ? 's' : ''}
            </p>
          </div>
          <a
            href={`/lawyer/clients/${client.clientId}`}
            className="text-xs rounded-lg border px-3 py-1.5 hover:bg-muted transition"
          >
            View
          </a>
        </li>
      ))}
    </ul>
  );
}

import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Client Profile' };
interface Props { params: Promise<{ clientId: string }> }

/**
 * Client Detail (Lawyer View)
 * TODO: Fetch client user_accounts (RLS: only if lawyer has a consultation with them)
 * TODO: Show: contact info, shared documents, case history together
 * TODO: "Send Message" CTA
 */
export default async function ClientDetailPage({ params }: Props) {
  const { clientId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Client</h1>
      <p className="text-xs text-muted-foreground font-mono">{clientId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/clients/[clientId]/page.tsx</code>
      </div>
    </main>
  );
}

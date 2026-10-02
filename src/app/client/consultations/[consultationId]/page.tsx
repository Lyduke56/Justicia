import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Consultation Details' };

interface Props { params: Promise<{ consultationId: string }> }

/**
 * Consultation Detail View
 * TODO: Fetch consultation by id, verify client_id = current user
 * TODO: Show: lawyer info, scheduled time, method, status, concern_summary
 * TODO: "Join Call" button (opens conferencing URL from /api/consultations)
 * TODO: Show payment receipt
 * TODO: Post-consultation: review form, download session notes
 */
export default async function ConsultationDetailPage({ params }: Props) {
  const { consultationId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Consultation Details</h1>
      <p className="text-xs text-muted-foreground font-mono">{consultationId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/consultations/[consultationId]/page.tsx</code>
        <br />TODO: Detail view, Join Call, payment receipt, post-consultation review
      </div>
    </main>
  );
}

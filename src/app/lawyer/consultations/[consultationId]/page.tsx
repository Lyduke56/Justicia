import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Consultation' };
interface Props { params: Promise<{ consultationId: string }> }

/**
 * Lawyer Consultation Detail
 * TODO: Fetch consultation (verify lawyer_id = current user via RLS)
 * TODO: Show: client name/concern, scheduled_time, method, status
 * TODO: Accept / Decline actions for pending status
 * TODO: Join conferencing session
 * TODO: Upload session notes / documents
 * TODO: Payment status indicator
 */
export default async function LawyerConsultationDetailPage({ params }: Props) {
  const { consultationId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Consultation</h1>
      <p className="text-xs text-muted-foreground font-mono">{consultationId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/consultations/[consultationId]/page.tsx</code>
      </div>
    </main>
  );
}

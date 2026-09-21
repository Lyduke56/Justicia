import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Lawyer' };
interface Props { params: Promise<{ lawyerId: string }> }

/**
 * Admin Lawyer Detail / Review
 * TODO: Full lawyer profile + credentials document viewer
 * TODO: Approve / Reject verification with notes
 * TODO: Suspend / unsuspend lawyer
 * TODO: View all consultations, reviews, reports against this lawyer
 * TODO: Audit log for this lawyer account
 */
export default async function AdminLawyerDetailPage({ params }: Props) {
  const { lawyerId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lawyer Review</h1>
      <p className="text-xs text-muted-foreground font-mono">{lawyerId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/lawyers/[lawyerId]/page.tsx</code>
      </div>
    </main>
  );
}

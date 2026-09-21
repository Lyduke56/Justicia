import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Verification Queue' };

/**
 * Lawyer Verification Queue
 * TODO: Fetch lawyer_profiles where verification_status = 'pending', ordered by created_at ASC
 * TODO: Each row shows: lawyer name, IBP number, submission date, documents submitted
 * TODO: Click to open [lawyerId] page with credential review
 * TODO: Quick: Approve / Reject with reason (updates verification_status + triggers email)
 * TODO: Render <VerificationQueueRow /> component
 */
export default function VerificationQueuePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Verification Queue</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/lawyers/verification-queue/page.tsx</code>
        <br />TODO: Pending lawyer list, approve/reject with reason, VerificationQueueRow component
      </div>
    </main>
  );
}

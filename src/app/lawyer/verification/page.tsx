import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Lawyer Verification' };

/**
 * Lawyer Verification — Credential Submission & Status
 * Lawyers must submit credentials for admin review before serving clients.
 * TODO: Show current verification_status (pending / verified / rejected)
 * TODO: Upload form: IBP number, PRC ID, Bar roll number, certificates
 *   → uploads to Supabase Storage "documents" bucket
 *   → updates lawyer_profiles.credentials jsonb
 * TODO: Show rejection reason if status = 'rejected'
 * TODO: Show estimated review timeline
 * TODO: Admin approval triggers email notification (via /api/notifications)
 */
export default function VerificationPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Verification</h1>
      <p className="text-muted-foreground text-sm">Submit your credentials to become a verified Justicia lawyer.</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/verification/page.tsx</code>
        <br />TODO: Status badge, credential upload form (IBP #, PRC ID, bar roll, certs), rejection notes
      </div>
    </main>
  );
}

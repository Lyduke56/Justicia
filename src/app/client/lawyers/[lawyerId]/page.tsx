import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Lawyer Profile' };

interface Props {
  params: Promise<{ lawyerId: string }>;
}

/**
 * Lawyer Profile & Consultation Booking
 * Shows a verified lawyer's full profile and allows the client to book a consultation.
 * TODO: Fetch lawyer_profiles + user_accounts by lawyerId
 * TODO: Show: bio, practice areas, credentials, languages, location, hourly rate, reviews
 * TODO: Availability calendar (from availability_schedule jsonb)
 * TODO: Booking flow:
 *   1. Select date/time slot
 *   2. Choose method (video/audio)
 *   3. Describe concern
 *   4. Payment (via /api/payments)
 *   5. Consultation confirmed → row created in consultations table
 * TODO: Show reviews (reviews table, lawyer_id = this lawyer)
 * TODO: "Report" button → modal → POST /api/moderation
 */
export default async function LawyerProfilePage({ params }: Props) {
  const { lawyerId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lawyer Profile</h1>
      <p className="text-xs text-muted-foreground font-mono">{lawyerId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/lawyers/[lawyerId]/page.tsx</code>
        <br />TODO: Profile display, availability calendar, booking flow (date → method → concern → payment → confirm), reviews
      </div>
    </main>
  );
}

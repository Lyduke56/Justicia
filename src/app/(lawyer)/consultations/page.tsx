import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Consultations' };

/**
 * Lawyer Consultations — Requests, Upcoming, Completed
 * TODO: Tabs: Requests (pending) | Upcoming (confirmed) | Past | Declined
 * TODO: Accept / Decline pending requests (PATCH /api/consultations)
 * TODO: "Join" button for confirmed consultations near scheduled_time
 * TODO: Access session notes / documents per consultation
 * TODO: Mark as completed, add case notes
 */
export default function LawyerConsultationsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Consultations</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/consultations/page.tsx</code>
        <br />TODO: Tabs (Requests/Upcoming/Past), Accept/Decline actions, Join button, case notes
      </div>
    </main>
  );
}

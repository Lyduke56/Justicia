import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Consultations' };

/**
 * Consultations List
 * Shows the client's upcoming and past consultations.
 * TODO: Fetch consultations where client_id = current user, order by scheduled_time DESC
 * TODO: Tabs: Upcoming | Past | Cancelled
 * TODO: Each row shows: lawyer name, scheduled_time, method (video/audio), status badge
 * TODO: "Join" button for confirmed consultations within 15 min of scheduled_time
 * TODO: "Cancel" button for pending/confirmed (with cancellation policy)
 * TODO: "Leave a Review" CTA for completed consultations not yet reviewed
 */
export default function ConsultationsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Consultations</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/consultations/page.tsx</code>
        <br />TODO: Tabs (Upcoming/Past/Cancelled), consultation cards, Join/Cancel/Review actions
      </div>
    </main>
  );
}

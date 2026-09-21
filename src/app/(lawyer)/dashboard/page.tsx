import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Lawyer Dashboard' };

/**
 * Lawyer Dashboard
 * Overview of consultations, active cases, pending requests, and earnings.
 * TODO: Fetch: pending consultation requests, today's schedule, active case count
 * TODO: Stat tiles: pending requests, confirmed today, total clients, avg rating
 * TODO: Recent activity feed
 * TODO: Quick-action: Set availability, View messages
 * TODO: Show verification status alert if not yet verified
 */
export default function LawyerDashboardPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Lawyer Dashboard</h1>
      <p className="text-muted-foreground text-sm">Your consultations, cases, and client activity at a glance.</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/dashboard/page.tsx</code>
        <br />TODO: Stat tiles (pending requests, today's schedule, avg rating), activity feed, quick actions
      </div>
    </main>
  );
}

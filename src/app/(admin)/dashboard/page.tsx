import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin Dashboard' };

/**
 * Admin Dashboard — Platform Stats Overview
 * TODO: StatTile grid: total users, active lawyers, pending verifications, open reports,
 *       consultations today, total revenue (this month)
 * TODO: Charts: daily active users, consultations per day (last 30d), revenue trend
 * TODO: Recent activity feed: new lawyer registrations, new reports, support tickets
 * TODO: Quick actions: Go to verification queue, Open reports, New announcement
 */
export default function AdminDashboardPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Platform Overview</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/dashboard/page.tsx</code>
        <br />TODO: StatTiles (users, lawyers, verifications pending, reports), charts, activity feed
      </div>
    </main>
  );
}

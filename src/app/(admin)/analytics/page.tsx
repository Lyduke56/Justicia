import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Analytics' };

/**
 * Platform Analytics
 * TODO: Charts: DAU/MAU, consultations per day, revenue per month, AI query volume
 * TODO: Lawyer performance metrics: avg rating, consultation completion rate
 * TODO: Top legal topics queried to the AI assistant
 * TODO: Funnel: registrations → first consultation → repeat
 * TODO: Export as CSV
 */
export default function AnalyticsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/analytics/page.tsx</code>
        <br />TODO: DAU/MAU charts, revenue, AI query volume, funnel analysis, CSV export
      </div>
    </main>
  );
}

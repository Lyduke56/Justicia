import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Availability' };

/**
 * Availability — Schedule, Blocked Dates & Buffer Time
 * TODO: Weekly schedule grid (Mon–Sun, time slots) stored in availability_schedule jsonb
 * TODO: Block individual dates / date ranges
 * TODO: Set buffer time between consultations (e.g. 15 min)
 * TODO: Set max consultations per day
 * TODO: Show upcoming auto-confirmed consultation slots
 * TODO: Render <AvailabilityCalendar /> component
 */
export default function AvailabilityPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Availability</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/availability/page.tsx</code>
        <br />TODO: Weekly schedule grid, blocked dates, buffer time, AvailabilityCalendar component
      </div>
    </main>
  );
}

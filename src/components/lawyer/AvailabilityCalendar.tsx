/**
 * AvailabilityCalendar — Lawyer-facing component
 * Weekly schedule editor for lawyers to set their availability.
 * TODO: Implement week grid (Mon–Sun × time slots)
 * TODO: Click/drag to toggle time slot availability
 * TODO: Block individual dates (date picker)
 * TODO: Set buffer time (select: 0/15/30/60 min)
 * TODO: Save changes → update lawyer_profiles.availability_schedule jsonb
 * TODO: Read-only view for client booking flow
 */
export function AvailabilityCalendar() {
  return (
    <div
      className="rounded-2xl border p-6 text-sm text-muted-foreground text-center"
      aria-label="Availability calendar"
    >
      🗓️ <strong>AvailabilityCalendar</strong> — <code>src/components/lawyer/AvailabilityCalendar.tsx</code>
      <br />
      TODO: Weekly grid editor, block dates, buffer time, save to lawyer_profiles
    </div>
  );
}

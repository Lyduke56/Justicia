import { redirect } from 'next/navigation';

/**
 * Availability now lives on the lawyer's own profile (Lawyer Profile → Availability tab):
 * the booking calendar plus "Set Unavailability" and the list of blocked dates/times.
 */
export default function AvailabilityPage() {
  redirect('/lawyer/profile?tab=availability');
}

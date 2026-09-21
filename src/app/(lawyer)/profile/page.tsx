import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Lawyer Profile Editor' };

/**
 * Professional Profile Editor + Preview
 * TODO: Edit lawyer_profiles row: bio, practice_areas, languages, location, hourly_rate, consultation_fees
 * TODO: Upload professional photo → Supabase Storage
 * TODO: Real-time preview of public profile
 * TODO: Validation: at least one practice area, valid hourly_rate
 */
export default function LawyerProfilePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/profile/page.tsx</code>
        <br />TODO: Profile editor (bio, practice areas, languages, fees, photo), live preview
      </div>
    </main>
  );
}

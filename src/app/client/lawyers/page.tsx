import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Find a Lawyer' };

/**
 * Lawyer Discovery Page
 * Search and filter verified Philippine lawyers by practice area, location, language, fee range, and rating.
 * TODO: Fetch from lawyer_profiles JOIN user_accounts where verification_status = 'verified'
 * TODO: Implement search (name, practice area)
 * TODO: Filters: practice area, location, languages, hourly_rate range, rating ≥ N
 * TODO: Sorting: rating, consultation fee, availability (soonest available)
 * TODO: Render <LawyerCard /> grid
 * TODO: Pagination / infinite scroll
 */
export default function LawyerDiscoveryPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Find a Lawyer</h1>
      <p className="text-muted-foreground text-sm">Browse verified Philippine lawyers by practice area and availability.</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/lawyers/page.tsx</code>
        <br />TODO: Search bar, filters (practice area, location, language, fee, rating), LawyerCard grid
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Reviews' };

/**
 * Lawyer Reviews
 * TODO: Fetch reviews where lawyer_id = current user (from reviews table)
 * TODO: Show: rating distribution, avg rating, individual reviews with client names, dates, comments
 * TODO: Flag inappropriate review button → POST /api/moderation
 * TODO: Respond to review (optional feature)
 */
export default function ReviewsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Reviews</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/reviews/page.tsx</code>
        <br />TODO: Rating distribution, review list, flag action
      </div>
    </main>
  );
}

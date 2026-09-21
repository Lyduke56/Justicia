import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Messages' };

/**
 * Lawyer Messages Inbox
 * TODO: Same as client messages but from lawyer perspective
 * TODO: Show client threads, unread badges, real-time updates
 */
export default function LawyerMessagesPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/messages/page.tsx</code>
      </div>
    </main>
  );
}

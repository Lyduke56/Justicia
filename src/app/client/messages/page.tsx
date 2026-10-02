import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Messages' };

/**
 * Messages — Inbox / Thread List
 * Secure messaging between clients and their lawyers.
 * TODO: Fetch message threads (from messages table, grouped by conversation_or_thread_id)
 *       where current user is sender or recipient
 * TODO: Show thread list: other party name, last message preview, timestamp, unread count
 * TODO: Clicking a thread → /messages/[threadId]
 * TODO: Real-time updates via Supabase realtime channel subscription
 */
export default function MessagesPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/messages/page.tsx</code>
        <br />TODO: Thread list, unread badges, real-time updates
      </div>
    </main>
  );
}

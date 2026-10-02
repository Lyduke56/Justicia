import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Message Thread' };

interface Props { params: Promise<{ threadId: string }> }

/**
 * Message Thread View
 * TODO: Fetch messages where conversation_or_thread_id = threadId
 * TODO: Real-time message subscription via Supabase channel
 * TODO: Send message (insert into messages table)
 * TODO: File attachment support (upload → Supabase Storage → include attachment_ids)
 * TODO: Message read receipts
 */
export default async function MessageThreadPage({ params }: Props) {
  const { threadId } = await params;
  return (
    <main className="flex flex-col h-screen p-6 space-y-4">
      <h1 className="text-xl font-semibold">Message Thread</h1>
      <p className="text-xs text-muted-foreground font-mono">{threadId}</p>
      <div className="flex-1 rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/messages/[threadId]/page.tsx</code>
        <br />TODO: Message list, real-time subscription, send message, file attachments
      </div>
      <div className="border rounded-xl p-3 text-sm text-muted-foreground">TODO: Message input</div>
    </main>
  );
}

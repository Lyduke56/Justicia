import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AI Legal Chat' };

interface Props {
  params: Promise<{ conversationId: string }>;
}

/**
 * AI Legal Assistant — Chat Screen
 *
 * The primary conversational UI for a single AI conversation thread.
 * Messages are sent to /api/ai/assistant which runs the RAG pipeline.
 *
 * TODO: Load conversation history from messages table
 * TODO: Real-time message streaming (SSE or websocket from /api/ai/assistant)
 * TODO: Show citation chips (CitationChip component) for each source used
 * TODO: Always render DisclaimerBanner at top of chat
 * TODO: If response.escalate === true, show "Connect with a Lawyer" CTA
 * TODO: Support file attachments (upload to Supabase Storage)
 * TODO: Add typing indicator animation during AI response
 */
export default async function AIConversationPage({ params }: Props) {
  const { conversationId } = await params;

  return (
    <main className="flex flex-col h-screen p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Legal Consultation Chat</h1>
        <span className="text-xs text-muted-foreground font-mono">{conversationId}</span>
      </div>

      {/* TODO: <DisclaimerBanner /> */}
      <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
        ⚠️ <strong>Disclaimer:</strong> AI responses are for informational purposes only and do not constitute legal advice. Consult a licensed attorney for your specific situation.
      </div>

      <div className="flex-1 rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <strong>Scaffold placeholder</strong> — <code>src/app/(client)/ai-assistant/[conversationId]/page.tsx</code>
        <br />
        TODO: Chat messages (RAG flow), citation chips, escalation CTA, file upload
      </div>

      {/* TODO: Message input with send button */}
      <div className="border rounded-xl p-3 text-sm text-muted-foreground">
        TODO: Message input area
      </div>
    </main>
  );
}

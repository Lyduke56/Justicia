import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AI Legal Assistant' };

/**
 * AI Legal Assistant — Conversation List / New Chat
 *
 * Shows all past AI conversations and allows starting a new one.
 * Each conversation follows the RAG flow:
 *   classify issue → clarifying questions → retrieve legal sources → generate response + citations → disclaimer → escalate?
 *
 * TODO: Fetch conversations list from Supabase (conversations table, user_id = current user)
 * TODO: Show conversation title, last message preview, timestamp
 * TODO: "New conversation" button → creates a row in conversations → navigates to /ai-assistant/[conversationId]
 * TODO: Add search/filter for past conversations
 * TODO: Show escalation badge if conversation was flagged for lawyer referral
 */
export default function AIAssistantPage() {
  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Legal Assistant</h1>
        <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium" type="button">
          + New Chat
        </button>
      </div>
      <p className="text-muted-foreground text-sm">
        Ask any Philippine legal question. Our AI will guide you with relevant laws and jurisprudence.
      </p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <strong>Scaffold placeholder</strong> — <code>src/app/(client)/ai-assistant/page.tsx</code>
        <br />
        TODO: Conversation list from Supabase, new conversation flow
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'AI Management' };

/**
 * AI Behavior Settings & Response Review
 * TODO: Configure RAG pipeline parameters: top-K, similarity threshold, max tokens
 * TODO: System prompt editor for the AI Legal Assistant
 * TODO: Review sampled AI responses (approve/flag for correction)
 * TODO: Disclaimer text editor
 * TODO: Escalation threshold settings (when escalate = true)
 * TODO: Toggle AI assistant availability (emergency off-switch)
 */
export default function AIManagementPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">AI Management</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/ai-management/page.tsx</code>
        <br />TODO: RAG params, system prompt editor, response review, disclaimer editor, escalation threshold, AI on/off switch
      </div>
    </main>
  );
}

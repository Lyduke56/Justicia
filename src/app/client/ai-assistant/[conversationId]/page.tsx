import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AI Legal Chat' };

/**
 * Thin page wrapper — the chat is rendered by <ClientShell> view = 'ai-assistant', which reads
 * the conversation id from this URL and opens that saved conversation.
 * Exists for metadata + hard-refresh URL resolution only.
 */
export default function AIConversationPage() {
  return null;
}

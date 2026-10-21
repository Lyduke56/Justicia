import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Legal Assistant',
  description: 'Ask legal questions and get AI-powered guidance grounded in Philippine law.',
};

/**
 * Thin page wrapper — actual UI is rendered by <ClientShell> view = 'ai-assistant'.
 * Exists for metadata + hard-refresh URL resolution only.
 */
export default function AIAssistantPage() {
  return null;
}

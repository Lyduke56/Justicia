import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { AIAssistantChat } from '@/components/client/AIAssistantChat';

export const metadata: Metadata = {
  title: 'AI Legal Assistant',
};

/**
 * AI Legal Assistant Page
 * Matches Figma design (media_1792247442877.png)
 * Centered greeting, pill question input with attachments, Philippine legal RAG flow.
 */
export default async function AIAssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName =
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split('@')[0] ||
    'Client';

  if (user) {
    try {
      const { data: profile } = await supabase
        .from('user_accounts')
        .select('full_name')
        .eq('id', user.id)
        .single() as { data: { full_name: string | null } | null };

      if (profile?.full_name) {
        displayName = profile.full_name;
      }
    } catch {
      // Fallback
    }
  }

  const firstName = displayName.trim().split(' ')[0] || displayName;

  return <AIAssistantChat userFirstName={firstName} />;
}

import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ClientProfileView } from '@/components/client/ClientProfileView';

export const metadata: Metadata = { title: 'My Profile | Justicia Client' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName =
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split('@')[0] ||
    'Juan Dela Cruz';

  let email = user?.email || 'juan.delacruz@example.com';

  if (user) {
    try {
      const { data: profile } = await supabase
        .from('user_accounts')
        .select('full_name, email')
        .eq('id', user.id)
        .single() as { data: { full_name: string | null; email: string | null } | null };

      if (profile?.full_name) {
        fullName = profile.full_name;
      }
      if (profile?.email) {
        email = profile.email;
      }
    } catch {
      // Fallback
    }
  }

  return (
    <ClientProfileView
      initialData={{
        fullName,
        email,
      }}
    />
  );
}


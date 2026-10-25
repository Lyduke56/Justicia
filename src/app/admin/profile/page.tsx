import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { AdminProfileView } from '@/components/admin/AdminProfileView';

export const metadata: Metadata = {
  title: 'Administrator Profile | Justicia Admin',
  description: 'Manage administrator officer credentials and security keys.',
};

export default async function AdminProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = (user?.user_metadata?.full_name as string) || 'Atty. Rafael Mendoza';
  let email = user?.email || 'admin.mendoza@justicia.ph';

  if (user) {
    try {
      const { data: profile } = await supabase
        .from('user_accounts')
        .select('full_name, email')
        .eq('id', user.id)
        .single() as { data: { full_name: string | null; email: string | null } | null };

      if (profile?.full_name) fullName = profile.full_name;
      if (profile?.email) email = profile.email;
    } catch {
      // Fallback
    }
  }

  return (
    <AdminProfileView
      initialData={{
        fullName,
        email,
      }}
    />
  );
}

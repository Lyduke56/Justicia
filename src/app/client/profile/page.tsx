import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { UserCircleIcon } from '@/components/client/ClientIcons';

export const metadata: Metadata = { title: 'My Profile' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName =
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
        fullName = profile.full_name;
      }
    } catch {
      // Fallback
    }
  }

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F]">
          Client <span className="text-[#C58B3C]">Profile</span>
        </h1>
        <p className="text-sm text-[#7D6855] mt-1">
          Personal identification and contact details for consultation records.
        </p>
      </div>

      <div className="rounded-3xl p-8 bg-[#EFE5D8] shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full border-2 border-[#5C4535]/80 flex items-center justify-center text-[#5C4535] bg-[#EAE0D2]">
            <UserCircleIcon className="w-10 h-10" />
          </div>
          <div>
            <h2 className="font-cormorant font-bold text-xl text-[#34150F]">{fullName}</h2>
            <p className="text-xs text-[#7D6855]">{user?.email}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-[#E5D7C5] text-[#34150F] text-[10px] font-semibold">
              Verified Client Account
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E5D7C5] text-xs">
          <div className="p-3 rounded-xl bg-[#E8DAC9]/50">
            <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Full Legal Name</span>
            <span className="font-medium text-[#34150F] mt-1 block">{fullName}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#E8DAC9]/50">
            <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Email Address</span>
            <span className="font-medium text-[#34150F] mt-1 block">{user?.email}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#E8DAC9]/50">
            <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Account Role</span>
            <span className="font-medium text-[#34150F] mt-1 block">Client</span>
          </div>
          <div className="p-3 rounded-xl bg-[#E8DAC9]/50">
            <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Jurisdiction</span>
            <span className="font-medium text-[#34150F] mt-1 block">Republic of the Philippines</span>
          </div>
        </div>
      </div>
    </div>
  );
}

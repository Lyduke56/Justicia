import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { DashboardCalendar } from '@/components/client/DashboardCalendar';
import { DashboardSearchInput } from '@/components/client/DashboardSearchInput';
import { LawyerGridSection } from '@/components/client/LawyerGridSection';
import type { LawyerItem } from '@/components/client/LawyerCard';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const DEFAULT_RECOMMENDED_LAWYERS: LawyerItem[] = [
  {
    id: 'lawyer-1',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-2',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-3',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-4',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-5',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-6',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-7',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-8',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-9',
    name: 'Atty. Maria Elena Santos, LL.B.',
    rollNumber: '58942',
    chapter: 'MAKATI',
    specializations: ['Labor & Employment', 'Corporate', 'Civil Law'],
    isVerified: true,
  },
  {
    id: 'lawyer-10',
    name: 'Atty. Juan Carlos Reyes, LL.M.',
    rollNumber: '61204',
    chapter: 'QUEZON CITY',
    specializations: ['Family Law', 'Criminal Defense', 'Litigation'],
    isVerified: true,
  },
  {
    id: 'lawyer-11',
    name: 'Atty. Patricia Ann Lim, J.D.',
    rollNumber: '64910',
    chapter: 'MANILA',
    specializations: ['Intellectual Property', 'Tech & Privacy', 'Commercial'],
    isVerified: true,
  },
  {
    id: 'lawyer-12',
    name: 'Atty. Rafael Vicente Cruz, LL.B.',
    rollNumber: '53188',
    chapter: 'CEBU',
    specializations: ['Real Estate', 'Agrarian Reform', 'Estate Planning'],
    isVerified: true,
  },
];

export default async function ClientDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve user display name
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

  // Extract first name for the personal greeting e.g. "Clyde"
  const firstName = displayName.trim().split(' ')[0] || displayName;

  // Attempt to load live lawyers from Supabase if populated
  const lawyers: LawyerItem[] = DEFAULT_RECOMMENDED_LAWYERS;
  try {
    const { data: dbLawyers } = await supabase
      .from('lawyer_profiles')
      .select('lawyer_id, practice_areas, hourly_rate')
      .limit(9);

    if (dbLawyers && dbLawyers.length > 0) {
      // We can map live profiles if they exist, or augment default data
    }
  } catch {
    // Keep fallback list
  }

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-10">
      {/* ─── Top Split Section: Greeting + Search Input & Calendar Card ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Greeting & Legal Question Search */}
        <div className="lg:col-span-7 space-y-6">
          <h1 className="font-cormorant text-4xl sm:text-5xl lg:text-[52px] font-medium text-[#34150F] tracking-tight leading-[1.1]">
            Let&apos;s make it make sense,{' '}
            <span className="text-[#C58B3C] font-semibold">{firstName}.</span>
          </h1>

          <div className="max-w-xl">
            <DashboardSearchInput />
          </div>
        </div>

        {/* Right Column: Calendar Widget */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <DashboardCalendar />
        </div>
      </div>

      {/* ─── Middle & Bottom Section: Recommended Lawyers ──────────────────── */}
      <div className="pt-2">
        <LawyerGridSection initialLawyers={lawyers} />
      </div>
    </div>
  );
}

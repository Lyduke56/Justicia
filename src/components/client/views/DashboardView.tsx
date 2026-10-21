'use client';

import React, { useEffect, useState } from 'react';
import { DashboardCalendar } from '@/components/client/DashboardCalendar';
import { DashboardSearchInput } from '@/components/client/DashboardSearchInput';
import { LawyerGridSection } from '@/components/client/LawyerGridSection';
import type { LawyerItem } from '@/components/client/LawyerCard';
import { createClient } from '@/lib/supabase/client';

const FALLBACK_LAWYERS: LawyerItem[] = [
  { id: 'lawyer-1', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-2', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-3', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-4', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-5', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-6', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-7', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-8', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-9', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-10', name: 'Atty. Juan Carlos Reyes, LL.M.', rollNumber: '61204', chapter: 'QUEZON CITY', specializations: ['Family Law', 'Criminal Defense', 'Litigation'], isVerified: true },
  { id: 'lawyer-11', name: 'Atty. Patricia Ann Lim, J.D.', rollNumber: '64910', chapter: 'MANILA', specializations: ['Intellectual Property', 'Tech & Privacy', 'Commercial'], isVerified: true },
  { id: 'lawyer-12', name: 'Atty. Rafael Vicente Cruz, LL.B.', rollNumber: '53188', chapter: 'CEBU', specializations: ['Real Estate', 'Agrarian Reform', 'Estate Planning'], isVerified: true },
];

interface DashboardViewProps {
  firstName: string;
}

export function DashboardView({ firstName }: DashboardViewProps) {
  const [lawyers, setLawyers] = useState<LawyerItem[]>(FALLBACK_LAWYERS);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('lawyer_profiles')
      .select('lawyer_id, practice_areas, hourly_rate')
      .limit(9)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Live data available but mapping kept simple for now
        }
      });
  }, []);

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

      {/* ─── Recommended Lawyers ─────────────────────────────────────────────── */}
      <div className="pt-2">
        <LawyerGridSection initialLawyers={lawyers} />
      </div>
    </div>
  );
}

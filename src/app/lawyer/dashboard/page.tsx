import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  CalendarBookingIcon,
  UserGroupIcon,
  ScaleIcon,
  StarIcon,
  ClockIcon,
  MessagesIcon,
  ShieldCheckIcon,
} from '@/components/client/ClientIcons';

export const metadata: Metadata = {
  title: 'Lawyer Dashboard',
};

export default async function LawyerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = (user?.user_metadata?.full_name as string) || 'Attorney';
  let rollNumber = '';
  let ibpChapter = '';
  let hourlyRate: number | null = 2500;
  let practiceAreas: string[] = ['Family Law', 'Civil Litigation', 'Corporate'];
  let isApproved = true;

  if (user) {
    try {
      const { data: prof } = await supabase
        .from('lawyer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single() as { data: { full_name: string | null; roll_number: string | null; ibp_chapter: string | null; fee_standard_60min: number | null; practice_areas: string[] | null; verification_status: string | null } | null };

      if (prof) {
        if (prof.full_name) fullName = prof.full_name;
        if (prof.roll_number) rollNumber = prof.roll_number;
        if (prof.ibp_chapter) ibpChapter = prof.ibp_chapter;
        if (prof.fee_standard_60min) hourlyRate = prof.fee_standard_60min;
        if (prof.practice_areas) practiceAreas = prof.practice_areas;
        isApproved = prof.verification_status === 'approved';
      }
    } catch {
      // Fallback
    }
  }

  // Fetch consultations for this lawyer
  let consultationsCount = 0;
  if (user) {
    const { count } = await supabase
      .from('consultations')
      .select('id', { count: 'exact', head: true })
      .eq('lawyer_id', user.id);
    consultationsCount = count || 0;
  }

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-10">
      {/* ─── Top Greeting Section ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#C58B3C] uppercase">
              Counsel Practice Portal
            </span>
            {isApproved && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600/15 text-emerald-800 border border-emerald-600/30">
                <ShieldCheckIcon className="w-3 h-3 text-emerald-700" />
                Verified Counsel
              </span>
            )}
          </div>
          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Welcome back, <span className="text-[#C58B3C] font-semibold">{fullName}.</span>
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5">
            {rollNumber ? `Roll No. ${rollNumber}` : 'Integrated Bar of the Philippines'}
            {ibpChapter ? ` • IBP Chapter: ${ibpChapter}` : ''}
          </p>
        </div>

        <Link
          href="/lawyer/availability"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#C58B3C] text-[#23150F] font-semibold text-xs tracking-wide shadow-[4px_4px_10px_rgba(0,0,0,0.1),-3px_-3px_10px_rgba(255,255,255,0.8)] hover:bg-[#B37B2F] transition-all shrink-0 self-start md:self-auto"
        >
          <ClockIcon className="w-4 h-4" />
          <span>Set Availability & Rates</span>
        </Link>
      </div>

      {/* ─── 4 KPI Stat Tiles (Neumorphic) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Tile 1: Consultations */}
        <Link
          href="/lawyer/consultations"
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 transition-all hover:scale-[1.01]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7D6855] uppercase tracking-wider">
              Consultations
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#C58B3C]/15 text-[#C58B3C] flex items-center justify-center">
              <CalendarBookingIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-cormorant text-3xl font-bold text-[#34150F]">
              {consultationsCount}
            </span>
            <span className="text-[11px] font-medium text-emerald-700">Scheduled</span>
          </div>
          <p className="text-[11px] text-[#A69584] mt-1">Video and audio client sessions</p>
        </Link>

        {/* Tile 2: Active Clients */}
        <Link
          href="/lawyer/clients"
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 transition-all hover:scale-[1.01]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7D6855] uppercase tracking-wider">
              Retained Clients
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#23150F]/10 text-[#34150F] flex items-center justify-center">
              <UserGroupIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-cormorant text-3xl font-bold text-[#34150F]">
              {consultationsCount > 0 ? consultationsCount : 3}
            </span>
            <span className="text-[11px] font-medium text-[#7D6855]">Active Cases</span>
          </div>
          <p className="text-[11px] text-[#A69584] mt-1">Clients under active representation</p>
        </Link>

        {/* Tile 3: Standard Hourly Rate */}
        <Link
          href="/lawyer/availability"
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 transition-all hover:scale-[1.01]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7D6855] uppercase tracking-wider">
              Session Rate
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#23150F]/10 text-[#34150F] flex items-center justify-center">
              <ClockIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-cormorant text-3xl font-bold text-[#34150F]">
              ₱{hourlyRate?.toLocaleString() ?? '2,500'}
            </span>
            <span className="text-[11px] font-medium text-[#7D6855]">/ 60 min</span>
          </div>
          <p className="text-[11px] text-[#A69584] mt-1">Standard consultation fee</p>
        </Link>

        {/* Tile 4: Client Rating */}
        <Link
          href="/lawyer/reviews"
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 transition-all hover:scale-[1.01]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7D6855] uppercase tracking-wider">
              Client Rating
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
              <StarIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-cormorant text-3xl font-bold text-amber-800">
              5.0 ★
            </span>
            <span className="text-[11px] font-medium text-emerald-700">100% Verified</span>
          </div>
          <p className="text-[11px] text-[#A69584] mt-1">Post-consultation evaluations</p>
        </Link>
      </div>

      {/* ─── Two-Column Main Content Section ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols): Upcoming Consultations & Calendar */}
        <div className="lg:col-span-7 space-y-6">
          <div
            className="p-6 sm:p-7 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E8DCCB]">
              <div>
                <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">
                  Upcoming Consultations
                </h2>
                <p className="text-xs text-[#7D6855] mt-0.5">
                  Booked client sessions and video consultations
                </p>
              </div>

              <Link
                href="/lawyer/consultations"
                className="text-xs font-semibold text-[#C58B3C] hover:text-[#9A6A27] transition-colors"
              >
                Calendar →
              </Link>
            </div>

            <div className="pt-4 divide-y divide-[#E8DCCB]/60 space-y-3">
              {/* Sample booked session */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#C58B3C]/15 text-[#C58B3C] font-bold text-xs flex items-center justify-center shrink-0">
                    📹
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#34150F]">Clyde (Client)</p>
                    <p className="text-[11px] text-[#7D6855]">
                      Corporate contract review & employment advisory
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-[#C58B3C] uppercase tracking-wider">
                      Tomorrow • 2:00 PM – 3:00 PM (60 min)
                    </span>
                  </div>
                </div>

                <Link
                  href="/lawyer/consultations"
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#23150F] text-[#ded7cb] hover:bg-[#C58B3C] hover:text-[#23150F] transition-all text-center shrink-0"
                >
                  Join Meeting
                </Link>
              </div>
            </div>
          </div>

          {/* Active Cases Overview */}
          <div
            className="p-6 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DCCB]">
              <h3 className="font-cormorant text-xl font-bold text-[#34150F]">
                Active Client Matters
              </h3>
              <Link
                href="/lawyer/cases"
                className="text-xs font-semibold text-[#C58B3C] hover:text-[#9A6A27]"
              >
                All Cases →
              </Link>
            </div>
            <div className="pt-3 space-y-2.5 text-xs text-[#5C4535]">
              <div className="p-3 rounded-2xl bg-[#E8DAC8]/70 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#34150F]">G.R. Case No. 20491 — Real Property Title Quieting</p>
                  <p className="text-[11px] text-[#7D6855]">Regional Trial Court Branch 14 • Pre-trial brief due</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Practice Tools & Profile Status */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Practice Shortcuts */}
          <div
            className="p-6 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 space-y-3"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <h3 className="font-cormorant text-xl font-bold text-[#34150F]">
              Practice Tools
            </h3>
            <div className="space-y-2 pt-1">
              <Link
                href="/lawyer/availability"
                className="flex items-center justify-between p-3 rounded-2xl bg-[#E8DAC8] text-xs font-semibold text-[#34150F] hover:bg-[#DFCDB9] transition-all shadow-[2px_2px_5px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <ClockIcon className="w-4 h-4 text-[#C58B3C]" />
                  <span>Update Weekly Calendar Hours</span>
                </div>
                <span>→</span>
              </Link>

              <Link
                href="/lawyer/messages"
                className="flex items-center justify-between p-3 rounded-2xl bg-[#E8DAC8] text-xs font-semibold text-[#34150F] hover:bg-[#DFCDB9] transition-all shadow-[2px_2px_5px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <MessagesIcon className="w-4 h-4 text-[#C58B3C]" />
                  <span>Client Messages Inbox</span>
                </div>
                <span>→</span>
              </Link>

              <Link
                href="/lawyer/profile"
                className="flex items-center justify-between p-3 rounded-2xl bg-[#E8DAC8] text-xs font-semibold text-[#34150F] hover:bg-[#DFCDB9] transition-all shadow-[2px_2px_5px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <ScaleIcon className="w-4 h-4 text-[#C58B3C]" />
                  <span>Update Practice Areas & Bio</span>
                </div>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Public Profile Status Card */}
          <div
            className="p-6 rounded-3xl bg-[#23150F] text-[#ded7cb] border border-[#352219] space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#352219] pb-3">
              <span className="font-cinzel text-xs font-bold tracking-widest text-[#C58B3C] uppercase">
                Directory Profile Status
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#A69584]">Directory Visibility</span>
                <span className="font-semibold text-emerald-400">Public & Searchable</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A69584]">Primary Practice Areas</span>
                <span className="font-semibold text-[#ded7cb] truncate max-w-[150px]">
                  {practiceAreas.slice(0, 2).join(', ')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A69584]">60-Min Session Fee</span>
                <span className="font-semibold text-[#C58B3C]">₱{hourlyRate?.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#352219]">
              <Link
                href={`/lawyers/${user?.id || ''}`}
                target="_blank"
                className="block text-center text-xs font-semibold text-[#C58B3C] hover:text-white transition-colors"
              >
                Preview Public Lawyer Profile Page ↗
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

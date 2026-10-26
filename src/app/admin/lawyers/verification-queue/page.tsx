import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { LawyerVerificationQueue, type LawyerQueueItem } from '@/components/admin/LawyerVerificationQueue';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Lawyer Verification Queue | Justicia Admin',
  description: 'Review and verify Philippine lawyer roll credentials and applications.',
};

export default async function AdminVerificationQueuePage() {
  const serviceSupabase = await createServiceClient();

  // Fetch all lawyer profiles
  const { data: profiles } = await serviceSupabase
    .from('lawyer_profiles')
    .select(`
      user_id,
      full_name,
      roll_number,
      ibp_chapter,
      bar_passer_year,
      about,
      practice_areas,
      languages,
      experience_years,
      fee_initial_30min,
      fee_standard_60min,
      fee_extended_120min,
      verification_status,
      admin_notes,
      rejection_reason,
      submitted_at,
      reviewed_at,
      created_at
    `)
    .order('created_at', { ascending: false });

  // Fetch emails from user_accounts
  const { data: userAccounts } = await serviceSupabase
    .from('user_accounts')
    .select('id, email');

  const emailMap = new Map<string, string>();
  userAccounts?.forEach((u) => {
    emailMap.set(u.id, u.email);
  });

  const queueItems: LawyerQueueItem[] = (profiles || []).map((p) => ({
    user_id: p.user_id,
    email: emailMap.get(p.user_id) || '—',
    full_name: p.full_name,
    roll_number: p.roll_number,
    ibp_chapter: p.ibp_chapter,
    bar_passer_year: p.bar_passer_year,
    about: p.about,
    practice_areas: p.practice_areas,
    languages: p.languages,
    experience_years: p.experience_years,
    fee_initial_30min: p.fee_initial_30min,
    fee_standard_60min: p.fee_standard_60min,
    fee_extended_120min: p.fee_extended_120min,
    verification_status: p.verification_status || 'draft',
    admin_notes: p.admin_notes,
    rejection_reason: p.rejection_reason,
    submitted_at: p.submitted_at,
    reviewed_at: p.reviewed_at,
    created_at: p.created_at,
  }));

  const pendingCount = queueItems.filter((q) => q.verification_status === 'pending').length;

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-8">
      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="text-[11px] font-bold tracking-[0.2em] text-[#7D6855] hover:text-[#34150F] uppercase"
            >
              Platform Overview
            </Link>
            <span className="text-[#A69584]">/</span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#C58B3C] uppercase">
              Verification Queue
            </span>
          </div>

          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Lawyer Verification Queue
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5 max-w-2xl">
            Review and verify attorney Bar Roll credentials against Integrated Bar of the Philippines records.
            Approved counsel instantly receive portal access and profile discovery.
          </p>
        </div>

        {/* Quick status pill */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div
            className="px-5 py-3 rounded-2xl bg-[#EFE5D8] border border-[#E8DCCB] text-xs font-semibold text-[#34150F] shadow-sm flex items-center gap-2.5"
            style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.06), -3px -3px 10px rgba(255,255,255,0.9)' }}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${pendingCount > 0 ? 'bg-[#C58B3C] animate-ping' : 'bg-emerald-500'}`} />
            <span>{pendingCount} Pending Verification{pendingCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* ─── Queue Component ──────────────────────────────────────────────── */}
      <LawyerVerificationQueue lawyers={queueItems} />
    </div>
  );
}

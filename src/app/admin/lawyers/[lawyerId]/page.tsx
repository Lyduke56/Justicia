import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { AdminLawyerReviewPanel } from '@/components/admin/AdminLawyerReviewPanel';

export const metadata: Metadata = {
  title: 'Lawyer Credential Dossier | Justicia Admin',
};

interface Props {
  params: Promise<{ lawyerId: string }>;
}

export default async function AdminLawyerDetailPage({ params }: Props) {
  const { lawyerId } = await params;
  const serviceSupabase = await createServiceClient();

  // 1. Fetch lawyer profile
  const { data: profile } = await serviceSupabase
    .from('lawyer_profiles')
    .select('*')
    .eq('user_id', lawyerId)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  // 2. Fetch user account details
  const { data: account } = await serviceSupabase
    .from('user_accounts')
    .select('email, role, verification_status, created_at')
    .eq('id', lawyerId)
    .maybeSingle();

  // 3. Fetch audit logs for this lawyer
  const { data: auditLogs } = await serviceSupabase
    .from('audit_log')
    .select('id, action, actor_id, details, created_at')
    .eq('target_id', lawyerId)
    .order('created_at', { ascending: false })
    .limit(8);

  const isApproved = profile.verification_status === 'approved';
  const isPending = profile.verification_status === 'pending';
  const isNeedsInfo = profile.verification_status === 'needs_resubmission';
  const isRejected = profile.verification_status === 'rejected';

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-8">
      {/* ─── Header & Breadcrumbs ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/lawyers/verification-queue"
              className="text-[11px] font-bold tracking-[0.2em] text-[#7D6855] hover:text-[#34150F] uppercase"
            >
              ← Verification Queue
            </Link>
            <span className="text-[#A69584]">/</span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#C58B3C] uppercase">
              Lawyer Dossier
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight">
              Atty. {profile.full_name}
            </h1>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isApproved
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isPending
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : isNeedsInfo
                  ? 'bg-orange-50 text-orange-800 border-orange-300'
                  : isRejected
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}
            >
              <span>{isApproved ? '✅' : isPending ? '⏳' : isNeedsInfo ? '📋' : isRejected ? '✗' : '📝'}</span>
              <span>
                {isApproved
                  ? 'Verified Counsel'
                  : isPending
                  ? 'Pending Review'
                  : isNeedsInfo
                  ? 'Additional Info Needed'
                  : isRejected
                  ? 'Application Rejected'
                  : 'Draft'}
              </span>
            </span>
          </div>

          <p className="text-xs text-[#7D6855] mt-1">
            Registered: {account?.email} • Account created{' '}
            {account?.created_at ? new Date(account.created_at).toLocaleDateString('en-PH') : '—'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/lawyers"
            className="px-4 py-2 rounded-xl border border-[#D8CAAD] text-xs font-semibold text-[#5C4535] hover:bg-[#E5D7C5] transition-all"
          >
            All Lawyers
          </Link>
        </div>
      </div>

      {/* ─── Grid: Credentials & Info ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Official Bar Credentials */}
        <div
          className="lg:col-span-1 rounded-3xl p-6 bg-[#EFE5D8] border border-[#E8DCCB] space-y-6 self-start"
          style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
        >
          <div className="border-b border-[#D8CAAD] pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
              Supreme Court & IBP Records
            </span>
            <h2 className="font-cormorant text-2xl font-bold text-[#34150F] mt-0.5">
              Bar Credentials
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-semibold text-[#7D6855] block">Roll of Attorneys Number</span>
              <p className="text-base font-mono font-bold text-[#34150F] mt-0.5 bg-[#FAF6F0] p-2.5 rounded-xl border border-[#D8CAAD]">
                {profile.roll_number || 'None provided'}
              </p>
            </div>

            <div>
              <span className="font-semibold text-[#7D6855] block">IBP Chapter</span>
              <p className="text-sm font-medium text-[#34150F] mt-0.5">
                {profile.ibp_chapter || 'Not assigned'}
              </p>
            </div>

            <div>
              <span className="font-semibold text-[#7D6855] block">Philippine Bar Admission Year</span>
              <p className="text-sm font-medium text-[#34150F] mt-0.5">
                {profile.bar_passer_year ? `Bar Class of ${profile.bar_passer_year}` : 'Not provided'}
              </p>
            </div>

            <div>
              <span className="font-semibold text-[#7D6855] block">Years of Active Practice</span>
              <p className="text-sm font-medium text-[#34150F] mt-0.5">
                {profile.experience_years ? `${profile.experience_years} years` : 'Not provided'}
              </p>
            </div>

            <div className="border-t border-[#D8CAAD] pt-4">
              <span className="font-semibold text-[#7D6855] block">Platform Visibility</span>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${profile.is_visible ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                <span className="text-xs font-medium text-[#34150F]">
                  {profile.is_visible ? 'Visible on Find a Lawyer' : 'Hidden from Directory'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Practice, Rates, Bio & Review Action */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Practice Details & Rates */}
          <div
            className="rounded-3xl p-6 bg-[#EFE5D8] border border-[#E8DCCB] space-y-6"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <div className="border-b border-[#D8CAAD] pb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                Professional Offering
              </span>
              <h2 className="font-cormorant text-2xl font-bold text-[#34150F] mt-0.5">
                Legal Practice & Consultation Rates
              </h2>
            </div>

            <div className="space-y-4 text-xs">
              {/* Practice Areas */}
              <div>
                <span className="font-semibold text-[#7D6855] block mb-2">Practice Areas</span>
                <div className="flex flex-wrap gap-2">
                  {profile.practice_areas && profile.practice_areas.length > 0 ? (
                    profile.practice_areas.map((area: string) => (
                      <span
                        key={area}
                        className="px-3 py-1 rounded-xl bg-[#C58B3C]/15 border border-[#C58B3C]/30 text-[#34150F] font-medium"
                      >
                        {area}
                      </span>
                    ))
                  ) : (
                    <span className="text-[#A69584]">None declared</span>
                  )}
                </div>
              </div>

              {/* Languages */}
              <div>
                <span className="font-semibold text-[#7D6855] block mb-1">Languages & Dialects</span>
                <p className="text-sm text-[#34150F]">
                  {profile.languages?.join(', ') || 'Filipino, English'}
                </p>
              </div>

              {/* Rates */}
              <div>
                <span className="font-semibold text-[#7D6855] block mb-2">Standard Consultation Rates</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-[#F5EDE2] border border-[#E8DCCB] text-center">
                    <span className="text-[10px] uppercase font-bold text-[#7D6855]">Initial 30 Min</span>
                    <p className="text-lg font-bold text-[#34150F] mt-0.5">
                      {profile.fee_initial_30min ? `₱${profile.fee_initial_30min}` : 'Not set'}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#F5EDE2] border border-[#E8DCCB] text-center">
                    <span className="text-[10px] uppercase font-bold text-[#7D6855]">Standard 1 Hour</span>
                    <p className="text-lg font-bold text-[#34150F] mt-0.5">
                      {profile.fee_standard_60min ? `₱${profile.fee_standard_60min}` : 'Not set'}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#F5EDE2] border border-[#E8DCCB] text-center">
                    <span className="text-[10px] uppercase font-bold text-[#7D6855]">Extended 2 Hours</span>
                    <p className="text-lg font-bold text-[#34150F] mt-0.5">
                      {profile.fee_extended_120min ? `₱${profile.fee_extended_120min}` : 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bio Statement */}
              {profile.about && (
                <div className="pt-2">
                  <span className="font-semibold text-[#7D6855] block mb-1">Biography / Legal Statement</span>
                  <div className="p-4 rounded-2xl bg-[#F5EDE2] border border-[#E8DCCB] text-xs text-[#5C4535] leading-relaxed">
                    {profile.about}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Review Decision Interactive Panel */}
          <AdminLawyerReviewPanel
            lawyerId={lawyerId}
            lawyerName={profile.full_name}
            currentStatus={profile.verification_status}
            adminNotes={profile.admin_notes}
            rejectionReason={profile.rejection_reason}
          />

          {/* Audit History */}
          {auditLogs && auditLogs.length > 0 && (
            <div
              className="rounded-3xl p-6 bg-[#EFE5D8] border border-[#E8DCCB] space-y-4"
              style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
            >
              <h3 className="font-cormorant text-xl font-bold text-[#34150F]">
                Application Audit Trail
              </h3>
              <div className="space-y-2 text-xs">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#F5EDE2] border border-[#E8DCCB]"
                  >
                    <div>
                      <span className="font-bold text-[#34150F]">{log.action}</span>
                      <p className="text-[11px] text-[#7D6855] mt-0.5">
                        {log.details ? JSON.stringify(log.details) : 'Audit recorded'}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#A69584]">
                      {new Date(log.created_at).toLocaleString('en-PH')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

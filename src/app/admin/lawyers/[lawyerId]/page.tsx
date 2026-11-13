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
    <div className="admin-page">
      {/* ─── Header & Breadcrumbs ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/lawyers/verification-queue"
              className="text-[11px] font-bold tracking-[0.2em] text-[#705744] hover:text-[#34150F] uppercase"
            >
              ← Verification Queue
            </Link>
            <span className="text-[#806955]">/</span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#80501F] uppercase">
              Lawyer Dossier
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <h1 className="font-lora text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight">
              Atty. {profile.full_name}
            </h1>

            <span
              className={`admin-status ${
                isApproved
                  ? 'admin-status-success'
                  : isPending
                  ? 'admin-status-warning'
                  : isNeedsInfo
                  ? 'admin-status-info'
                  : isRejected
                  ? 'admin-status-danger'
                  : 'admin-status-neutral'
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

          <p className="text-xs text-[#705744] mt-1">
            Registered: {account?.email} • Account created{' '}
            {account?.created_at ? new Date(account.created_at).toLocaleDateString('en-PH') : '—'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/lawyers"
            className="admin-button px-4 py-2 text-xs font-semibold transition-all"
          >
            All Lawyers
          </Link>
        </div>
      </div>

      {/* ─── Grid: Credentials & Info ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Official Bar Credentials */}
        <div
          className="admin-card lg:col-span-1 p-6 space-y-6 self-start"
        >
          <div className="border-b border-[#D8CAAD] pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#80501F]">
              Supreme Court & IBP Records
            </span>
            <h2 className="font-lora text-2xl font-bold text-[#34150F] mt-0.5">
              Bar Credentials
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-semibold text-[#705744] block">Roll of Attorneys Number</span>
              <p className="admin-inset text-base font-mono font-bold text-[#34150F] mt-0.5 p-2.5">
                {profile.roll_number || 'None provided'}
              </p>
            </div>

            <div>
              <span className="font-semibold text-[#705744] block">IBP Chapter</span>
              <p className="text-sm font-medium text-[#34150F] mt-0.5">
                {profile.ibp_chapter || 'Not assigned'}
              </p>
            </div>

            <div>
              <span className="font-semibold text-[#705744] block">Philippine Bar Admission Year</span>
              <p className="text-sm font-medium text-[#34150F] mt-0.5">
                {profile.bar_passer_year ? `Bar Class of ${profile.bar_passer_year}` : 'Not provided'}
              </p>
            </div>

            <div>
              <span className="font-semibold text-[#705744] block">Years of Active Practice</span>
              <p className="text-sm font-medium text-[#34150F] mt-0.5">
                {profile.experience_years ? `${profile.experience_years} years` : 'Not provided'}
              </p>
            </div>

            <div className="border-t border-[#D8CAAD] pt-4">
              <span className="font-semibold text-[#705744] block">Platform Visibility</span>
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
            className="admin-card p-6 space-y-6"
          >
            <div className="border-b border-[#D8CAAD] pb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#80501F]">
                Professional Offering
              </span>
              <h2 className="font-lora text-2xl font-bold text-[#34150F] mt-0.5">
                Legal Practice & Consultation Rates
              </h2>
            </div>

            <div className="space-y-4 text-xs">
              {/* Practice Areas */}
              <div>
                <span className="font-semibold text-[#705744] block mb-2">Practice Areas</span>
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
                    <span className="text-[#806955]">None declared</span>
                  )}
                </div>
              </div>

              {/* Languages */}
              <div>
                <span className="font-semibold text-[#705744] block mb-1">Languages & Dialects</span>
                <p className="text-sm text-[#34150F]">
                  {profile.languages?.join(', ') || 'Filipino, English'}
                </p>
              </div>

              {/* Rates */}
              <div>
                <span className="font-semibold text-[#705744] block mb-2">Standard Consultation Rates</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="admin-inset p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-[#705744]">Initial 30 Min</span>
                    <p className="text-lg font-bold text-[#34150F] mt-0.5">
                      {profile.fee_initial_30min ? `₱${profile.fee_initial_30min}` : 'Not set'}
                    </p>
                  </div>
                  <div className="admin-inset p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-[#705744]">Standard 1 Hour</span>
                    <p className="text-lg font-bold text-[#34150F] mt-0.5">
                      {profile.fee_standard_60min ? `₱${profile.fee_standard_60min}` : 'Not set'}
                    </p>
                  </div>
                  <div className="admin-inset p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-[#705744]">Extended 2 Hours</span>
                    <p className="text-lg font-bold text-[#34150F] mt-0.5">
                      {profile.fee_extended_120min ? `₱${profile.fee_extended_120min}` : 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bio Statement */}
              {profile.about && (
                <div className="pt-2">
                  <span className="font-semibold text-[#705744] block mb-1">Biography / Legal Statement</span>
                  <div className="admin-inset p-4 text-xs text-[#5C4535] leading-relaxed">
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
              className="admin-card p-6 space-y-4"
            >
              <h3 className="font-lora text-xl font-bold text-[#34150F]">
                Application Audit Trail
              </h3>
              <div className="space-y-2 text-xs">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="admin-inset flex items-center justify-between p-3"
                  >
                    <div>
                      <span className="font-bold text-[#34150F]">{log.action}</span>
                      <p className="text-[11px] text-[#705744] mt-0.5">
                        {log.details ? JSON.stringify(log.details) : 'Audit recorded'}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#806955]">
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

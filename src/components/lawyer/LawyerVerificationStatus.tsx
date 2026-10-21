'use client';

import Link from 'next/link';

interface LawyerVerificationStatusProps {
  profile: {
    verification_status: string;
    rejection_reason: string | null;
    admin_notes: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    full_name: string | null;
  } | null;
  email: string;
  fullName: string;
}

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'needs_resubmission' | 'draft' | string;

function StatusBadge({ status }: { status: VerificationStatus }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
    needs_resubmission: 'bg-orange-100 text-orange-800 border-orange-300',
    draft: 'bg-gray-100 text-gray-600 border-gray-300',
  };
  const labels: Record<string, string> = {
    pending: 'Under Review',
    approved: 'Approved',
    rejected: 'Not Approved',
    needs_resubmission: 'Additional Info Needed',
    draft: 'Draft',
  };
  const icons: Record<string, string> = {
    pending: '⏳',
    approved: '✅',
    rejected: '✗',
    needs_resubmission: '📋',
    draft: '📝',
  };

  const style = styles[status] ?? styles.pending;
  const label = labels[status] ?? status;
  const icon = icons[status] ?? '🔍';

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${style}`}>
      <span>{icon}</span>
      {label}
    </span>
  );
}

function TimelineStep({
  label,
  date,
  done,
  active,
}: {
  label: string;
  date?: string | null;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all ${
            done
              ? 'bg-[#C58B3C] border-[#C58B3C] text-white'
              : active
              ? 'border-[#C58B3C] text-[#C58B3C] bg-[#F5EDE2]'
              : 'border-[#D8CAAD] text-[#A69584] bg-[#EFE5D8]'
          }`}
        >
          {done ? '✓' : ''}
        </div>
        <div className="w-0.5 h-8 bg-[#D8CAAD] last:hidden" />
      </div>
      <div className="pb-8">
        <p className={`text-sm font-medium ${done ? 'text-[#34150F]' : active ? 'text-[#C58B3C]' : 'text-[#A69584]'}`}>
          {label}
        </p>
        {date && (
          <p className="text-xs text-[#7D6855] mt-0.5">
            {new Date(date).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

export function LawyerVerificationStatus({ profile, email, fullName }: LawyerVerificationStatusProps) {
  const status = profile?.verification_status ?? 'draft';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';
  const needsResubmission = status === 'needs_resubmission';
  const isDraft = status === 'draft' || !profile;

  return (
    <div className="min-h-screen bg-[#EFE5D8] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#C58B3C]/15 mb-2">
            <svg className="w-8 h-8 text-[#C58B3C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <h1 className="font-cormorant text-4xl font-bold text-[#34150F]">Application Status</h1>
          <p className="text-sm text-[#7D6855]">
            Hello, <span className="font-semibold text-[#34150F]">{fullName || email}</span>. Here is the current status of your Justicia lawyer application.
          </p>
        </div>

        {/* Status Card */}
        <div
          className="rounded-2xl p-6 sm:p-8 bg-[#EFE5D8] space-y-6"
          style={{ boxShadow: '8px 8px 20px rgba(0,0,0,0.07),-8px -8px 20px rgba(255,255,255,0.95)' }}
        >
          {/* Status Badge */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[#7D6855] mb-1">Application Status</p>
              <StatusBadge status={status} />
            </div>
            {profile?.submitted_at && (
              <div className="text-right">
                <p className="text-xs text-[#7D6855]">Submitted</p>
                <p className="text-xs font-medium text-[#34150F]">
                  {new Date(profile.submitted_at).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-[#D8CAAD]" />

          {/* Status-specific message */}
          {isDraft && (
            <div className="p-4 rounded-xl bg-[#F5EDE2] border border-[#E8DCCB] space-y-3">
              <p className="text-sm font-medium text-[#34150F]">📝 Application Incomplete</p>
              <p className="text-sm text-[#7D6855]">
                You have not yet submitted your application for review. Complete your registration to get started.
              </p>
              <Link
                href="/lawyer/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C58B3C] text-white text-sm font-semibold hover:bg-[#B07A2E] transition-colors shadow-md"
              >
                Complete Your Application
              </Link>
            </div>
          )}

          {isPending && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-semibold text-amber-900 mb-1">⏳ Your application is under review</p>
                <p className="text-sm text-amber-800">
                  Our team is verifying your credentials against the Integrated Bar of the Philippines records. This
                  typically takes <strong>1–3 business days</strong>.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F5EDE2] border border-[#E8DCCB] text-sm text-[#7D6855] space-y-1">
                <p className="font-medium text-[#34150F]">What happens next?</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Our admin team will review your Roll of Attorneys number and IBP Chapter</li>
                  <li>You will receive an email notification at <strong>{email}</strong> when a decision is made</li>
                  <li>If approved, your profile becomes live on "Find a Lawyer" and you can accept clients</li>
                </ul>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm font-semibold text-red-900 mb-2">✗ Application Not Approved</p>
                <p className="text-sm text-red-800">
                  Unfortunately, we were unable to verify your credentials at this time. You may re-submit a new
                  application with updated information.
                </p>
              </div>

              {profile?.rejection_reason && (
                <div className="p-4 rounded-xl bg-[#FFF8F4] border border-red-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-red-700 mb-1">Reason for Decision</p>
                  <p className="text-sm text-[#34150F]">{profile.rejection_reason}</p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#F5EDE2] border border-[#E8DCCB] text-sm text-[#7D6855]">
                <p className="font-medium text-[#34150F] mb-1">You can register again</p>
                <p>
                  If you believe this decision was made in error, or if you have updated credentials, you are welcome to
                  submit a new application.
                </p>
              </div>

              <Link
                href="/lawyer/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#34150F] text-white text-sm font-semibold hover:bg-[#23150F] transition-colors shadow-md"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Register Again
              </Link>
            </div>
          )}

          {needsResubmission && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                <p className="text-sm font-semibold text-orange-900 mb-1">📋 Additional Information Required</p>
                <p className="text-sm text-orange-800">
                  Our team has reviewed your application and requires additional information before we can proceed.
                </p>
              </div>

              {profile?.admin_notes && (
                <div className="p-4 rounded-xl bg-[#FFF8F4] border border-orange-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-700 mb-1">Message from Admin</p>
                  <p className="text-sm text-[#34150F]">{profile.admin_notes}</p>
                </div>
              )}

              <Link
                href="/lawyer/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C58B3C] text-white text-sm font-semibold hover:bg-[#B07A2E] transition-colors shadow-md"
              >
                Update & Resubmit Application
              </Link>
            </div>
          )}

          {/* Timeline */}
          {profile && (
            <>
              <div className="border-t border-[#D8CAAD]" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#7D6855] mb-4">Application Timeline</p>
                <div className="space-y-0">
                  <TimelineStep
                    label="Application Submitted"
                    date={profile.submitted_at}
                    done={!!profile.submitted_at}
                    active={!profile.submitted_at}
                  />
                  <TimelineStep
                    label="Under Review by Justicia Team"
                    date={undefined}
                    done={status === 'approved' || status === 'rejected' || status === 'needs_resubmission'}
                    active={status === 'pending'}
                  />
                  <TimelineStep
                    label={
                      status === 'approved'
                        ? 'Application Approved'
                        : status === 'rejected'
                        ? 'Application Decision Issued'
                        : status === 'needs_resubmission'
                        ? 'Additional Info Requested'
                        : 'Decision'
                    }
                    date={profile.reviewed_at}
                    done={['approved', 'rejected', 'needs_resubmission'].includes(status)}
                    active={false}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Help section */}
        <div className="text-center text-xs text-[#7D6855] space-y-1">
          <p>
            Questions about your application? Contact us at{' '}
            <a href="mailto:support@justicia.ph" className="text-[#C58B3C] hover:underline font-medium">
              support@justicia.ph
            </a>
          </p>
          <p>
            <Link href="/client/dashboard" className="text-[#C58B3C] hover:underline">
              Return to Home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

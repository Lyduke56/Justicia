'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { AdminDialog } from '@/components/admin/AdminDialog';
import { useRouter } from 'next/navigation';
import { reviewLawyerApplicationAction, type ReviewDecision } from '@/app/actions/adminLawyerReview';

export interface LawyerQueueItem {
  user_id: string;
  email: string;
  full_name: string;
  roll_number: string;
  ibp_chapter: string | null;
  bar_passer_year: number | null;
  about: string | null;
  practice_areas: string[] | null;
  languages: string[] | null;
  experience_years: number | null;
  fee_initial_30min: number | null;
  fee_standard_60min: number | null;
  fee_extended_120min: number | null;
  verification_status: string;
  admin_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Props {
  lawyers: LawyerQueueItem[];
}

type TabKey = 'all' | 'pending' | 'needs_resubmission' | 'approved' | 'rejected';

export function LawyerVerificationQueue({ lawyers: initialLawyers }: Props) {
  const router = useRouter();
  const [lawyers, setLawyers] = useState<LawyerQueueItem[]>(initialLawyers);

  const [previousLawyers, setPreviousLawyers] = useState(initialLawyers);
  if (initialLawyers !== previousLawyers) {
    setPreviousLawyers(initialLawyers);
    setLawyers(initialLawyers);
  }
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Action modal state
  const [modalState, setModalState] = useState<{
    open: boolean;
    lawyer: LawyerQueueItem | null;
    decision: ReviewDecision;
    note: string;
  }>({
    open: false,
    lawyer: null,
    decision: 'approved',
    note: '',
  });

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Counts
  const counts = {
    all: lawyers.length,
    pending: lawyers.filter((l) => l.verification_status === 'pending').length,
    needs_resubmission: lawyers.filter((l) => l.verification_status === 'needs_resubmission').length,
    approved: lawyers.filter((l) => l.verification_status === 'approved').length,
    rejected: lawyers.filter((l) => l.verification_status === 'rejected').length,
  };

  // Filtered lawyers
  const filtered = lawyers.filter((l) => {
    // Status tab filter
    if (activeTab !== 'all' && l.verification_status !== activeTab) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (l.full_name || '').toLowerCase();
      const email = (l.email || '').toLowerCase();
      const roll = (l.roll_number || '').toLowerCase();
      const chapter = (l.ibp_chapter || '').toLowerCase();
      const areas = (l.practice_areas || []).join(' ').toLowerCase();

      return name.includes(q) || email.includes(q) || roll.includes(q) || chapter.includes(q) || areas.includes(q);
    }

    return true;
  });

  const handleOpenAction = (lawyer: LawyerQueueItem, decision: ReviewDecision) => {
    setModalState({
      open: true,
      lawyer,
      decision,
      note: decision === 'rejected' ? 'Credentials could not be verified against IBP records.' : '',
    });
  };

  const handleConfirmAction = () => {
    if (!modalState.lawyer) return;

    const { lawyer, decision, note } = modalState;

    startTransition(async () => {
      const res = await reviewLawyerApplicationAction(lawyer.user_id, decision, note);

      if (res.error) {
        setNotification({ type: 'error', message: res.error });
      } else {
        setNotification({
          type: 'success',
          message: res.message || `Application updated successfully.`,
        });

        // Update local state immediately for instant feedback
        setLawyers((prev) =>
          prev.map((item) =>
            item.user_id === lawyer.user_id
              ? {
                  ...item,
                  verification_status: decision,
                  rejection_reason: decision === 'rejected' ? note : null,
                  admin_notes: decision === 'needs_resubmission' ? note : null,
                  reviewed_at: new Date().toISOString(),
                }
              : item
          )
        );

        setModalState({ open: false, lawyer: null, decision: 'approved', note: '' });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Notification Alert ────────────────────────────────────────────── */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl text-sm transition-all animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notification.type === 'success' ? '✓' : '⚠️'}</span>
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="admin-button text-xs font-semibold uppercase tracking-wider hover:opacity-70 p-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Filter Tabs & Search Bar ──────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        {/* Navigation Tabs */}
        <div className="admin-filter-bar">
          <button
            type="button" aria-pressed={activeTab === 'pending'} onClick={() => setActiveTab('pending')}
            className={`admin-button admin-filter px-4 py-2 text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-[#C58B3C] text-white shadow-md'
                : 'bg-[#E5D7C5]/70 text-[#5C4535] hover:bg-[#DBCABA]'
            }`}
          >
            <span>Pending Review</span>
            {counts.pending > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'pending' ? 'bg-[#23150F] text-[#80501F]' : 'bg-[#C58B3C] text-white'
              }`}>
                {counts.pending}
              </span>
            )}
          </button>

          <button
            type="button" aria-pressed={activeTab === 'needs_resubmission'} onClick={() => setActiveTab('needs_resubmission')}
            className={`admin-button admin-filter px-4 py-2 text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'needs_resubmission'
                ? 'bg-[#C58B3C] text-white shadow-md'
                : 'bg-[#E5D7C5]/70 text-[#5C4535] hover:bg-[#DBCABA]'
            }`}
          >
            <span>Needs Info</span>
            {counts.needs_resubmission > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-200 text-orange-900">
                {counts.needs_resubmission}
              </span>
            )}
          </button>

          <button
            type="button" aria-pressed={activeTab === 'approved'} onClick={() => setActiveTab('approved')}
            className={`admin-button admin-filter px-4 py-2 text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'approved'
                ? 'bg-[#C58B3C] text-white shadow-md'
                : 'bg-[#E5D7C5]/70 text-[#5C4535] hover:bg-[#DBCABA]'
            }`}
          >
            <span>Approved</span>
            <span className="text-[10px] opacity-75">({counts.approved})</span>
          </button>

          <button
            type="button" aria-pressed={activeTab === 'rejected'} onClick={() => setActiveTab('rejected')}
            className={`admin-button admin-filter px-4 py-2 text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'rejected'
                ? 'bg-[#C58B3C] text-white shadow-md'
                : 'bg-[#E5D7C5]/70 text-[#5C4535] hover:bg-[#DBCABA]'
            }`}
          >
            <span>Rejected</span>
            <span className="text-[10px] opacity-75">({counts.rejected})</span>
          </button>

          <button
            type="button" aria-pressed={activeTab === 'all'} onClick={() => setActiveTab('all')}
            className={`admin-button admin-filter px-4 py-2 text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-[#34150F] text-white shadow-md'
                : 'bg-[#E5D7C5]/70 text-[#5C4535] hover:bg-[#DBCABA]'
            }`}
          >
            <span>All ({counts.all})</span>
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full max-w-xl">
          <input
            type="search"
            aria-label="Search lawyer applications"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, roll #, chapter..."
            className="admin-field w-full px-4 py-2.5 pl-9 text-xs text-[#34150F] placeholder-[#9E8E7D] transition-all"
          />
          <svg
            className="w-4 h-4 text-[#705744] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
      </div>

      {/* ─── Application Cards List ────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div
          className="admin-card p-12 text-center space-y-3"
        >
          <div className="admin-plate w-14 h-14 text-[#80501F] flex items-center justify-center mx-auto text-2xl">
            📋
          </div>
          <h3 className="font-lora text-2xl font-bold text-[#34150F]">No applications found</h3>
          <p className="text-xs text-[#705744] max-w-sm mx-auto">
            {searchQuery
              ? `No lawyer profiles match "${searchQuery}". Try searching with different keywords.`
              : activeTab === 'pending'
              ? 'All clear! There are currently no pending lawyer verification applications awaiting review.'
              : `There are currently no lawyer applications categorized as "${activeTab}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((lawyer) => {
            const isLawyerPending = lawyer.verification_status === 'pending';
            const isApproved = lawyer.verification_status === 'approved';
            const isRejected = lawyer.verification_status === 'rejected';
            const isNeedsInfo = lawyer.verification_status === 'needs_resubmission';

            return (
              <div
                key={lawyer.user_id}
                className="admin-card p-6 transition-all space-y-5"
              >
                {/* Top Row: Name, Status Badge, Roll # */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#34150F] text-[#FAF6F0] flex items-center justify-center font-cinzel font-bold text-lg shrink-0 shadow-sm">
                      {lawyer.full_name
                        ? lawyer.full_name
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join('')
                            .toUpperCase()
                        : 'AT'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-lora text-2xl font-bold text-[#34150F]">
                          {lawyer.full_name || 'Attorney Applicant'}
                        </h2>
                        {/* Status Badge */}
                        <span
                          className={`admin-status ${
                            isApproved
                              ? 'admin-status-success'
                              : isLawyerPending
                              ? 'admin-status-warning'
                              : isNeedsInfo
                              ? 'admin-status-info'
                              : isRejected
                              ? 'admin-status-danger'
                              : 'admin-status-neutral'
                          }`}
                        >
                          <span>{isApproved ? '✅' : isLawyerPending ? '⏳' : isNeedsInfo ? '📋' : isRejected ? '✗' : '📝'}</span>
                          <span>
                            {isApproved
                              ? 'Approved & Verified'
                              : isLawyerPending
                              ? 'Pending Review'
                              : isNeedsInfo
                              ? 'Additional Info Required'
                              : isRejected
                              ? 'Rejected'
                              : 'Draft'}
                          </span>
                        </span>
                      </div>

                      <p className="text-xs text-[#705744] mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>{lawyer.email}</span>
                        {lawyer.submitted_at && (
                          <span>
                            • Submitted{' '}
                            {new Date(lawyer.submitted_at).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Credentials Pills */}
                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                    <span className="px-3 py-1.5 rounded-xl bg-[#23150F] text-[#FAF6F0] text-xs font-mono font-bold tracking-wider">
                      ROLL #{lawyer.roll_number || 'PENDING'}
                    </span>
                    {lawyer.ibp_chapter && (
                      <span className="admin-plate px-3 py-1.5 text-[#5C4535] text-xs font-semibold">
                        {lawyer.ibp_chapter}
                      </span>
                    )}
                    {lawyer.bar_passer_year && (
                      <span className="admin-plate px-3 py-1.5 text-[#5C4535] text-xs font-semibold">
                        Bar Passer: {lawyer.bar_passer_year}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Row: Practice Areas, Bio, Rates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#E8DCCB]/80 text-xs">
                  {/* Practice Areas */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-[#705744] uppercase tracking-wider text-[10px]">
                      Practice Areas
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {lawyer.practice_areas && lawyer.practice_areas.length > 0 ? (
                        lawyer.practice_areas.map((area) => (
                          <span
                            key={area}
                            className="px-2 py-0.5 rounded-lg bg-[#C58B3C]/15 text-[#34150F] font-medium text-[11px]"
                          >
                            {area}
                          </span>
                        ))
                      ) : (
                        <span className="text-[#806955]">Not specified</span>
                      )}
                    </div>
                  </div>

                  {/* Languages & Experience */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-[#705744] uppercase tracking-wider text-[10px]">
                      Background & Languages
                    </span>
                    <p className="text-[#34150F]">
                      <strong>Experience:</strong> {lawyer.experience_years ? `${lawyer.experience_years} years in practice` : 'Not specified'}
                    </p>
                    <p className="text-[#34150F]">
                      <strong>Languages:</strong> {lawyer.languages?.join(', ') || 'Filipino, English'}
                    </p>
                  </div>

                  {/* Rates */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-[#705744] uppercase tracking-wider text-[10px]">
                      Consultation Rates
                    </span>
                    <p className="text-[#34150F]">
                      <strong>30 Min:</strong> {lawyer.fee_initial_30min ? `₱${lawyer.fee_initial_30min}` : '—'} •{' '}
                      <strong>1 Hr:</strong> {lawyer.fee_standard_60min ? `₱${lawyer.fee_standard_60min}` : '—'} •{' '}
                      <strong>2 Hrs:</strong> {lawyer.fee_extended_120min ? `₱${lawyer.fee_extended_120min}` : '—'}
                    </p>
                  </div>
                </div>

                {/* Bio Snippet */}
                {lawyer.about && (
                  <div className="admin-inset p-3.5 text-xs text-[#5C4535] leading-relaxed">
                    <span className="font-bold text-[#34150F]">Statement / Bio: </span>
                    {lawyer.about}
                  </div>
                )}

                {/* Admin Notes / Rejection Reason if any */}
                {lawyer.admin_notes && (
                  <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900">
                    <strong>Admin Note:</strong> {lawyer.admin_notes}
                  </div>
                )}
                {lawyer.rejection_reason && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
                    <strong>Rejection Reason:</strong> {lawyer.rejection_reason}
                  </div>
                )}

                {/* Bottom Row: Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E8DCCB]/80 flex-wrap gap-3">
                  <Link
                    href={`/admin/lawyers/${lawyer.user_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#80501F] hover:text-[#99431E] hover:underline"
                  >
                    <span>View Full Credential Dossier</span>
                    <span>→</span>
                  </Link>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Approve Button */}
                    {!isApproved && (
                      <button
                        type="button"
                        onClick={() => handleOpenAction(lawyer, 'approved')}
                        disabled={isPending}
                        className="admin-button admin-button-success px-4 py-2 text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        <span>✓</span>
                        <span>Approve Verification</span>
                      </button>
                    )}

                    {/* Request Info Button */}
                    {!isNeedsInfo && (
                      <button
                        type="button"
                        onClick={() => handleOpenAction(lawyer, 'needs_resubmission')}
                        disabled={isPending}
                        className="admin-button admin-button-warning px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        <span>📋</span>
                        <span>Request Info</span>
                      </button>
                    )}

                    {/* Reject Button */}
                    {!isRejected && (
                      <button
                        type="button"
                        onClick={() => handleOpenAction(lawyer, 'rejected')}
                        disabled={isPending}
                        className="admin-button admin-button-danger px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        <span>✕</span>
                        <span>Reject</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Decision Modal ────────────────────────────────────────────────── */}
      {modalState.open && modalState.lawyer && (
        <AdminDialog open onClose={() => setModalState((previous) => ({ ...previous, open: false }))} labelledBy="verification-decision-title">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CAAD]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#80501F]">
                  Verification Review Decision
                </span>
                <h3 id="verification-decision-title" className="font-lora text-xl text-[#34150F]">
                  {modalState.decision === 'approved'
                    ? 'Approve Lawyer Credentials'
                    : modalState.decision === 'needs_resubmission'
                    ? 'Request Additional Information'
                    : 'Reject Lawyer Application'}
                </h3>
              </div>
              <button
                onClick={() => setModalState({ open: false, lawyer: null, decision: 'approved', note: '' })}
                aria-label="Close verification decision"
                className="admin-button p-1 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#5C4535]">
              <div className="admin-inset p-3.5 space-y-1">
                <p>
                  <strong className="text-[#34150F]">Applicant:</strong> {modalState.lawyer.full_name}
                </p>
                <p>
                  <strong className="text-[#34150F]">Roll Number:</strong> {modalState.lawyer.roll_number}
                </p>
                <p>
                  <strong className="text-[#34150F]">IBP Chapter:</strong> {modalState.lawyer.ibp_chapter || '—'}
                </p>
              </div>

              {modalState.decision === 'approved' && (
                <p className="text-emerald-900 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  By approving, Atty. {modalState.lawyer.full_name} will be granted full access to the Counsel Portal
                  and their public profile will be activated on &ldquo;Find a Lawyer&rdquo;.
                </p>
              )}

              {modalState.decision === 'needs_resubmission' && (
                <div className="space-y-1.5">
                  <label htmlFor="verification-info-note" className="font-semibold text-[#34150F] block">
                    Message / Instructions for Lawyer:
                  </label>
                  <textarea
                    id="verification-info-note"
                    rows={3}
                    value={modalState.note}
                    onChange={(e) => setModalState((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="e.g. Please provide updated IBP Chapter clearance or clear photo of Bar ID..."
                    className="admin-field w-full p-3 text-xs text-[#34150F]"
                  />
                  <p className="text-[11px] text-[#705744]">
                    This note will be shown on the lawyer&apos;s Application Status page.
                  </p>
                </div>
              )}

              {modalState.decision === 'rejected' && (
                <div className="space-y-1.5">
                  <label htmlFor="verification-rejection-note" className="font-semibold text-[#34150F] block">
                    Reason for Non-Approval:
                  </label>
                  <textarea
                    id="verification-rejection-note"
                    rows={3}
                    value={modalState.note}
                    onChange={(e) => setModalState((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="e.g. Roll number does not match Supreme Court / IBP database records..."
                    className="admin-field w-full p-3 text-xs text-[#34150F]"
                  />
                  <p className="text-[11px] text-[#705744]">
                    The applicant will see this reason on their Application Status page.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#D8CAAD]">
              <button
                type="button"
                onClick={() => setModalState({ open: false, lawyer: null, decision: 'approved', note: '' })}
                className="admin-button px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isPending}
                className={`admin-button px-5 py-2.5 text-xs font-bold tracking-wide transition-all ${
                  modalState.decision === 'approved'
                    ? 'admin-button-success'
                    : modalState.decision === 'needs_resubmission'
                    ? 'admin-button-warning'
                    : 'admin-button-danger'
                }`}
              >
                {isPending ? 'Processing…' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}

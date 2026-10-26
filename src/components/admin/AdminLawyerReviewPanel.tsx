'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewLawyerApplicationAction, type ReviewDecision } from '@/app/actions/adminLawyerReview';

interface Props {
  lawyerId: string;
  lawyerName: string;
  currentStatus: string;
  adminNotes?: string | null;
  rejectionReason?: string | null;
}

export function AdminLawyerReviewPanel({
  lawyerId,
  lawyerName,
  currentStatus,
  adminNotes,
  rejectionReason,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDecision, setSelectedDecision] = useState<ReviewDecision>('approved');
  const [noteText, setNoteText] = useState(adminNotes || rejectionReason || '');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const res = await reviewLawyerApplicationAction(lawyerId, selectedDecision, noteText);
      if (res.error) {
        setFeedback({ type: 'error', text: res.error });
      } else {
        setFeedback({ type: 'success', text: res.message || 'Decision applied successfully.' });
        router.refresh();
      }
    });
  };

  return (
    <div
      className="p-6 sm:p-8 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-6"
      style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
    >
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
          Credential Verification Assessment
        </span>
        <h3 className="font-cormorant text-2xl font-bold text-[#34150F]">
          Review & Verification Decision
        </h3>
        <p className="text-xs text-[#7D6855] mt-1">
          Issue a formal verification decision for Atty. {lawyerName}. Decisions immediately update the lawyer's access rights.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Decision Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              selectedDecision === 'approved'
                ? 'bg-emerald-50/80 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/30'
                : 'bg-[#F5EDE2] border-[#D8CAAD]/60 text-[#5C4535] hover:bg-[#E8DCCB]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">Approve & Verify</span>
              <input
                type="radio"
                name="decision"
                value="approved"
                checked={selectedDecision === 'approved'}
                onChange={() => setSelectedDecision('approved')}
                className="sr-only"
              />
              <span className="text-emerald-600 font-bold">✓</span>
            </div>
            <p className="text-[11px] opacity-80 mt-2">
              Valid credentials. Grant full Counsel Portal access & directory visibility.
            </p>
          </label>

          <label
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              selectedDecision === 'needs_resubmission'
                ? 'bg-amber-50/80 border-amber-500 text-amber-900 ring-2 ring-amber-500/30'
                : 'bg-[#F5EDE2] border-[#D8CAAD]/60 text-[#5C4535] hover:bg-[#E8DCCB]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">Request Info</span>
              <input
                type="radio"
                name="decision"
                value="needs_resubmission"
                checked={selectedDecision === 'needs_resubmission'}
                onChange={() => setSelectedDecision('needs_resubmission')}
                className="sr-only"
              />
              <span className="text-amber-600 font-bold">📋</span>
            </div>
            <p className="text-[11px] opacity-80 mt-2">
              Incomplete documents or requires updated clearance before approval.
            </p>
          </label>

          <label
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              selectedDecision === 'rejected'
                ? 'bg-red-50/80 border-red-500 text-red-900 ring-2 ring-red-500/30'
                : 'bg-[#F5EDE2] border-[#D8CAAD]/60 text-[#5C4535] hover:bg-[#E8DCCB]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">Reject</span>
              <input
                type="radio"
                name="decision"
                value="rejected"
                checked={selectedDecision === 'rejected'}
                onChange={() => setSelectedDecision('rejected')}
                className="sr-only"
              />
              <span className="text-red-600 font-bold">✕</span>
            </div>
            <p className="text-[11px] opacity-80 mt-2">
              Credentials could not be verified or invalid IBP roll number.
            </p>
          </label>
        </div>

        {/* Note / Reason Field (conditional or optional for approve) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#34150F] block">
            {selectedDecision === 'approved'
              ? 'Internal Admin Note (Optional):'
              : selectedDecision === 'needs_resubmission'
              ? 'Required Information for Applicant (Mandatory):'
              : 'Rejection Reason (Mandatory):'}
          </label>
          <textarea
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={
              selectedDecision === 'approved'
                ? 'Verified against SC Roll of Attorneys database and active IBP chapter standing.'
                : selectedDecision === 'needs_resubmission'
                ? 'e.g. Please upload clear photo of valid IBP ID card or updated IBP Chapter clearance...'
                : 'e.g. Roll number does not match registered attorney records...'
            }
            className="w-full p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#D8CAAD] text-xs text-[#34150F] placeholder-[#A69584] focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40 transition-all resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-[#7D6855]">
            Current Status:{' '}
            <span className="font-bold text-[#34150F] capitalize">
              {currentStatus.replace('_', ' ')}
            </span>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide transition-all shadow-md ${
              selectedDecision === 'approved'
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : selectedDecision === 'needs_resubmission'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-red-700 hover:bg-red-800'
            } disabled:opacity-60`}
          >
            {isPending ? 'Saving Decision…' : 'Submit Verification Decision'}
          </button>
        </div>
      </form>
    </div>
  );
}

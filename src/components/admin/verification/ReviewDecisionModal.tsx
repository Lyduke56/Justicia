'use client';

import { useState } from 'react';
import { NeuAlert, NeuButton, NeuModal, type NeuTone } from '@/components/shared/neu';
import type { ReviewDecision } from '@/app/actions/adminLawyerReview';
import { formatAttorneyName } from '@/lib/utils/attorneyName';
import { CAPS, DECISION_GLYPH } from './ApplicationDossier';
import type { LawyerQueueItem } from './model';
import { stamp } from '../overview/activity';

/**
 * Confirms a verification decision in the shared neumorphic modal (the same frame as the client
 * and lawyer booking dialogs). Approving needs no note; asking for information or rejecting
 * takes a message the applicant sees on their Application Status page.
 */

const CONFIG: Record<ReviewDecision, { title: string; confirm: string; busy: string; tone: NeuTone; variant: 'dark' | 'primary' | 'danger' }> = {
  approved: { title: 'Approve this lawyer?', confirm: 'Approve lawyer', busy: 'Approving…', tone: 'success', variant: 'dark' },
  needs_resubmission: { title: 'Request more information?', confirm: 'Send request', busy: 'Sending…', tone: 'caramel', variant: 'primary' },
  rejected: { title: 'Reject this application?', confirm: 'Reject application', busy: 'Rejecting…', tone: 'danger', variant: 'danger' },
};

const DEFAULT_NOTE: Record<ReviewDecision, string> = {
  approved: '',
  needs_resubmission: '',
  rejected: 'Credentials could not be verified against IBP records.',
};

export function ReviewDecisionModal({
  lawyer,
  decision,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  lawyer: LawyerQueueItem;
  decision: ReviewDecision;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState(DEFAULT_NOTE[decision]);
  const [now] = useState(() => Date.now());
  const config = CONFIG[decision];
  const needsNote = decision !== 'approved';
  const noteOk = !needsNote || note.trim().length >= 5;
  const name = formatAttorneyName(lawyer.full_name);

  return (
    <NeuModal
      onClose={onCancel}
      dismissible={!submitting}
      size="md"
      title={config.title}
      subtitle={`${lawyer.full_name} · Roll ${lawyer.roll_number}`}
      iconTone={config.tone}
      icon={
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={DECISION_GLYPH[decision]} />
        </svg>
      }
      footer={
        <>
          <NeuButton onClick={onCancel} disabled={submitting}>
            Cancel
          </NeuButton>
          <NeuButton variant={config.variant} loading={submitting} disabled={!noteOk} onClick={() => onConfirm(note)}>
            {submitting ? config.busy : config.confirm}
          </NeuButton>
        </>
      }
    >
      <dl className="admin-dossier-cell grid grid-cols-3 gap-3 rounded-[14px] px-4 py-3">
        {[
          ['Roll No.', lawyer.roll_number || '—'],
          ['IBP Chapter', lawyer.ibp_chapter || '—'],
          ['Submitted', lawyer.submitted_at ? stamp(lawyer.submitted_at, now).date : '—'],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{label}</dt>
            <dd className="mt-1 truncate font-lora text-[13.5px] font-semibold text-[#341512]">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="font-inter text-[13px] leading-relaxed text-[#5C4535]">
        {decision === 'approved' && (
          <>
            {name} will get full access to the lawyer portal, and their public profile will be listed in <strong className="text-[#341512]">Find a Lawyer</strong>.
          </>
        )}
        {decision === 'needs_resubmission' && <>The application returns to {name} with your message. It stays out of Find a Lawyer until they resubmit and you approve it.</>}
        {decision === 'rejected' && <>{name} will not be listed in Find a Lawyer. They will see your reason on their Application Status page.</>}
      </p>

      {needsNote && (
        <label className="flex flex-col gap-2">
          <span className={`text-[10px] text-[#B07A34] ${CAPS}`}>{decision === 'rejected' ? 'Reason for rejection' : 'Message to the applicant'}</span>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            placeholder={
              decision === 'rejected'
                ? 'e.g. The roll number does not match Supreme Court or IBP records.'
                : 'e.g. Please upload a clear photo of your IBP ID and current chapter clearance.'
            }
            className="lawyer-field min-h-[104px] w-full resize-y rounded-[12px] px-3.5 py-3 font-inter text-[12.5px] leading-relaxed text-[#341512] placeholder:text-[#9E8E7D] focus:outline-none"
          />
          <span className="font-inter text-[11px] text-[#7D6855]">Shown to the applicant on their Application Status page. At least 5 characters.</span>
        </label>
      )}

      {error && (
        <NeuAlert tone="error" title="The decision was not saved">
          {error}
        </NeuAlert>
      )}
    </NeuModal>
  );
}

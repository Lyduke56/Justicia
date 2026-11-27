'use client';

import { useEffect, useState } from 'react';
import { NeuButton, type NeuTone } from '@/components/shared/neu';
import { SubmitModal, useSubmission, type SubmissionCopy, type SubmissionResult } from '@/components/shared/feedback';
import { getAdminVerificationDocumentsAction } from '@/app/actions/lawyerVerificationDocs';
import { documentGaps, documentLabel, type PostApprovalAction, type ReviewDecision } from '@/lib/lawyer/verification';
import { formatAttorneyName } from '@/lib/utils/attorneyName';
import { CAPS, DECISION_GLYPH } from './ApplicationDossier';
import type { LawyerQueueItem } from './model';
import { stamp } from '../overview/activity';

/**
 * Confirms a verification decision in the shared neumorphic modal (the same frame as the client
 * and lawyer booking dialogs). Approving needs no note; asking for information or rejecting
 * takes a message the applicant sees on their Application Status page. Confirming morphs the
 * dialog into the submission loader, which then writes a check or an X.
 */

export type DossierDecision = ReviewDecision | PostApprovalAction;

const CONFIG: Record<DossierDecision, { title: string; confirm: string; busy: string; tone: NeuTone; variant: 'dark' | 'primary' | 'danger' }> = {
  approved: { title: 'Approve this lawyer?', confirm: 'Approve lawyer', busy: 'Approving the lawyer', tone: 'success', variant: 'dark' },
  needs_resubmission: { title: 'Request more information?', confirm: 'Send request', busy: 'Sending your request', tone: 'caramel', variant: 'primary' },
  rejected: { title: 'Reject this application?', confirm: 'Reject application', busy: 'Rejecting the application', tone: 'danger', variant: 'danger' },
  reverify: { title: 'Request re-verification?', confirm: 'Send request', busy: 'Sending your request', tone: 'caramel', variant: 'primary' },
  revoke: { title: 'Revoke this verification?', confirm: 'Revoke verification', busy: 'Revoking the verification', tone: 'danger', variant: 'danger' },
};

/** The result card once the decision is saved. */
function doneCopy(decision: DossierDecision, name: string): SubmissionCopy {
  switch (decision) {
    case 'approved':
      return { title: 'Lawyer approved', message: `${name} is now verified and listed in Find a Lawyer.` };
    case 'needs_resubmission':
      return { title: 'Request sent', message: `${name} will see your message on their Application Status page.` };
    case 'rejected':
      return { title: 'Application rejected', message: `${name} will see your reason on their Application Status page.` };
    case 'reverify':
      return { title: 'Re-verification requested', message: `${name} is hidden from Find a Lawyer until you approve new documents.` };
    case 'revoke':
      return { title: 'Verification revoked', message: `${name} no longer appears in Find a Lawyer or has portal access.` };
  }
}

const DEFAULT_NOTE: Record<DossierDecision, string> = {
  approved: '',
  needs_resubmission: '',
  rejected: 'Credentials could not be verified against IBP records.',
  reverify: '',
  revoke: '',
};

/** Post-approval actions need a longer explanation (they are separately audited). */
const MIN_NOTE: Record<DossierDecision, number> = { approved: 0, needs_resubmission: 5, rejected: 5, reverify: 10, revoke: 10 };

export function ReviewDecisionModal({
  lawyer,
  decision,
  onCancel,
  onConfirm,
  onDone,
}: {
  lawyer: LawyerQueueItem;
  decision: DossierDecision;
  onCancel: () => void;
  /** Saves the decision (`exception` is set when approving with incomplete documents). */
  onConfirm: (note: string, exception?: string) => Promise<SubmissionResult>;
  /** "Done" after the decision was saved. */
  onDone: () => void;
}) {
  const submission = useSubmission();
  const submitting = submission.processing;
  const close = () => {
    if (submitting) return;
    if (submission.phase === 'success') onDone();
    else onCancel();
  };
  const [note, setNote] = useState(DEFAULT_NOTE[decision]);
  const [exception, setException] = useState('');
  const [now] = useState(() => Date.now());
  const config = CONFIG[decision];
  const needsNote = decision !== 'approved';
  const name = formatAttorneyName(lawyer.full_name);

  // Approving checks the required proof documents first; gaps need a recorded exception.
  const [docCheck, setDocCheck] = useState<{ state: 'idle' | 'loading' | 'ready' | 'failed'; problems: string[] }>({
    state: decision === 'approved' ? 'loading' : 'idle',
    problems: [],
  });
  useEffect(() => {
    if (decision !== 'approved') return;
    let cancelled = false;
    getAdminVerificationDocumentsAction(lawyer.user_id)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setDocCheck({ state: 'failed', problems: [] });
          return;
        }
        const current = res.documents.filter((d) => !d.superseded);
        const gaps = documentGaps(current.map((d) => ({ docType: d.docType, reviewStatus: d.reviewStatus })));
        setDocCheck({
          state: 'ready',
          problems: [...gaps.missing.map((t) => `${documentLabel(t)} not uploaded`), ...gaps.rejected.map((t) => `${documentLabel(t)} rejected`)],
        });
      })
      .catch(() => {
        if (!cancelled) setDocCheck({ state: 'failed', problems: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [decision, lawyer.user_id]);
  const needsException = decision === 'approved' && (docCheck.problems.length > 0 || docCheck.state === 'failed');
  const noteOk =
    (!needsNote || note.trim().length >= MIN_NOTE[decision]) &&
    (!needsException || exception.trim().length >= 10) &&
    docCheck.state !== 'loading';

  return (
    <SubmitModal
      submission={submission}
      onClose={close}
      processing={{ title: config.busy, message: `${lawyer.full_name} · Roll ${lawyer.roll_number}` }}
      success={doneCopy(decision, name)}
      failure={{ title: 'The decision was not saved' }}
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
          <NeuButton onClick={close} disabled={submitting}>
            Cancel
          </NeuButton>
          <NeuButton
            variant={config.variant}
            disabled={!noteOk || submitting}
            onClick={() => void submission.run(() => onConfirm(note, needsException ? exception : undefined))}
          >
            {config.confirm}
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
        {decision === 'revoke' && <>{name} loses the verified status and leaves Find a Lawyer and the lawyer portal. They will see your reason on their Application Status page.</>}
        {decision === 'reverify' && <>{name} is hidden from Find a Lawyer and asked to upload new documents. They return once you approve the resubmission.</>}
      </p>

      {decision === 'approved' && docCheck.state === 'loading' && (
        <p role="status" className="font-inter text-[12px] text-[#7D6855]">Checking the required documents…</p>
      )}
      {needsException && (
        <label className="flex flex-col gap-2">
          <span className={`text-[10px] text-[#B07A34] ${CAPS}`}>Exception reason (required)</span>
          <span className="font-inter text-[12px] leading-relaxed text-[#5C4535]">
            {docCheck.state === 'failed'
              ? 'The documents could not be checked.'
              : `Required documents are incomplete: ${docCheck.problems.join(', ')}.`}{' '}
            To approve anyway, record why. This is saved in the security audit log.
          </span>
          <textarea
            rows={3}
            value={exception}
            onChange={(e) => setException(e.target.value)}
            disabled={submitting}
            placeholder="e.g. Credentials confirmed directly with the IBP chapter office on 25 Nov."
            className="lawyer-field min-h-[84px] w-full resize-y rounded-[12px] px-3.5 py-3 font-inter text-[12.5px] leading-relaxed text-[#341512] placeholder:text-[#9E8E7D] focus:outline-none"
          />
          <span className="font-inter text-[11px] text-[#7D6855]">At least 10 characters.</span>
        </label>
      )}

      {needsNote && (
        <label className="flex flex-col gap-2">
          <span className={`text-[10px] text-[#B07A34] ${CAPS}`}>{decision === 'rejected' ? 'Reason for rejection' : decision === 'revoke' ? 'Reason for revoking' : 'Message to the applicant'}</span>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            placeholder={
              decision === 'rejected' || decision === 'revoke'
                ? 'e.g. The roll number does not match Supreme Court or IBP records.'
                : 'e.g. Please upload a clear photo of your IBP ID and current chapter clearance.'
            }
            className="lawyer-field min-h-[104px] w-full resize-y rounded-[12px] px-3.5 py-3 font-inter text-[12.5px] leading-relaxed text-[#341512] placeholder:text-[#9E8E7D] focus:outline-none"
          />
          <span className="font-inter text-[11px] text-[#7D6855]">Shown to the applicant on their Application Status page. At least {MIN_NOTE[decision]} characters.</span>
        </label>
      )}

    </SubmitModal>
  );
}

'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  respondToConsultationAction,
  reviewPaymentAction,
  lawyerCancelConsultationAction,
  getDocumentAccessUrlAction,
  type LawyerConsultation,
} from '@/app/actions/consultationActions';
import {
  ConsultationDetailsModal,
  type ConsultationDetailsModalProps,
  type DetailsStatusTone,
} from '@/components/shared/ConsultationDetailsModal';
import { ConsultationDecisionModal, type DecisionMode } from '@/components/lawyer/ConsultationDecisionModal';
import { RescheduleModal, type RescheduleModalMode } from '@/components/shared/RescheduleModal';

/**
 * Lawyer-side consultation actions with their modals: View Details, approve / decline,
 * confirm / decline payment, cancel, reschedule, message and join. Same flows and server
 * actions as the Consultations tab, packaged so other views (the dashboard) can offer them.
 *
 * Sample records (id "demo-…") only open read-only details.
 */

/** Status pill text in the details view (designs use client-facing wording). */
export const DETAIL_STATUS_LABELS: Record<LawyerConsultation['status'], string> = {
  pending: 'PENDING CONFIRMATION',
  pending_payment: 'PENDING PAYMENT',
  payment_review: 'PAYMENT FOR REVIEW',
  confirmed: 'CONFIRMED APPOINTMENT',
  completed: 'COMPLETED',
  declined: 'DECLINED',
  cancelled: 'CANCELLED',
};

export function detailStatusTone(status: LawyerConsultation['status']): DetailsStatusTone {
  if (status === 'pending_payment') return 'red';
  if (status === 'payment_review') return 'amber';
  if (status === 'confirmed' || status === 'completed') return 'green';
  if (status === 'pending') return 'caramel';
  return 'grey';
}

export const isSample = (c: Pick<LawyerConsultation, 'id'>) => c.id.startsWith('demo-');

/** Lines under the client's name: age / sex, address (or how they meet), contact. */
export function clientLines(c: LawyerConsultation): string[] {
  const modeLine = c.communicationMode === 'video' ? 'Video Consultation (Google Meet)' : 'Audio Call (Google Meet)';
  const ageSex =
    c.client.age != null || c.client.sex
      ? `Age: ${c.client.age ?? 'Not provided'}  |  Sex: ${c.client.sex ?? 'Not provided'}`
      : '';
  return [ageSex, c.client.address ?? modeLine, `${c.client.email}  |  ${c.client.phone ?? 'No phone on file'}`];
}

export function canMessage(c: LawyerConsultation): boolean {
  return !isSample(c) && c.status !== 'declined' && c.status !== 'cancelled';
}

export function useLawyerConsultationActions({
  consultations,
  reload,
}: {
  consultations: LawyerConsultation[];
  reload: () => unknown;
}) {
  const router = useRouter();
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ mode: DecisionMode; id: string } | null>(null);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{ mode: RescheduleModalMode; id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const find = useCallback((id: string | null) => (id ? consultations.find((c) => c.id === id) ?? null : null), [consultations]);

  const openDetails = useCallback((c: LawyerConsultation) => {
    setDetailsError(null);
    setDetailsId(c.id);
  }, []);

  const openDecision = useCallback((mode: DecisionMode, id: string) => {
    if (id.startsWith('demo-')) return;
    setDecisionError(null);
    setDecision({ mode, id });
  }, []);

  const openMessages = useCallback(
    (c: LawyerConsultation) => {
      if (!canMessage(c)) return;
      router.push(`/lawyer/messages?thread=${c.id}`);
    },
    [router]
  );

  const joinMeet = useCallback((c: LawyerConsultation) => {
    if (isSample(c) || !c.meetingLink) return;
    window.open(c.meetingLink, '_blank', 'noopener,noreferrer');
  }, []);

  const openReschedule = useCallback((c: LawyerConsultation) => {
    if (isSample(c)) return;
    setDetailsId(null);
    setReschedule({
      id: c.id,
      mode: c.reschedule?.pending ? (c.reschedule.pending.byMe ? 'withdraw' : 'respond') : 'request',
    });
  }, []);

  const handleDecision = async (value?: string) => {
    if (!decision) return;
    setDecisionSubmitting(true);
    setDecisionError(null);
    try {
      const { mode, id } = decision;
      const res =
        mode === 'approve' || mode === 'decline'
          ? await respondToConsultationAction(id, mode === 'approve' ? 'approved' : 'rejected', value)
          : mode === 'confirm_payment'
            ? await reviewPaymentAction(id, 'confirm', { meetingLink: value })
            : mode === 'decline_payment'
              ? await reviewPaymentAction(id, 'reject', { reason: value })
              : await lawyerCancelConsultationAction(id, value ?? '');
      if (!('success' in res) || !res.success) {
        setDecisionError(('error' in res && res.error) || 'We could not update this consultation.');
        return;
      }
      setDecision(null);
      setDetailsId(null);
      await reload();
    } catch {
      setDecisionError('We could not update this consultation. Please try again.');
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const openProof = async (documentId: string) => {
    const res = await getDocumentAccessUrlAction(documentId);
    if ('url' in res && res.url) window.open(res.url, '_blank', 'noopener,noreferrer');
    else setDetailsError(('error' in res && res.error) || 'This file could not be opened.');
  };

  const buildDetailsProps = (c: LawyerConsultation): ConsultationDetailsModalProps => {
    const close = () => {
      setDetailsId(null);
      setDetailsError(null);
    };
    const paid = c.status === 'confirmed' || c.status === 'completed';
    const hasSummary = paid || c.status === 'pending_payment' || c.status === 'payment_review';
    const pd = c.paymentDetails;

    let detailNotice: ConsultationDetailsModalProps['notice'] = null;
    if (c.declineReason) detailNotice = { tone: 'red', title: 'Reason for Declining', text: c.declineReason };
    else if (c.cancellationReason) detailNotice = { tone: 'red', title: 'Reason for Cancellation', text: c.cancellationReason };
    else if (c.status === 'pending_payment' && pd.state === 'rejected' && pd.rejectionReason) {
      detailNotice = { tone: 'amber', title: 'You declined the previous proof of payment', text: pd.rejectionReason };
    } else if (c.reschedule?.pending) {
      const p = c.reschedule.pending;
      detailNotice = p.byMe
        ? {
            tone: 'amber',
            title: 'Reschedule request sent',
            text: `You asked to move this consultation to ${p.proposedDateLong}, ${p.proposedTimeRange}. Waiting for ${c.client.name} to answer.`,
          }
        : {
            tone: 'amber',
            title: `${c.client.name} asked to reschedule`,
            text: `Proposed new time: ${p.proposedDateLong}, ${p.proposedTimeRange}.\nReason: ${p.reason}`,
          };
    } else if (c.reschedule?.last?.byMe && c.reschedule.last.recent && ['declined', 'expired'].includes(c.reschedule.last.status)) {
      const last = c.reschedule.last;
      detailNotice = {
        tone: 'red',
        title: last.status === 'declined' ? 'Your reschedule request was declined' : 'Your reschedule request expired',
        text: `${last.proposedLabel} was not confirmed, so the original schedule stays.${last.responseReason ? `\nReason: ${last.responseReason}` : ''}`,
      };
    }

    let actions: ConsultationDetailsModalProps['actions'] = [{ label: 'Close', variant: 'caramel', onClick: close }];
    if (c.status === 'pending') {
      actions = [
        { label: 'Decline', variant: 'outline', onClick: () => openDecision('decline', c.id) },
        { label: 'Approve', variant: 'caramel', onClick: () => openDecision('approve', c.id) },
      ];
    } else if (c.status === 'payment_review') {
      actions = [
        { label: 'Decline', variant: 'outline', onClick: () => openDecision('decline_payment', c.id) },
        { label: 'Confirm Payment', variant: 'caramel', onClick: () => openDecision('confirm_payment', c.id) },
      ];
    } else if (c.status === 'confirmed') {
      actions = [
        { label: 'Cancel', variant: 'outline', onClick: () => openDecision('cancel', c.id) },
        {
          label: c.reschedule?.pending ? (c.reschedule.pending.byMe ? 'Withdraw Request' : 'Review Request') : 'Reschedule',
          variant: 'espresso',
          disabled: !c.reschedule?.pending && !c.reschedule?.canRequest,
          onClick: () => openReschedule(c),
        },
        { label: 'Join Meet', variant: 'caramel', icon: 'video', disabled: !c.meetingLink, onClick: () => joinMeet(c) },
      ];
    }
    if (isSample(c)) actions = [{ label: 'Close', variant: 'caramel', onClick: close }];

    const proofId = pd.proofDocumentId;
    return {
      dateStr: c.dateTag,
      timeSlot: c.timeTag,
      statusLabel: DETAIL_STATUS_LABELS[c.status],
      statusTone: detailStatusTone(c.status),
      person: {
        name: c.client.name,
        lines: clientLines(c),
        onMessage: canMessage(c) ? () => openMessages(c) : undefined,
      },
      docket: c.subjectCategory,
      caseTitle: c.subjectTitle,
      caseDescription: c.caseDescription,
      notice: detailNotice,
      summary: hasSummary
        ? {
            title: c.status === 'pending_payment' ? 'Booking Summary' : 'Payment Summary',
            lawyerName: c.lawyerSummary.name,
            lawyerMeta: `Roll No. ${c.lawyerSummary.rollNumber}  |  IBP ${c.lawyerSummary.ibpChapter}`,
            modeLabel: c.communicationMode === 'video' ? 'Video Conference' : 'Audio Call',
            modeMeta: `Platform: Google Meet  |  Duration: ${c.durationLabel}`,
            dateLong: c.dateLong,
            timeRange: c.timeRange,
            sessionFee: pd.sessionFee,
            platformFee: pd.platformFee,
            total: pd.total,
          }
        : null,
      proof:
        (c.status === 'payment_review' || paid) && pd.proofFileName
          ? { fileName: pd.proofFileName, onOpen: proofId ? () => openProof(proofId) : undefined }
          : null,
      error: detailsError,
      actions,
      onClose: close,
    };
  };

  const detailsTarget = find(detailsId);
  const decisionTarget = find(decision?.id ?? null);
  const rescheduleTarget = find(reschedule?.id ?? null);

  const modals = (
    <>
      {detailsTarget && <ConsultationDetailsModal {...buildDetailsProps(detailsTarget)} />}

      {decision && decisionTarget && (
        <ConsultationDecisionModal
          key={`${decision.mode}-${decision.id}`}
          mode={decision.mode}
          clientName={decisionTarget.client.name}
          when={`${decisionTarget.dateTag.replace('TODAY, ', '')} (${decisionTarget.timeTag})`}
          submitting={decisionSubmitting}
          error={decisionError}
          onCancel={() => !decisionSubmitting && setDecision(null)}
          onConfirm={handleDecision}
        />
      )}

      {reschedule && rescheduleTarget?.reschedule && (
        <RescheduleModal
          key={`${reschedule.mode}-${reschedule.id}`}
          mode={reschedule.mode}
          consultationId={rescheduleTarget.id}
          counterpartName={rescheduleTarget.client.name}
          currentLabel={`${rescheduleTarget.dateLong} · ${rescheduleTarget.timeRange}`}
          currentStart={rescheduleTarget.scheduledStart}
          pending={rescheduleTarget.reschedule.pending}
          remaining={rescheduleTarget.reschedule.remaining}
          onClose={() => setReschedule(null)}
          onDone={(message) => {
            setReschedule(null);
            setNotice(message);
            void reload();
          }}
        />
      )}
    </>
  );

  return {
    openDetails,
    openDecision,
    openMessages,
    joinMeet,
    openReschedule,
    notice,
    clearNotice: () => setNotice(null),
    /** True while any of the modals is open (e.g. to pause keyboard shortcuts). */
    anyOpen: detailsId !== null || decision !== null || reschedule !== null,
    modals,
  };
}

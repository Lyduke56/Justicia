'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LawyerConsultation } from '@/app/actions/consultationActions';
import {
  DetailsCaseBlock,
  DetailsPersonBanner,
  DetailsStatusRow,
} from '@/components/shared/ConsultationDetailsModal';
import { NeuAlert, NeuButton, VideoIcon } from '@/components/shared/neu';
import { canMessage, clientLines, isSample, statusLabelOf, statusToneOf } from './useLawyerConsultationActions';
import { CANCELLATION_CLOSED_MESSAGE, cancellationClosed, joinState, type ConsultationExtras } from '@/lib/consultations/extras';
import { usePeopleAvatars } from '@/components/account/avatarStore';
import { CARD_ITEM, CARD_POP } from './motion';

/**
 * One consultation, laid out like the client's Consultation Booking card (same shared status
 * row, person banner and case block), with the lawyer's actions for its status:
 *   pending          → Decline · View Details · Approve
 *   payment_review   → Review Payment
 *   confirmed        → Cancel · View Details · Join Meet
 *   anything else    → View Details
 *
 * Sizing: `previewLines` clamps the description to that many lines (natural height, used by the
 * dashboard and on narrow screens). `fill` makes the card fill its parent's height, with the
 * description taking the leftover space (the Consultations tab at xl, like the client card).
 */

export interface ConsultationCardHandlers {
  onDetails: (c: LawyerConsultation) => void;
  onMessage: (c: LawyerConsultation) => void;
  onCancel: (c: LawyerConsultation) => void;
  onJoin: (c: LawyerConsultation) => void;
  onDocuments: () => void;
  onApprove?: (c: LawyerConsultation) => void;
  onDecline?: (c: LawyerConsultation) => void;
  onReschedule?: (c: LawyerConsultation) => void;
  /** Open the client's cancellation request (accept / decline). */
  onReviewCancellation?: (c: LawyerConsultation) => void;
}

const BTN_BASE =
  'px-5 sm:px-6 py-2 rounded-[12px] font-lora text-xs transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';
const OUTLINE = `${BTN_BASE} border border-[#341512]/50 bg-[#E5D8CB] font-semibold text-[#341512] shadow-sm hover:bg-[#DDCFC0]`;
const ESPRESSO = `${BTN_BASE} neu-btn-espresso bg-[#4A2E25] font-semibold text-white hover:brightness-110`;
const CARAMEL = `${BTN_BASE} neu-btn-caramel relative flex items-center gap-1.5 bg-[#D49E56] font-bold text-[#341512] hover:brightness-105`;

const SAMPLE_TITLE = 'Sample consultation: actions are unavailable';

export function LawyerConsultationCard({
  c,
  previewLines = 3,
  fill = false,
  extras = null,
  now = 0,
  ...h
}: {
  c: LawyerConsultation;
  previewLines?: number;
  fill?: boolean;
  /** Attendance and cancellation request (useConsultationExtras). */
  extras?: ConsultationExtras | null;
  /** Current time for the session window (epoch ms). */
  now?: number;
} & ConsultationCardHandlers) {
  const sample = isSample(c);
  const clientPhoto = usePeopleAvatars(sample ? [] : [c.clientId])[c.clientId] ?? null;
  // Samples show the button too (it does nothing), but never on a closed consultation.
  const messageable = canMessage(c) || (sample && c.status !== 'declined' && c.status !== 'cancelled');
  const shared = c.attachedFiles.length;
  const pendingReschedule = c.reschedule?.pending ?? null;
  const ax = c.status === 'confirmed' ? extras : null;
  // Once the session is over (or missed) there is nothing left to cancel or join.
  const sessionOver = !!ax?.attendance.missed || (!!now && joinState(ax?.attendance, now) === 'ended');
  const cancelRequest = !sessionOver ? ax?.cancellation.pending ?? null : null;
  // Cancelling closes 24 hours before the start (the button stays, disabled).
  const cancelClosed = !sample && !!now && cancellationClosed(c.scheduledStart, now);

  return (
    <div className={`flex flex-col gap-4 sm:gap-5 ${fill ? 'xl:min-h-0 xl:flex-1' : ''}`}>
      <motion.div variants={CARD_POP} className="shrink-0">
        <DetailsStatusRow
          fit
          dateStr={c.dateTag}
          timeSlot={c.timeTag}
          statusLabel={statusLabelOf(c, ax)}
          statusTone={statusToneOf(c, ax)}
        />
      </motion.div>

      <AnimatePresence initial={false}>
        {cancelRequest && h.onReviewCancellation && (
          <NeuAlert
            key="cancellation"
            tone="warning"
            className="shrink-0"
            title={`${c.client.name} asked to cancel`}
            action={
              <NeuButton size="sm" variant="secondary" onClick={() => h.onReviewCancellation?.(c)}>
                Review
              </NeuButton>
            }
          >
            Reason: {cancelRequest.reason}
          </NeuAlert>
        )}
        {pendingReschedule && h.onReschedule && (
          <NeuAlert
            key="reschedule"
            tone="warning"
            className="shrink-0"
            title={pendingReschedule.byMe ? 'Reschedule request sent' : `${c.client.name} asked to reschedule`}
            action={
              <NeuButton size="sm" variant="secondary" onClick={() => h.onReschedule?.(c)}>
                {pendingReschedule.byMe ? 'Withdraw' : 'Review'}
              </NeuButton>
            }
          >
            {pendingReschedule.byMe ? 'You asked to move this consultation to ' : 'Proposed new time: '}
            <strong className="font-semibold">
              {pendingReschedule.proposedDateLong}, {pendingReschedule.proposedTimeRange}
            </strong>
            {pendingReschedule.byMe ? '. Waiting for an answer.' : '.'}
          </NeuAlert>
        )}
      </AnimatePresence>

      <motion.div variants={CARD_ITEM} className="shrink-0">
        <DetailsPersonBanner
          person={{ name: c.client.name, lines: clientLines(c), onMessage: messageable ? () => h.onMessage(c) : undefined, photo: clientPhoto }}
        />
      </motion.div>

      <motion.div variants={CARD_ITEM} className={`flex flex-col ${fill ? 'xl:min-h-0 xl:flex-1' : ''}`}>
        <DetailsCaseBlock
          docket={c.subjectCategory}
          caseTitle={c.subjectTitle}
          caseDescription={c.caseDescription}
          onSeeMore={() => h.onDetails(c)}
          previewLines={fill ? undefined : previewLines}
        />
      </motion.div>

      <motion.div variants={CARD_ITEM} className="flex shrink-0 flex-col gap-3 pt-1 lg:flex-row lg:items-center lg:justify-between">
        {shared > 0 ? (
          <p className="font-lora text-[10.5px] font-bold uppercase tracking-wider text-[#C58B3C]">
            This client shared {shared} document{shared === 1 ? '' : 's'} with you.{' '}
            <button type="button" onClick={h.onDocuments} className="cursor-pointer uppercase underline underline-offset-2 transition-colors hover:text-[#99431E]">
              View documents
            </button>
          </p>
        ) : (
          <p className="font-lora text-[10.5px] font-bold uppercase tracking-wider text-[#9E8E7D]">No documents shared for this consultation.</p>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {c.status === 'pending' && h.onDecline && (
            <button type="button" onClick={() => h.onDecline?.(c)} disabled={sample} title={sample ? SAMPLE_TITLE : undefined} className={OUTLINE}>
              Decline
            </button>
          )}
          {c.status === 'confirmed' && !sessionOver && (
            <button
              type="button"
              onClick={() => h.onCancel(c)}
              disabled={sample || cancelClosed}
              title={sample ? SAMPLE_TITLE : cancelClosed ? CANCELLATION_CLOSED_MESSAGE : undefined}
              className={OUTLINE}
            >
              Cancel
            </button>
          )}
          <button type="button" onClick={() => h.onDetails(c)} className={ESPRESSO}>
            {c.status === 'payment_review' ? 'Review Payment' : 'View Details'}
          </button>
          {c.status === 'pending' && h.onApprove && (
            <button type="button" onClick={() => h.onApprove?.(c)} disabled={sample} title={sample ? SAMPLE_TITLE : undefined} className={CARAMEL}>
              Approve
            </button>
          )}
          {c.status === 'confirmed' && !sessionOver && (
            <button
              type="button"
              onClick={() => h.onJoin(c)}
              disabled={sample || !c.meetingLink}
              title={sample ? 'Sample consultation: the meeting is unavailable' : !c.meetingLink ? 'The meeting link is not set yet' : undefined}
              className={CARAMEL}
            >
              {c.meetingLink && (
                <span aria-hidden="true" className="absolute -right-1 -top-1 size-2.5">
                  <span className="neu-beacon absolute inset-0 rounded-full bg-[#1FAA00]" />
                  <span className="absolute inset-0 rounded-full bg-[#1FAA00] ring-2 ring-[#E5D8CB]" />
                </span>
              )}
              <VideoIcon className="h-3.5 w-3.5 text-[#341512]" />
              <span>Join Meet</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

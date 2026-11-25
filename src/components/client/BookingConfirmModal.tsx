'use client';

/**
 * Booking confirmation dialog for the client booking flow, built on the shared SubmissionModal.
 *
 *  review     → full-size sheet with every booking detail and "Confirm & Submit".
 *  submitting → the sheet fades, the panel shrinks to a compact card, and a single caramel line
 *               runs around a pressed-in groove while the request is saved.
 *  success    → the same line writes the check mark, turning green as it lands, while the centre
 *               of the groove rises. A caramel bead keeps circling: the request now waits on the
 *               attorney.
 *  error      → the line writes an X instead and the card explains what went wrong, with
 *               "Review Booking" (back to the sheet, error on top) and "Close".
 *
 * Render inside <AnimatePresence> so the overlay and panel animate out when it closes.
 */
import {
  DetailsStatusRow,
  DetailsPersonBanner,
  DetailsCaseBlock,
} from '@/components/shared/ConsultationDetailsModal';
import { NeuAlert, NeuButton, NeuModalSheet, CalendarClockIcon, FileIcon } from '@/components/shared/neu';
import { SubmissionModal, type SubmissionPhase } from '@/components/shared/feedback';

export type BookingConfirmPhase = 'review' | 'submitting' | 'success' | 'error';

export interface BookingConfirmDetails {
  dateStr: string;
  timeSlot: string;
  communicationMode: 'video' | 'audio';
  lawyerName: string;
  lawyerLines: string[];
  rate: number | null;
  subject: string;
  description: string;
  attachments: Array<{ id: string; name: string; size: string }>;
}

interface BookingConfirmModalProps {
  phase: BookingConfirmPhase;
  details: BookingConfirmDetails;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
  /** Back to the review sheet after a failed submission. */
  onRetry: () => void;
}

const PHASES: Record<BookingConfirmPhase, SubmissionPhase> = {
  review: 'idle',
  submitting: 'processing',
  success: 'success',
  error: 'error',
};

const TITLE_ID = 'booking-confirm-title';

export function BookingConfirmModal({ phase, details, error, onConfirm, onClose, onRetry }: BookingConfirmModalProps) {
  const modeLabel = details.communicationMode === 'video' ? 'Video Consultation' : 'Audio Call';

  return (
    <SubmissionModal
      phase={PHASES[phase]}
      titleId={TITLE_ID}
      size="xl"
      onClose={onClose}
      onRetry={onRetry}
      error={error}
      waitingAfterSuccess
      processing={{ title: 'Submitting your booking', message: `Sending your request to ${details.lawyerName}.` }}
      success={{
        title: 'Booking submitted',
        message: `${details.lawyerName} has your request. We'll notify you once they approve it, and payment is only requested after that.`,
      }}
      failure={{ title: "We couldn't submit your booking", retryLabel: 'Review Booking' }}
      details={
        <>
          <span className="neu-raised-pill bg-[#E5D8CB] rounded-full px-4 py-1.5 font-lora text-[10.5px] font-bold uppercase tracking-wider text-[#5C4535]">
            {details.dateStr}
          </span>
          <span className="neu-raised-pill bg-[#E5D8CB] rounded-full px-4 py-1.5 font-lora text-[10.5px] font-bold text-[#5C4535]">
            {details.timeSlot}
          </span>
        </>
      }
    >
      <NeuModalSheet
        titleId={TITLE_ID}
        title="Confirm your booking"
        subtitle={`Check the details below before sending your request to ${details.lawyerName}.`}
        icon={<CalendarClockIcon className="w-5 h-5" />}
        onClose={onClose}
        footer={
          <>
            <NeuButton key="edit" variant="secondary" onClick={onClose}>
              Edit Booking
            </NeuButton>
            <NeuButton key="confirm" variant="primary" onClick={onConfirm} autoFocus>
              Confirm &amp; Submit
            </NeuButton>
          </>
        }
      >
        {error && (
          <NeuAlert key="error" tone="error" title="We couldn't submit your booking">
            {error}
          </NeuAlert>
        )}
        <DetailsStatusRow dateStr={details.dateStr} timeSlot={details.timeSlot} statusLabel={modeLabel} statusTone="caramel" />
        <DetailsPersonBanner person={{ name: details.lawyerName, lines: details.lawyerLines, rate: details.rate }} />
        <DetailsCaseBlock
          docket="SUBJECT MATTER & CASE DOCKET"
          caseTitle={details.subject}
          caseDescription={details.description || 'No additional details were provided for this consultation.'}
        />
        {details.attachments.length > 0 && (
          <div className="space-y-2.5">
            <p className="font-lora text-xs font-bold uppercase tracking-wider text-[#5C4535]">
              Shared documents ({details.attachments.length})
            </p>
            <ul className="flex flex-wrap gap-2.5">
              {details.attachments.map((f) => (
                <li
                  key={f.id}
                  className="neu-raised-pill bg-[#E5D8CB] flex max-w-full items-center gap-2 rounded-full px-4 py-2 font-inter text-[11px] sm:text-xs text-[#341512]"
                >
                  <FileIcon className="w-3.5 h-3.5 shrink-0 text-[#C58B3C]" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-[#5C4535]">{f.size}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="font-inter text-[11.5px] sm:text-xs text-[#5C4535] leading-relaxed">
          Your request goes to the attorney for approval. You will only be asked to pay after they approve it.
        </p>
      </NeuModalSheet>
    </SubmissionModal>
  );
}

export default BookingConfirmModal;

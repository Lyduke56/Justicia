'use client';

/**
 * Cancellation requests for paid (confirmed) consultations, in the shared neumorphic modal frame
 * (same parts as the reschedule dialogs):
 *  - request:  the client explains why they want to cancel; the attorney has to approve it
 *  - withdraw: the client takes their open request back
 *  - respond:  the attorney accepts (booking cancelled, refund pending) or declines with a reason
 */
import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  requestCancellationAction,
  respondToCancellationRequestAction,
  withdrawCancellationRequestAction,
} from '@/app/actions/consultationExtrasActions';
import { CANCELLATION_REASON_MAX, CANCELLATION_REASON_MIN } from '@/lib/consultations/extras';
import { AlertIcon, CalendarIcon, CheckCircleIcon, ClockIcon, NeuAlert, NeuButton, NeuModal } from '@/components/shared/neu';

export type CancellationModalMode = 'request' | 'withdraw' | 'respond';

const labelClass = 'block font-lora text-[11px] font-bold uppercase tracking-[0.14em] text-[#946525]';
const textareaClass =
  'neu-input w-full rounded-[20px] py-4 px-5 font-inter text-xs sm:text-sm text-[#23150F] leading-relaxed resize-y';

interface CancellationRequestModalProps {
  open: boolean;
  mode: CancellationModalMode;
  consultationId: string;
  /** The other participant: the attorney (client side) or the client (lawyer side). */
  counterpartName: string;
  dateLong: string;
  timeRange: string;
  /** The open request's reason (withdraw / respond). */
  requestReason?: string | null;
  onClose: () => void;
  /** Called after a successful change with a confirmation to show. */
  onDone: (message: string) => void;
}

function ScheduleCard({ name, dateLong, timeRange }: { name: string; dateLong: string; timeRange: string }) {
  return (
    <div className="neu-raised bg-[#E5D8CB] rounded-[22px] p-4 sm:p-5 space-y-3">
      <p className="font-lora text-base font-bold text-[#341512] leading-tight">{name}</p>
      <div className="border-t border-dotted border-[#C8B59E] pt-3 space-y-2 font-inter text-xs sm:text-[13px] text-[#3E2A1E]">
        <p className="flex items-center gap-2.5">
          <CalendarIcon className="w-4 h-4 text-[#C58B3C] shrink-0" />
          {dateLong}
        </p>
        <p className="flex items-center gap-2.5">
          <ClockIcon className="w-4 h-4 text-[#C58B3C] shrink-0" />
          {timeRange}
        </p>
      </div>
    </div>
  );
}

function ReasonQuote({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-3.5">
      <p className={labelClass}>{label}</p>
      <blockquote className="neu-recessed rounded-[20px] px-5 py-4 sm:px-6 sm:py-5 font-inter text-xs sm:text-[13px] leading-relaxed text-[#3E2A1E] whitespace-pre-line">
        {text}
      </blockquote>
    </div>
  );
}

function ReasonField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const length = value.trim().length;
  return (
    <div className="space-y-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <span className={`font-inter text-[10.5px] ${length > 0 && length < CANCELLATION_REASON_MIN ? 'text-[#B42318]' : 'text-[#7D6855]'}`}>
          {length > 0 && length < CANCELLATION_REASON_MIN ? `At least ${CANCELLATION_REASON_MIN} characters · ` : ''}
          {value.length}/{CANCELLATION_REASON_MAX}
        </span>
      </div>
      <textarea
        id={id}
        rows={4}
        maxLength={CANCELLATION_REASON_MAX}
        autoFocus
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={textareaClass}
      />
    </div>
  );
}

function ModalBody({
  mode,
  consultationId,
  counterpartName,
  dateLong,
  timeRange,
  requestReason,
  onClose,
  onDone,
}: Omit<CancellationRequestModalProps, 'open'>) {
  const [reason, setReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => !submitting && onClose();

  const run = async (call: () => Promise<{ success?: boolean; error?: string }>, message: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await call();
      if (!res.success) {
        setError(res.error || 'This could not be saved. Please try again.');
        return;
      }
      onDone(message);
    } catch {
      setError('This could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'request') {
    const ready = reason.trim().length >= CANCELLATION_REASON_MIN;
    return (
      <NeuModal
        onClose={close}
        dismissible={!submitting}
        size="md"
        icon={<AlertIcon className="w-5 h-5" />}
        iconTone="danger"
        title="Request a cancellation?"
        subtitle={
          <>
            Your payment is already confirmed, so <strong className="font-semibold text-[#341512]">{counterpartName}</strong> has to
            approve the cancellation. Until then, the consultation stays booked.
          </>
        }
        footer={
          <>
            <NeuButton variant="secondary" onClick={close} disabled={submitting}>
              Keep Consultation
            </NeuButton>
            <NeuButton
              variant="danger"
              disabled={!ready}
              loading={submitting}
              onClick={() => run(() => requestCancellationAction(consultationId, reason), `Your cancellation request was sent to ${counterpartName}.`)}
            >
              {submitting ? 'Sending…' : 'Send Request'}
            </NeuButton>
          </>
        }
      >
        <ScheduleCard name={counterpartName} dateLong={dateLong} timeRange={timeRange} />
        <ReasonField
          id="cancellation-reason"
          label="Reason for cancelling"
          value={reason}
          onChange={setReason}
          disabled={submitting}
          placeholder={`Let ${counterpartName} know why you need to cancel.`}
        />
        <NeuAlert tone="info">If the attorney accepts, the consultation is cancelled and your payment is marked for a refund.</NeuAlert>
        {error && <NeuAlert tone="error">{error}</NeuAlert>}
      </NeuModal>
    );
  }

  if (mode === 'withdraw') {
    return (
      <NeuModal
        onClose={close}
        dismissible={!submitting}
        size="md"
        icon={<AlertIcon className="w-5 h-5" />}
        title="Withdraw your request?"
        subtitle={
          <>
            You asked <strong className="font-semibold text-[#341512]">{counterpartName}</strong> to cancel this consultation.
            Withdrawing keeps it booked.
          </>
        }
        footer={
          <>
            <NeuButton variant="secondary" onClick={close} disabled={submitting}>
              Keep Request
            </NeuButton>
            <NeuButton
              variant="primary"
              loading={submitting}
              onClick={() => run(() => withdrawCancellationRequestAction(consultationId), 'Your cancellation request was withdrawn. The consultation stays booked.')}
            >
              {submitting ? 'Withdrawing…' : 'Withdraw Request'}
            </NeuButton>
          </>
        }
      >
        <ScheduleCard name={counterpartName} dateLong={dateLong} timeRange={timeRange} />
        {requestReason && <ReasonQuote label="Your reason" text={requestReason} />}
        {error && <NeuAlert tone="error">{error}</NeuAlert>}
      </NeuModal>
    );
  }

  // respond (lawyer)
  return (
    <NeuModal
      onClose={close}
      dismissible={!submitting}
      size="lg"
      bodyClassName="space-y-7 sm:space-y-8"
      icon={<AlertIcon className="w-5 h-5" />}
      iconTone="danger"
      title="Cancellation Request"
      subtitle={
        <>
          <strong className="font-semibold text-[#341512]">{counterpartName}</strong> asked to cancel this paid consultation. If you
          accept, it is cancelled and the payment is marked for a refund. If you decline, it stays booked.
        </>
      }
      footer={
        declining ? (
          <>
            <NeuButton variant="secondary" onClick={() => setDeclining(false)} disabled={submitting}>
              Back
            </NeuButton>
            <NeuButton
              variant="danger"
              disabled={reason.trim().length < CANCELLATION_REASON_MIN}
              loading={submitting}
              onClick={() =>
                run(() => respondToCancellationRequestAction(consultationId, 'decline', reason), 'You declined the request. The consultation stays booked.')
              }
            >
              {submitting ? 'Declining…' : 'Decline Request'}
            </NeuButton>
          </>
        ) : (
          <>
            <NeuButton
              variant="secondary"
              onClick={() => {
                setError(null);
                setDeclining(true);
              }}
              disabled={submitting}
            >
              Decline
            </NeuButton>
            <NeuButton
              variant="primary"
              loading={submitting}
              icon={<CheckCircleIcon className="w-4 h-4" />}
              onClick={() =>
                run(
                  () => respondToCancellationRequestAction(consultationId, 'accept'),
                  'You accepted the cancellation. The consultation is cancelled and the refund is pending.'
                )
              }
            >
              {submitting ? 'Accepting…' : 'Accept Cancellation'}
            </NeuButton>
          </>
        )
      }
    >
      <ScheduleCard name={counterpartName} dateLong={dateLong} timeRange={timeRange} />
      {requestReason && <ReasonQuote label={`Reason from ${counterpartName}`} text={requestReason} />}
      {declining && (
        <ReasonField
          id="cancellation-decline-reason"
          label="Reason for declining"
          value={reason}
          onChange={setReason}
          disabled={submitting}
          placeholder="e.g. The session is less than a day away and the slot can no longer be given to another client."
        />
      )}
      {error && <NeuAlert tone="error">{error}</NeuAlert>}
    </NeuModal>
  );
}

export function CancellationRequestModal({ open, ...props }: CancellationRequestModalProps) {
  return <AnimatePresence>{open && <ModalBody key={`${props.mode}-${props.consultationId}`} {...props} />}</AnimatePresence>;
}

export default CancellationRequestModal;

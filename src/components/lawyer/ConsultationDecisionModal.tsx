'use client';

import React, { useEffect, useState } from 'react';

export type DecisionMode = 'approve' | 'decline' | 'confirm_payment' | 'decline_payment' | 'cancel';

interface ConsultationDecisionModalProps {
  mode: DecisionMode;
  clientName: string;
  /** e.g. "NOVEMBER 26, 2026 (2:00 PM - 3:00 PM • PST, GMT+8)" */
  when: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  /** Receives the reason (decline / decline_payment / cancel) or the Google Meet link (confirm_payment). */
  onConfirm: (value?: string) => void;
}

interface ModeConfig {
  title: string;
  confirmLabel: string;
  submittingLabel: string;
  paragraphs: (client: string, when: string) => React.ReactNode[];
  /** Second step input, if any. */
  input?: {
    kind: 'reason' | 'meetLink';
    placeholder: string;
    validate: (value: string) => boolean;
    hint?: string;
  };
}

/** Any Google Meet link: must start with https://meet.google.com; whatever follows is accepted. */
const MEET_REGEX = /^https:\/\/meet\.google\.com(?:[/?#]\S*)?$/i;
const reasonInput = (placeholder: string): ModeConfig['input'] => ({
  kind: 'reason',
  placeholder,
  validate: (v) => v.trim().length >= 5,
});

const MODES: Record<DecisionMode, ModeConfig> = {
  approve: {
    title: 'Approve Consultation?',
    confirmLabel: 'Approve',
    submittingLabel: 'Approving...',
    paragraphs: (client, when) => [
      <>
        You are about to approve the consultation request of <strong>{client}</strong> on <strong>{when}</strong>.
        Once approved, the booking moves to <strong>Pending Payment</strong> and the client will be asked to settle
        the consultation fee to confirm the session. The time slot stays reserved for this client while payment is
        pending.
      </>,
      <>
        A private message thread with the client opens right away so you can coordinate before the session. You
        will share the Google Meet link when you confirm the client&apos;s payment.
      </>,
    ],
  },
  decline: {
    title: 'Decline Consultation?',
    confirmLabel: 'Decline',
    submittingLabel: 'Submitting...',
    paragraphs: (client, when) => [
      <>
        You are about to decline the consultation request of <strong>{client}</strong> on <strong>{when}</strong>.
        The client will be notified, the time slot will become available to other clients, and your access to the
        documents shared for this request will be removed.
      </>,
      <>
        On the next step, please provide your reason for declining. It will be sent to the client so they
        understand your decision and can book another schedule or attorney if needed.
      </>,
    ],
    input: reasonInput('Please provide reason as to why you want to decline this consultation.'),
  },
  confirm_payment: {
    title: 'Confirm Payment?',
    confirmLabel: 'Confirm Payment',
    submittingLabel: 'Confirming...',
    paragraphs: (client, when) => [
      <>
        Please make sure the payment of <strong>{client}</strong> for the consultation on <strong>{when}</strong>{' '}
        was received in full. Once confirmed, the booking becomes a <strong>Confirmed Appointment</strong> and the
        client is notified.
      </>,
      <>
        On the next step, paste the Google Meet link for this session. It will be sent to the client and shown on
        both of your consultation pages so you can join at the scheduled time.
      </>,
    ],
    input: {
      kind: 'meetLink',
      placeholder: 'https://meet.google.com/...',
      validate: (v) => MEET_REGEX.test(v.trim()),
      hint: 'Create the meeting in Google Meet or Google Calendar, then paste its link here.',
    },
  },
  decline_payment: {
    title: 'Decline Payment?',
    confirmLabel: 'Decline',
    submittingLabel: 'Submitting...',
    paragraphs: (client, when) => [
      <>
        You are about to decline the proof of payment submitted by <strong>{client}</strong> for the consultation on{' '}
        <strong>{when}</strong>. The booking stays in <strong>Pending Payment</strong> and the client will be asked
        to upload a new proof of payment.
      </>,
      <>
        On the next step, please explain why the payment could not be verified (e.g. wrong amount or unreadable
        receipt). Your reason will be sent to the client.
      </>,
    ],
    input: reasonInput('Please provide reason as to why you want to decline this payment.'),
  },
  cancel: {
    title: 'Cancel Consultation?',
    confirmLabel: 'Cancel Consultation',
    submittingLabel: 'Submitting...',
    paragraphs: (client, when) => [
      <>
        You are about to cancel your consultation with <strong>{client}</strong> on <strong>{when}</strong>. The
        client will be notified, and if they have already paid, the booking will be flagged for a refund.
      </>,
      <>On the next step, please provide your reason for cancelling. It will be sent to the client.</>,
    ],
    input: reasonInput('Please provide reason as to why you want to cancel this consultation.'),
  },
};

const CARD_SHADOW = '16px 16px 40px rgba(0,0,0,0.22), -8px -8px 24px rgba(255,255,255,0.55)';
const TITLE_PLATE_SHADOW =
  '6px 8px 16px rgba(165, 135, 105, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.8)';
const PRIMARY_SHADOW = '0 6px 16px rgba(212, 158, 86, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)';
const INSET_SHADOW = 'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)';

/**
 * Confirmation dialogs in the design2 style (public/modal-design/design2.png).
 * Modes with an input are two steps: confirm → provide reason / meeting link → submit.
 */
export function ConsultationDecisionModal({
  mode,
  clientName,
  when,
  submitting,
  error,
  onCancel,
  onConfirm,
}: ConsultationDecisionModalProps) {
  const config = MODES[mode];
  const [step, setStep] = useState<'confirm' | 'input'>('confirm');
  const [value, setValue] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  const showInput = !!config.input && step === 'input';
  const valid = !config.input || !showInput || config.input.validate(value);

  const handlePrimary = () => {
    if (config.input && step === 'confirm') return setStep('input');
    onConfirm(config.input ? value.trim() : undefined);
  };

  const primaryLabel = submitting
    ? config.submittingLabel
    : showInput
      ? 'Submit'
      : config.confirmLabel;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consultation-decision-title"
      onClick={() => !submitting && onCancel()}
    >
      <div
        className="w-full max-w-2xl rounded-[28px] p-7 sm:p-10 bg-[#E8DCCD] space-y-6"
        style={{ boxShadow: CARD_SHADOW }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <h3
            id="consultation-decision-title"
            className="px-10 sm:px-16 py-3 rounded-xl bg-[#E3CAA9] font-lora text-xl sm:text-2xl font-bold text-[#5C4535] text-center"
            style={{ boxShadow: TITLE_PLATE_SHADOW }}
          >
            {config.title}
          </h3>
        </div>

        {showInput && config.input ? (
          <div className="space-y-2">
            {config.input.kind === 'meetLink' ? (
              <input
                type="url"
                value={value}
                autoFocus
                onChange={(e) => setValue(e.target.value)}
                placeholder={config.input.placeholder}
                className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none"
                style={{ boxShadow: INSET_SHADOW }}
              />
            ) : (
              <textarea
                rows={5}
                value={value}
                autoFocus
                maxLength={1000}
                onChange={(e) => setValue(e.target.value)}
                placeholder={config.input.placeholder}
                className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none resize-y"
                style={{ boxShadow: INSET_SHADOW }}
              />
            )}
            {config.input.hint && <p className="text-[11px] text-[#7D6855]">{config.input.hint}</p>}
          </div>
        ) : (
          <div className="space-y-2 text-xs sm:text-[13px] text-[#4A3525] leading-relaxed text-justify">
            {config.paragraphs(clientName, when).map((p, idx) => (
              <p key={idx} className="indent-6">
                {p}
              </p>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs font-semibold text-red-800 bg-red-100 border border-red-300 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-center gap-6 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-w-[130px] px-8 py-2 rounded-xl border border-[#4A3525] text-xs sm:text-sm font-lora font-bold text-[#4A3525] hover:bg-[#E0D2C0] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={submitting || !valid}
            className="min-w-[130px] px-8 py-2 rounded-xl bg-[#D9A86C] text-xs sm:text-sm font-lora font-bold text-[#4A3525] transition-all hover:brightness-105 active:scale-95 disabled:opacity-50"
            style={{ boxShadow: PRIMARY_SHADOW }}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConsultationDecisionModal;

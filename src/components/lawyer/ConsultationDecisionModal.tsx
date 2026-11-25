'use client';

/**
 * The lawyer's consultation decisions in one dialog: approve, decline, confirm payment (with the
 * Google Meet link), decline payment and cancel.
 *
 *  1. Review   – what is being decided (client, schedule, subject, payment) and what happens next.
 *  2. Input    – modes that need it: the reason, or the meeting link (with paste + validation).
 *  3. Submit   – the dialog morphs into the shared submission card: the line circles while the
 *                request runs, then writes a check (done) or an X (failed, with "Try Again").
 *
 * The server actions and their rules are unchanged; `onSubmit` runs them and reports the result.
 * Render inside <AnimatePresence> so the dialog animates out when it closes.
 */
import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  NeuAlert,
  NeuButton,
  NeuModalSheet,
  type NeuTone,
  AlertIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardIcon,
  CloseIcon,
  ExternalLinkIcon,
  FileIcon,
  LinkIcon,
  PhoneIcon,
  UserIcon,
  VideoIcon,
  WalletIcon,
} from '@/components/shared/neu';
import {
  SubmissionModal,
  useSubmission,
  type SubmissionCopy,
  type SubmissionResult,
} from '@/components/shared/feedback';

export type DecisionMode = 'approve' | 'decline' | 'confirm_payment' | 'decline_payment' | 'cancel';

/** What the lawyer is deciding on, snapshotted when the dialog opens. */
export interface DecisionSummary {
  clientName: string;
  /** e.g. "November 26, 2026" */
  dateLong: string;
  /** e.g. "2:00 PM - 3:00 PM" */
  timeRange: string;
  /** Short pills on the result card. */
  dateTag: string;
  timeTag: string;
  communicationMode?: 'video' | 'audio';
  durationLabel?: string;
  subjectCategory?: string;
  subjectTitle?: string;
  payment?: {
    sessionFee: number;
    platformFee: number;
    total: number;
    proofFileName?: string | null;
    onOpenProof?: () => void;
  } | null;
}

interface ConsultationDecisionModalProps {
  mode: DecisionMode;
  summary: DecisionSummary;
  /** Runs the server action with the reason or meeting link; resolves with its result. */
  onSubmit: (value?: string) => Promise<SubmissionResult>;
  /** `succeeded` is true when the dialog closes after a successful submission. */
  onClose: (succeeded: boolean) => void;
}

interface InputConfig {
  kind: 'reason' | 'meetLink';
  title: string;
  subtitle: (client: string) => string;
  label: string;
  placeholder: string;
  validate: (value: string) => boolean;
}

interface ModeConfig {
  title: string;
  subtitle: (client: string) => string;
  icon: React.ReactNode;
  tone: NeuTone;
  confirmLabel: string;
  /** Destructive decisions submit with the red button. */
  destructive: boolean;
  /** "What happens next", shown on the review step. */
  outcomes: (client: string) => React.ReactNode[];
  input?: InputConfig;
  processing: (client: string) => SubmissionCopy;
  success: (client: string) => SubmissionCopy;
  failure: string;
}

/** Any Google Meet link: must start with https://meet.google.com; whatever follows is accepted. */
const MEET_REGEX = /^https:\/\/meet\.google\.com(?:[/?#]\S*)?$/i;
const REASON_MIN = 5;
const REASON_MAX = 1000;

const reasonInput = (title: string, label: string, placeholder: string, subtitle: InputConfig['subtitle']): InputConfig => ({
  kind: 'reason',
  title,
  subtitle,
  label,
  placeholder,
  validate: (v) => v.trim().length >= REASON_MIN,
});

const MODES: Record<DecisionMode, ModeConfig> = {
  approve: {
    title: 'Approve consultation?',
    subtitle: (c) => `Review ${c}'s request before you approve it.`,
    icon: <CheckCircleIcon className="w-5 h-5" />,
    tone: 'success',
    confirmLabel: 'Approve',
    destructive: false,
    outcomes: (c) => [
      <>
        The booking moves to <strong>Pending Payment</strong> and {c} is asked to settle the consultation fee to confirm
        the session.
      </>,
      <>The time slot stays reserved for {c} while payment is pending.</>,
      <>A private message thread with {c} opens right away so you can coordinate before the session.</>,
      <>You will share the Google Meet link when you confirm the payment.</>,
    ],
    processing: (c) => ({ title: 'Approving consultation', message: `Letting ${c} know their request was accepted.` }),
    success: (c) => ({
      title: 'Consultation approved',
      message: `${c} will be asked to pay to confirm the session. Your message thread with them is open.`,
    }),
    failure: "We couldn't approve this consultation",
  },
  decline: {
    title: 'Decline consultation?',
    subtitle: (c) => `${c} will be told this request was declined.`,
    icon: <AlertIcon className="w-5 h-5" />,
    tone: 'danger',
    confirmLabel: 'Continue',
    destructive: true,
    outcomes: (c) => [
      <>{c} is notified and the time slot becomes available to other clients.</>,
      <>Your access to the documents shared for this request is removed.</>,
      <>Next, you will give your reason. It is sent to {c} so they can book another schedule or attorney.</>,
    ],
    input: reasonInput('Reason for declining', 'Your reason', 'Please provide the reason you are declining this consultation.', (c) =>
      `This is sent to ${c} with the notice.`
    ),
    processing: (c) => ({ title: 'Declining request', message: `Notifying ${c}.` }),
    success: (c) => ({ title: 'Request declined', message: `${c} has been notified and the time slot is open again.` }),
    failure: "We couldn't decline this request",
  },
  confirm_payment: {
    title: 'Confirm payment?',
    subtitle: (c) => `Make sure ${c}'s payment was received in full.`,
    icon: <WalletIcon className="w-5 h-5" />,
    tone: 'caramel',
    confirmLabel: 'Continue',
    destructive: false,
    outcomes: (c) => [
      <>Check the amount against your account before confirming.</>,
      <>
        The booking becomes a <strong>Confirmed Appointment</strong> and {c} is notified.
      </>,
      <>Next, you will paste the Google Meet link. It is sent to {c} and shown on both of your consultation pages.</>,
    ],
    input: {
      kind: 'meetLink',
      title: 'Add the meeting link',
      subtitle: (c) => `${c} receives this link with the confirmation.`,
      label: 'Google Meet link',
      placeholder: 'https://meet.google.com/abc-defg-hij',
      validate: (v) => MEET_REGEX.test(v.trim()),
    },
    processing: (c) => ({ title: 'Confirming payment', message: `Sending the meeting link to ${c}.` }),
    success: (c) => ({
      title: 'Payment confirmed',
      message: `The appointment is confirmed and ${c} has the Google Meet link.`,
    }),
    failure: "We couldn't confirm this payment",
  },
  decline_payment: {
    title: 'Decline payment?',
    subtitle: (c) => `${c} will be asked for a new proof of payment.`,
    icon: <AlertIcon className="w-5 h-5" />,
    tone: 'danger',
    confirmLabel: 'Continue',
    destructive: true,
    outcomes: (c) => [
      <>
        The booking stays in <strong>Pending Payment</strong> and {c} is asked to upload a new proof of payment.
      </>,
      <>Next, explain why the payment could not be verified (e.g. wrong amount or unreadable receipt).</>,
    ],
    input: reasonInput('Why was the payment declined?', 'Your reason', 'Please explain why this payment could not be verified.', (c) =>
      `This is sent to ${c} so they can fix it.`
    ),
    processing: (c) => ({ title: 'Declining payment', message: `Notifying ${c}.` }),
    success: (c) => ({ title: 'Payment declined', message: `${c} has been asked to upload a new proof of payment.` }),
    failure: "We couldn't decline this payment",
  },
  cancel: {
    title: 'Cancel consultation?',
    subtitle: (c) => `${c} will be told the consultation is cancelled.`,
    icon: <AlertIcon className="w-5 h-5" />,
    tone: 'danger',
    confirmLabel: 'Continue',
    destructive: true,
    outcomes: (c) => [
      <>{c} is notified, and if they have already paid, the booking is flagged for a refund.</>,
      <>Next, you will give your reason for cancelling. It is sent to {c}.</>,
    ],
    input: reasonInput('Reason for cancelling', 'Your reason', 'Please provide the reason you are cancelling this consultation.', (c) =>
      `This is sent to ${c} with the notice.`
    ),
    processing: (c) => ({ title: 'Cancelling consultation', message: `Notifying ${c}.` }),
    success: (c) => ({ title: 'Consultation cancelled', message: `${c} has been notified.` }),
    failure: "We couldn't cancel this consultation",
  },
};

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="neu-raised-sm size-8 shrink-0 rounded-xl flex items-center justify-center text-[#C58B3C]">{icon}</span>
      <div className="min-w-0 pt-0.5">
        <p className="font-lora text-[10px] font-bold uppercase tracking-wider text-[#7A6756]">{label}</p>
        <div className="font-inter text-[13px] text-[#341512] leading-snug break-words">{children}</div>
      </div>
    </div>
  );
}

function DecisionSummaryCard({ summary, showPayment }: { summary: DecisionSummary; showPayment: boolean }) {
  const isAudio = summary.communicationMode === 'audio';
  const pay = showPayment ? summary.payment : null;
  return (
    <div className="neu-recessed rounded-[22px] p-4 sm:p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryRow icon={<UserIcon className="w-4 h-4" />} label="Client">
          <span className="font-semibold">{summary.clientName}</span>
        </SummaryRow>
        <SummaryRow icon={<CalendarIcon className="w-4 h-4" />} label="Schedule">
          {summary.dateLong}
          <span className="block text-[#5C4535]">{summary.timeRange}</span>
        </SummaryRow>
        {summary.communicationMode && (
          <SummaryRow icon={isAudio ? <PhoneIcon className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />} label="Session">
            {isAudio ? 'Audio Call' : 'Video Consultation'}
            {summary.durationLabel && <span className="block text-[#5C4535]">Google Meet · {summary.durationLabel}</span>}
          </SummaryRow>
        )}
        {summary.subjectTitle && (
          <SummaryRow icon={<FileIcon className="w-4 h-4" />} label={summary.subjectCategory || 'Subject'}>
            <span className="line-clamp-2">{summary.subjectTitle}</span>
          </SummaryRow>
        )}
      </div>

      {pay && (
        <div className="border-t border-dashed border-[#C8B59E] pt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3 font-inter text-[12.5px] text-[#5C4535]">
            <span>Session fee</span>
            <span className="tabular-nums">{peso(pay.sessionFee)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 font-inter text-[12.5px] text-[#5C4535]">
            <span>Platform fee</span>
            <span className="tabular-nums">{peso(pay.platformFee)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="font-lora text-sm font-bold text-[#341512]">Total due</span>
            <span className="font-lora text-lg font-bold text-[#341512] tabular-nums">{peso(pay.total)}</span>
          </div>
          {pay.proofFileName && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="neu-raised-pill bg-[#E5D8CB] inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1.5 font-inter text-[11.5px] text-[#341512]">
                <FileIcon className="w-3.5 h-3.5 shrink-0 text-[#C58B3C]" />
                <span className="truncate">{pay.proofFileName}</span>
              </span>
              {pay.onOpenProof && (
                <button
                  type="button"
                  onClick={pay.onOpenProof}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-inter text-[11.5px] font-semibold text-[#946525] underline underline-offset-2 hover:text-[#C58B3C] transition-colors cursor-pointer"
                >
                  View proof <ExternalLinkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OutcomeList({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="space-y-2.5">
      <p className="font-lora text-xs font-bold uppercase tracking-wider text-[#5C4535]">What happens next</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 font-inter text-[12.5px] sm:text-[13px] leading-relaxed text-[#3E2A1E]">
            <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#C58B3C]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeetLinkField({
  id,
  config,
  value,
  onChange,
  client,
}: {
  id: string;
  config: InputConfig;
  value: string;
  onChange: (v: string) => void;
  client: string;
}) {
  const [pasteFailed, setPasteFailed] = useState(false);
  const trimmed = value.trim();
  const valid = config.validate(value);
  const state: 'empty' | 'valid' | 'invalid' = !trimmed ? 'empty' : valid ? 'valid' : 'invalid';
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange(text.trim());
      setPasteFailed(false);
    } catch {
      setPasteFailed(true);
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block font-lora text-[13px] font-semibold text-[#341512]">
        {config.label}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A8270]" />
          <input
            id={id}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            autoFocus
            onChange={(e) => onChange(e.target.value)}
            placeholder={config.placeholder}
            aria-invalid={state === 'invalid' || undefined}
            aria-describedby={`${id}-hint`}
            className={`neu-input w-full h-12 rounded-2xl pl-11 pr-11 font-inter text-[13px] text-[#341512] ${state === 'invalid' ? 'neu-input-error' : ''}`}
          />
          <AnimatePresence>
            {state === 'valid' && (
              <motion.span
                key="ok"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1F7A3A]"
              >
                <CheckCircleIcon className="w-4.5 h-4.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {canPaste && (
          <NeuButton variant="secondary" size="sm" icon={<ClipboardIcon className="w-3.5 h-3.5" />} onClick={paste} className="h-12 sm:w-auto">
            Paste
          </NeuButton>
        )}
      </div>
      <p
        id={`${id}-hint`}
        aria-live="polite"
        className={`font-inter text-[11.5px] sm:text-xs leading-relaxed ${
          state === 'invalid' ? 'text-[#B42318] font-medium' : state === 'valid' ? 'text-[#1F7A3A] font-medium' : 'text-[#7A6756]'
        }`}
      >
        {state === 'invalid'
          ? 'Use a Google Meet link that starts with https://meet.google.com/'
          : state === 'valid'
            ? `Looks good. This link will be sent to ${client}.`
            : pasteFailed
              ? 'Your browser blocked pasting from the clipboard. Paste the link into the field instead.'
              : 'Create the meeting in Google Meet or Google Calendar, then paste its link here.'}
      </p>
      <a
        href="https://meet.google.com/new"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-inter text-xs font-semibold text-[#946525] underline underline-offset-2 hover:text-[#C58B3C] transition-colors"
      >
        Create a new Google Meet <ExternalLinkIcon className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function ReasonField({ id, config, value, onChange }: { id: string; config: InputConfig; value: string; onChange: (v: string) => void }) {
  const [touched, setTouched] = useState(false);
  const length = value.trim().length;
  const showError = touched && length > 0 && length < REASON_MIN;
  return (
    <div className="space-y-2.5">
      <label htmlFor={id} className="block font-lora text-[13px] font-semibold text-[#341512]">
        {config.label}
      </label>
      <textarea
        id={id}
        rows={5}
        value={value}
        autoFocus
        maxLength={REASON_MAX}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={config.placeholder}
        aria-invalid={showError || undefined}
        aria-describedby={`${id}-hint`}
        className={`neu-input w-full rounded-2xl px-4 py-3.5 font-inter text-[13px] leading-relaxed text-[#341512] resize-y min-h-[8rem] ${showError ? 'neu-input-error' : ''}`}
      />
      <div id={`${id}-hint`} className="flex items-center justify-between gap-3 font-inter text-[11.5px]">
        <span className={showError ? 'text-[#B42318] font-medium' : 'text-[#7A6756]'} aria-live="polite">
          {showError ? `Please write at least ${REASON_MIN} characters.` : 'Be clear and courteous; the client will read this.'}
        </span>
        <span className="shrink-0 tabular-nums text-[#9A8270]">
          {value.length}/{REASON_MAX}
        </span>
      </div>
    </div>
  );
}

export function ConsultationDecisionModal({ mode, summary, onSubmit, onClose }: ConsultationDecisionModalProps) {
  const config = MODES[mode];
  const client = summary.clientName;
  const titleId = useId();
  const fieldId = useId();
  const [step, setStep] = useState<'confirm' | 'input'>('confirm');
  const [value, setValue] = useState('');
  const submission = useSubmission();

  const onInputStep = !!config.input && step === 'input';
  const valid = !onInputStep || !!config.input?.validate(value);
  const close = () => onClose(submission.phase === 'success');

  const submit = () => {
    if (config.input && step === 'confirm') {
      setStep('input');
      return;
    }
    if (!valid) return;
    void submission.run(() => onSubmit(config.input ? value.trim() : undefined));
  };

  const showPayment = mode === 'confirm_payment' || mode === 'decline_payment';

  return (
    <SubmissionModal
      phase={submission.phase}
      titleId={titleId}
      size="lg"
      onClose={close}
      onRetry={submission.reset}
      error={submission.error}
      processing={config.processing(client)}
      success={config.success(client)}
      failure={{ title: config.failure }}
      details={
        <>
          <span className="neu-raised-pill bg-[#E5D8CB] rounded-full px-4 py-1.5 font-lora text-[10.5px] font-bold uppercase tracking-wider text-[#5C4535]">
            {summary.dateTag}
          </span>
          <span className="neu-raised-pill bg-[#E5D8CB] rounded-full px-4 py-1.5 font-lora text-[10.5px] font-bold text-[#5C4535]">
            {summary.timeTag}
          </span>
        </>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0, x: step === 'input' ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: step === 'input' ? -24 : 24 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <NeuModalSheet
            titleId={titleId}
            title={onInputStep && config.input ? config.input.title : config.title}
            subtitle={onInputStep && config.input ? config.input.subtitle(client) : config.subtitle(client)}
            icon={onInputStep && config.input?.kind === 'meetLink' ? <LinkIcon className="w-5 h-5" /> : config.icon}
            iconTone={onInputStep && config.input?.kind === 'meetLink' ? 'caramel' : config.tone}
            onClose={close}
            footerStart={
              config.input ? (
                <span className="inline-flex items-center gap-2" aria-label={`Step ${step === 'confirm' ? 1 : 2} of 2`}>
                  <span className={`h-1.5 w-6 rounded-full transition-colors ${step === 'confirm' ? 'bg-[#C58B3C]' : 'bg-[#C58B3C]/35'}`} />
                  <span className={`h-1.5 w-6 rounded-full transition-colors ${step === 'input' ? 'bg-[#C58B3C]' : 'bg-[#C58B3C]/35'}`} />
                  <span className="ml-1">Step {step === 'confirm' ? 1 : 2} of 2</span>
                </span>
              ) : undefined
            }
            footer={
              <>
                {onInputStep ? (
                  <NeuButton key="back" variant="secondary" onClick={() => setStep('confirm')}>
                    Back
                  </NeuButton>
                ) : (
                  <NeuButton key="cancel" variant="secondary" icon={<CloseIcon className="w-3 h-3" />} onClick={close}>
                    Cancel
                  </NeuButton>
                )}
                <NeuButton
                  key="primary"
                  variant={config.destructive && (onInputStep || !config.input) ? 'danger' : 'primary'}
                  onClick={submit}
                  disabled={!valid}
                  autoFocus={!onInputStep}
                >
                  {onInputStep ? 'Submit' : config.confirmLabel}
                </NeuButton>
              </>
            }
          >
            {submission.error && submission.phase === 'idle' && (
              <NeuAlert key="error" tone="error" title={config.failure}>
                {submission.error}
              </NeuAlert>
            )}
            {onInputStep && config.input ? (
              config.input.kind === 'meetLink' ? (
                <MeetLinkField id={fieldId} config={config.input} value={value} onChange={setValue} client={client} />
              ) : (
                <ReasonField id={fieldId} config={config.input} value={value} onChange={setValue} />
              )
            ) : (
              <>
                <DecisionSummaryCard summary={summary} showPayment={showPayment} />
                <OutcomeList items={config.outcomes(client)} />
              </>
            )}
          </NeuModalSheet>
        </motion.div>
      </AnimatePresence>
    </SubmissionModal>
  );
}

export default ConsultationDecisionModal;

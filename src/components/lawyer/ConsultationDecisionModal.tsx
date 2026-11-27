'use client';

/**
 * The lawyer's consultation decisions in one dialog: approve, decline, confirm payment, decline
 * payment and cancel. Sessions are held as in-app calls, so confirming needs no meeting link.
 *
 *  1. Review   – what is being decided (client, schedule, subject, payment) and what happens next.
 *  2. Input    – modes that need it: the reason.
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
  CloseIcon,
  ExternalLinkIcon,
  FileIcon,
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
  /** Runs the server action (with the reason, for modes that ask for one); resolves with its result. */
  onSubmit: (value?: string) => Promise<SubmissionResult>;
  /** `succeeded` is true when the dialog closes after a successful submission. */
  onClose: (succeeded: boolean) => void;
}

interface InputConfig {
  kind: 'reason';
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
      <>Once you confirm the payment, the session is held as a call here in Justicia. No meeting link is needed.</>,
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
    confirmLabel: 'Confirm Payment',
    destructive: false,
    outcomes: (c) => [
      <>Check the amount against your account before confirming.</>,
      <>
        The booking becomes a <strong>Confirmed Appointment</strong> and {c} is notified.
      </>,
      <>
        The session is held as a call in Justicia. You and {c} can press <strong>Join Call</strong> from 1 hour before
        the start.
      </>,
    ],
    processing: (c) => ({ title: 'Confirming payment', message: `Letting ${c} know the appointment is confirmed.` }),
    success: (c) => ({
      title: 'Payment confirmed',
      message: `The appointment is confirmed. You and ${c} can join the call from 1 hour before the start.`,
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
            {summary.durationLabel && <span className="block text-[#5C4535]">In-app call · {summary.durationLabel}</span>}
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
            icon={config.icon}
            iconTone={config.tone}
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
              <ReasonField id={fieldId} config={config.input} value={value} onChange={setValue} />
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

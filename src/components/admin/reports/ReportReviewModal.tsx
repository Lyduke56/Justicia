'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getAdminReportEvidenceAction, moderateReportAction, type ModerationDecisionInput } from '@/app/actions/reportActions';
import { DEFAULT_SUSPENSION_DAYS, MAX_SUSPENSIONS, SUSPENSION_DAY_OPTIONS } from '@/lib/moderation/constants';
import type { AdminReportEvidence, AdminReportItem } from '@/types/admin';
import { NeuAlert, NeuButton, Spinner } from '@/components/shared/neu';
import { SubmitModal, useSubmission } from '@/components/shared/feedback';
import { stamp } from '../overview/activity';
import { CAPS } from '../table/kit';
import { ACCOUNT_STATUS, ACTION_LABEL, REPORT_STATUS, isOpenReport, ordinal } from './model';
import { OffenseMeter } from './OffenseMeter';

/**
 * Review a report in the shared neumorphic modal: the reported account and its offense record,
 * the report itself, the proof (files and the captured conversation) and, while it is open, the
 * decision. The decision is confirmed inside the dialog before it is saved; saving morphs the
 * dialog into the submission loader, which then writes a check or an X.
 */

const NOTES_MIN = 10;
const NOTES_MAX = 1000;

const FlagGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className={`text-[10px] text-[#B07A34] ${CAPS}`}>
      {children}
    </p>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 font-inter text-[11.5px] text-[#7D6855]">{label}</dt>
      <dd className="min-w-0 text-right font-inter text-[12.5px] font-semibold text-[#341512] [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function ReportReviewModal({
  report,
  onClose,
  onDecided,
}: {
  report: AdminReportItem;
  onClose: () => void;
  onDecided: (updated: AdminReportItem | null) => Promise<void>;
}) {
  const [now] = useState(() => Date.now());
  const [evidence, setEvidence] = useState<AdminReportEvidence | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [decision, setDecision] = useState<ModerationDecisionInput>('suspend');
  const [days, setDays] = useState<number>(DEFAULT_SUSPENSION_DAYS);
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const submission = useSubmission();
  const busy = submission.processing;
  /** What the saved decision did (shown on the result card). */
  const [outcome, setOutcome] = useState('');

  const open = isOpenReport(report);
  const target = report.target;
  const terminated = target.accountStatus === 'terminated';
  const limitReached = target.suspensionCount >= MAX_SUSPENSIONS;
  const escalates = decision === 'suspend' && limitReached;
  const terminating = decision === 'terminate' || escalates;
  const notesOk = notes.trim().length >= NOTES_MIN;
  const submitted = stamp(report.createdAt, now);
  const status = REPORT_STATUS[report.status];
  const account = ACCOUNT_STATUS[target.accountStatus];

  useEffect(() => {
    let cancelled = false;
    getAdminReportEvidenceAction(report.id)
      .then((res) => {
        if (cancelled) return;
        if ('evidence' in res && res.evidence) setEvidence(res.evidence);
        else setEvidenceError(('error' in res && res.error) || 'The evidence could not be loaded.');
      })
      .catch(() => !cancelled && setEvidenceError('The evidence could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [report.id]);

  const consequence =
    decision === 'dismiss'
      ? 'No action will be taken on the account. The reporter is told that no violation was found.'
      : terminating
        ? `${target.name}'s account will be permanently terminated. They are signed out, blocked from signing in, and their active consultations are cancelled.`
        : `${target.name} will be suspended for ${days} days (suspension ${target.suspensionCount + 1} of ${MAX_SUSPENSIONS}). They are signed out, and consultations during the suspension are cancelled.`;

  const submit = () =>
    void submission.run(async () => {
      try {
        const res = await moderateReportAction(report.id, decision, { days, notes });
        if (!('success' in res) || !res.success) {
          return { ok: false, error: ('error' in res && res.error) || 'The decision could not be saved.' };
        }
        setConfirming(false);
        setOutcome(
          res.outcome === 'dismissed'
            ? 'Report dismissed. The reporter was notified.'
            : res.outcome === 'suspended'
              ? `Account suspended until ${res.suspendedUntil ? stamp(res.suspendedUntil, Date.now()).full : 'the selected date'}. Both parties were notified.`
              : res.escalated
                ? `Suspension limit reached, so the account was terminated. Other open reports about ${target.name} were closed.`
                : `Account terminated. Other open reports about ${target.name} were closed.`
        );
        await onDecided(res.report);
        return { ok: true };
      } catch {
        return { ok: false, error: 'The decision could not be saved. Please try again.' };
      }
    });

  const confirmLabel = decision === 'dismiss' ? 'Dismiss report' : terminating ? 'Terminate account' : `Suspend for ${days} days`;
  const steps = [
    ...Array.from({ length: MAX_SUSPENSIONS }).map((_, i) => ({ label: `${ordinal(i + 1)} offense: suspension`, done: i < target.suspensionCount, end: false })),
    { label: `${ordinal(MAX_SUSPENSIONS + 1)} offense: termination`, done: terminated, end: true },
  ];

  return (
    <SubmitModal
      submission={submission}
      onClose={onClose}
      processing={{
        title: decision === 'dismiss' ? 'Dismissing the report' : terminating ? 'Terminating the account' : 'Suspending the account',
        message: `Saving your decision about ${target.name}.`,
      }}
      success={{ title: 'Decision saved', message: outcome }}
      failure={{ title: 'The decision was not saved' }}
      size="2xl"
      title={`Report about ${target.name}`}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className={`admin-pill ${status.pill}`}>{status.label}</span>
          <span title={submitted.full}>
            Submitted {submitted.date}, {submitted.time}
          </span>
        </span>
      }
      icon={<FlagGlyph />}
      iconTone="danger"
      bodyClassName="space-y-7"
      footerStart={open && !confirming ? <span className="font-inter text-[11px] text-[#7D6855]">Each account can be suspended {MAX_SUSPENSIONS} times; the next upheld report terminates it.</span> : undefined}
      footer={
        !open ? (
          <NeuButton onClick={onClose}>Close</NeuButton>
        ) : confirming ? (
          <>
            <NeuButton onClick={() => setConfirming(false)} disabled={busy}>
              Back
            </NeuButton>
            <NeuButton variant={decision === 'dismiss' ? 'primary' : terminating ? 'danger' : 'dark'} disabled={busy} onClick={submit}>
              {`Yes, ${confirmLabel.charAt(0).toLowerCase()}${confirmLabel.slice(1)}`}
            </NeuButton>
          </>
        ) : (
          <>
            <NeuButton onClick={onClose}>Cancel</NeuButton>
            <NeuButton variant={decision === 'dismiss' ? 'primary' : terminating ? 'danger' : 'dark'} disabled={!notesOk || (terminated && decision !== 'dismiss')} onClick={() => setConfirming(true)}>
              {confirmLabel}
            </NeuButton>
          </>
        )
      }
    >
      {/* Account + offense record */}
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="report-account" className="admin-dossier-cell rounded-[18px] px-5 py-4">
          <SectionLabel id="report-account">Reported account</SectionLabel>
          <p className="mt-2 font-lora text-[16px] font-bold leading-snug text-[#341512]">{target.name}</p>
          <dl className="mt-2 divide-y divide-dotted divide-[#B8946E]/50">
            <Fact label="Email">{target.email || '—'}</Fact>
            <Fact label="Role">
              <span className="capitalize">{target.role}</span>
            </Fact>
            <Fact label="Account">
              <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                <span className={`admin-pill ${account.pill}`}>{account.label}</span>
                {target.suspendedUntil && <span className="font-normal text-[#7D6855]">until {stamp(target.suspendedUntil, now).date}</span>}
              </span>
            </Fact>
            <Fact label="Reports">
              {target.totalReportCount} total · {target.openReportCount} open
            </Fact>
          </dl>
        </section>
        <section aria-labelledby="report-offenses" className="admin-dossier-cell rounded-[18px] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel id="report-offenses">Offense record</SectionLabel>
            <OffenseMeter count={target.suspensionCount} terminated={terminated} showLabel={false} />
          </div>
          <ol className="mt-3 flex flex-col gap-2">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2.5">
                <span className={`admin-offense-step ${step.done ? (step.end ? 'is-final' : 'is-used') : ''}`} aria-hidden>
                  {step.done && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
                <span className={`font-inter text-[12.5px] ${step.done ? 'font-semibold text-[#341512]' : 'text-[#7D6855]'}`}>
                  {step.label}
                  <span className="sr-only">{step.done ? ' (recorded)' : ' (not reached)'}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 font-inter text-[11.5px] leading-relaxed text-[#7D6855]">
            {terminated
              ? 'This account is terminated.'
              : limitReached
                ? `All ${MAX_SUSPENSIONS} suspensions have been used. Upholding this report terminates the account.`
                : `${MAX_SUSPENSIONS - target.suspensionCount} suspension${MAX_SUSPENSIONS - target.suspensionCount === 1 ? '' : 's'} left before termination.`}
          </p>
        </section>
      </div>

      {/* The report */}
      <section aria-labelledby="report-reason" className="flex flex-col gap-3">
        <SectionLabel id="report-reason">Reason</SectionLabel>
        <p className="font-lora text-[16px] font-bold text-[#341512]">{report.reasonLabel}</p>
        <p className="admin-dossier-cell whitespace-pre-line rounded-[16px] px-5 py-4 font-inter text-[13px] leading-relaxed text-[#3E2A1E]">
          {report.details || 'No details were provided.'}
        </p>
        <p className="font-inter text-[11.5px] text-[#7D6855]">
          Reported by <span className="font-semibold text-[#3E2A1E]">{report.reporter.name}</span>
          {report.reporter.email && <> ({report.reporter.email})</>} · <span className="capitalize">{report.reporter.role}</span>
        </p>
      </section>

      {/* Proof */}
      <section aria-labelledby="report-proof" className="flex flex-col gap-3">
        <SectionLabel id="report-proof">Proof</SectionLabel>
        {evidenceError && <NeuAlert tone="error">{evidenceError}</NeuAlert>}
        {!evidence && !evidenceError && (
          <p className="inline-flex items-center gap-2 font-inter text-[12.5px] text-[#7D6855]">
            <Spinner className="h-3.5 w-3.5" /> Loading the attached proof…
          </p>
        )}
        {evidence && evidence.files.length === 0 && !evidence.conversation && (
          <p className="font-inter text-[12.5px] text-[#7D6855]">No files or conversation were attached to this report.</p>
        )}
        {evidence && evidence.files.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {evidence.files.map((file) => (
              <li key={file.path} className="neu-raised-sm overflow-hidden rounded-[16px] bg-[#E5D8CB]">
                {file.kind === 'image' && file.url && (
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* Signed, short-lived storage URL; next/image would need a remote pattern for it. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.url} alt={file.name} className="h-40 w-full object-cover" />
                  </a>
                )}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 truncate font-inter text-[12px] font-semibold text-[#341512]" title={file.name}>
                    {file.name}
                  </span>
                  {file.url ? (
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-inter text-[12px] font-semibold text-[#946525] hover:text-[#C58B3C]">
                      Open
                    </a>
                  ) : (
                    <span className="shrink-0 font-inter text-[12px] text-[#863B30]">Unavailable</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {evidence?.conversation && (
          <div className="neu-recessed overflow-hidden rounded-[18px]">
            <p className={`border-b border-dotted border-[#B8946E]/50 px-5 py-3 text-[9.5px] text-[#8A6A4C] ${CAPS}`}>
              Conversation captured with the report · {evidence.conversation.length} message{evidence.conversation.length === 1 ? '' : 's'}
            </p>
            <ol className="neu-scrollbar-discrete flex max-h-80 flex-col gap-3 overflow-y-auto px-5 py-4">
              {evidence.conversation.map((m) => {
                const at = stamp(m.sentAt, now);
                return m.from === 'system' ? (
                  <li key={m.id} className={`text-center text-[9.5px] text-[#8A6A4C] ${CAPS}`}>
                    {m.content}
                  </li>
                ) : (
                  <li key={m.id} className={`flex flex-col ${m.from === 'reported' ? 'items-start' : 'items-end'}`}>
                    <span
                      className={`max-w-[85%] whitespace-pre-line rounded-[16px] px-4 py-2.5 font-inter text-[12.5px] leading-relaxed ${
                        m.from === 'reported' ? 'neu-raised-sm border-l-2 border-[#9A3B2E]/60 bg-[#E5D8CB] text-[#341512]' : 'bg-[#4A2E25] text-[#F3E6D6]'
                      }`}
                    >
                      {m.content}
                    </span>
                    <span className="mt-1 font-inter text-[10.5px] text-[#7D6855]">
                      {m.from === 'reported' ? target.name : report.reporter.name} · {at.date}, {at.time}
                    </span>
                  </li>
                );
              })}
              {evidence.conversation.length === 0 && <li className="font-inter text-[12.5px] text-[#7D6855]">The conversation was empty.</li>}
            </ol>
          </div>
        )}
      </section>

      {/* Decision */}
      {open ? (
        <section aria-labelledby="report-decision" className="flex flex-col gap-4">
          <SectionLabel id="report-decision">Decision</SectionLabel>
          <div role="radiogroup" aria-labelledby="report-decision" className="grid gap-3 sm:grid-cols-3">
            {(
              [
                { key: 'suspend', label: limitReached ? 'Suspend (terminates)' : 'Suspend', hint: limitReached ? `${ordinal(MAX_SUSPENSIONS + 1)} offense` : `Suspension ${target.suspensionCount + 1} of ${MAX_SUSPENSIONS}` },
                { key: 'terminate', label: 'Terminate', hint: 'Permanent' },
                { key: 'dismiss', label: 'Dismiss', hint: 'No violation found' },
              ] as const
            ).map((opt) => {
              const active = decision === opt.key;
              return (
                <motion.button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy || confirming || (terminated && opt.key !== 'dismiss')}
                  onClick={() => setDecision(opt.key)}
                  whileTap={{ scale: 0.97 }}
                  className={`admin-decision-option rounded-[16px] px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'is-active' : ''}`}
                >
                  <span className="block font-lora text-[14px] font-bold text-[#341512]">{opt.label}</span>
                  <span className="mt-0.5 block font-inter text-[11px] text-[#7D6855]">{opt.hint}</span>
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence initial={false}>
            {decision === 'suspend' && !limitReached && (
              <motion.div key="days" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex flex-col gap-2 pt-1">
                  <p id="report-days" className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>
                    Suspension length
                  </p>
                  <div role="radiogroup" aria-labelledby="report-days" className="client-neu-well grid grid-cols-4 gap-1 rounded-[14px] p-1 sm:max-w-md">
                    {SUSPENSION_DAY_OPTIONS.map((d) => {
                      const active = days === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={busy || confirming}
                          onClick={() => setDays(d)}
                          className={`relative isolate h-9 rounded-[11px] font-inter text-[12px] tabular-nums transition-colors ${active ? 'font-bold text-[#341512]' : 'text-[#341512]/60 hover:text-[#341512]'}`}
                        >
                          {active && <motion.span layoutId={`report-days-${report.id}`} transition={{ type: 'spring', stiffness: 460, damping: 34 }} className="client-neu-thumb absolute inset-0 -z-10 rounded-[11px]" />}
                          {d} days
                        </button>
                      );
                    })}
                  </div>
                  {target.accountStatus === 'suspended' && (
                    <p className="font-inter text-[11.5px] text-[#7D6855]">The account is already suspended; the new suspension starts when the current one ends.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {escalates && (
            <NeuAlert tone="error" title="This will terminate the account">
              {target.name} has already been suspended {target.suspensionCount} times. Upholding this report permanently terminates the account.
            </NeuAlert>
          )}

          <label className="flex flex-col gap-2">
            <span className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{decision === 'dismiss' ? 'Note for the record' : 'Reason shown to the account owner'}</span>
            <textarea
              rows={3}
              maxLength={NOTES_MAX}
              value={notes}
              disabled={busy || confirming}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={decision === 'dismiss' ? 'e.g. The messages provided do not show a violation of the guidelines.' : 'e.g. Repeated abusive language toward a client in Messages.'}
              className="lawyer-field min-h-[96px] w-full resize-y rounded-[12px] px-3.5 py-3 font-inter text-[12.5px] leading-relaxed text-[#341512] placeholder:text-[#9E8E7D] focus:outline-none"
            />
            <span className="flex justify-between gap-3 font-inter text-[11px] text-[#7D6855]">
              <span className={notes.trim().length > 0 && !notesOk ? 'text-[#863B30]' : ''}>At least {NOTES_MIN} characters.</span>
              <span className="tabular-nums">
                {notes.length}/{NOTES_MAX}
              </span>
            </span>
          </label>

          <AnimatePresence initial={false}>
            {confirming && (
              <NeuAlert key="confirm" tone={terminating ? 'error' : 'warning'} title={`${confirmLabel}?`}>
                {consequence}
              </NeuAlert>
            )}
          </AnimatePresence>
        </section>
      ) : (
        report.resolution && (
          <section aria-labelledby="report-outcome" className="flex flex-col gap-3">
            <SectionLabel id="report-outcome">Decision</SectionLabel>
            <p className="font-lora text-[16px] font-bold text-[#341512]">{ACTION_LABEL[report.resolution.action] ?? report.resolution.action}</p>
            <p className="admin-dossier-cell whitespace-pre-line rounded-[16px] px-5 py-4 font-inter text-[13px] leading-relaxed text-[#3E2A1E]">{report.resolution.notes || '—'}</p>
            <p className="font-inter text-[11.5px] text-[#7D6855]">
              By {report.resolution.adminName}
              {report.resolution.resolvedAt && (
                <>
                  {' '}
                  · {stamp(report.resolution.resolvedAt, now).date}, {stamp(report.resolution.resolvedAt, now).time}
                </>
              )}
            </p>
          </section>
        )
      )}

    </SubmitModal>
  );
}

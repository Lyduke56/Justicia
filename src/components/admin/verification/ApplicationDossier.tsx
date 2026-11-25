'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ChevronRightIcon } from '@/components/shared/neu';
import { CARD_ITEM } from '@/components/lawyer/motion';
import { initials, stamp, waitedFor } from '../overview/activity';
import type { ReviewDecision } from '@/app/actions/adminLawyerReview';
import { peso, statusMeta, type LawyerQueueItem } from './model';

/**
 * The application under review, laid out as a formal dossier: identity and status, a
 * credentials grid, practice and languages, consultation rates, the applicant's statement,
 * any earlier note, and the decision buttons. Sections cascade in (CARD_ITEM) whenever the
 * dossier changes.
 */

export const CAPS = 'font-inter font-semibold uppercase tracking-[0.14em]';

const STATUS_CLASS: Record<string, string> = {
  pending: 'admin-status-pending',
  info: 'admin-status-info',
  success: 'admin-status-success',
  danger: 'admin-status-danger',
  neutral: 'admin-status-neutral',
};

export function StatusChip({ status }: { status: string }) {
  const meta = statusMeta(status);
  return <span className={`admin-status ${STATUS_CLASS[meta.tone]}`}>{meta.label}</span>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h4 className={`text-[10px] text-[#B07A34] ${CAPS}`}>{children}</h4>;
}

function Field({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="admin-dossier-cell min-w-0 rounded-[14px] px-4 py-3">
      <dt className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{label}</dt>
      <dd className={`mt-1 truncate text-[15px] font-semibold text-[#341512] ${mono ? 'font-inter tabular-nums tracking-[0.02em]' : 'font-lora'}`}>{children}</dd>
    </div>
  );
}

const Glyph = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
export const DECISION_GLYPH: Record<ReviewDecision, string> = {
  approved: 'm5 12.5 4.5 4.5L19 7.5',
  needs_resubmission: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  rejected: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
};

export function ApplicationDossier({
  lawyer,
  now,
  busy,
  onDecision,
}: {
  lawyer: LawyerQueueItem;
  now: number;
  busy: boolean;
  onDecision: (decision: ReviewDecision) => void;
}) {
  const status = lawyer.verification_status;
  const submitted = lawyer.submitted_at ? stamp(lawyer.submitted_at, now) : null;
  const reviewed = lawyer.reviewed_at ? stamp(lawyer.reviewed_at, now) : null;
  const waiting = status === 'pending' && lawyer.submitted_at ? waitedFor(lawyer.submitted_at, now) : null;
  const areas = lawyer.practice_areas?.filter(Boolean) ?? [];
  const languages = lawyer.languages?.filter(Boolean) ?? [];
  const note =
    status === 'rejected' && lawyer.rejection_reason
      ? { label: 'Reason for rejection', text: lawyer.rejection_reason, tone: 'danger' as const }
      : status === 'needs_resubmission' && lawyer.admin_notes
        ? { label: 'Information requested', text: lawyer.admin_notes, tone: 'info' as const }
        : null;

  return (
    <article aria-labelledby={`dossier-${lawyer.user_id}`} className="flex flex-col gap-6">
      {/* Identity */}
      <motion.header variants={CARD_ITEM} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="admin-overview-badge grid h-14 w-14 shrink-0 place-items-center rounded-[14px] font-inter text-[15px] font-bold tracking-[0.06em] text-[#5C4535]" aria-hidden>
            {initials(lawyer.full_name || 'Applicant')}
          </span>
          <div className="min-w-0">
            <h3 id={`dossier-${lawyer.user_id}`} className="truncate font-lora text-[21px] font-semibold leading-tight text-[#341512]">
              {lawyer.full_name || 'Attorney applicant'}
            </h3>
            <p className="mt-1 truncate font-inter text-[12px] text-[#7D6855]">{lawyer.email || 'No email on file'}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <StatusChip status={status} />
          <p className="font-inter text-[11px] tabular-nums text-[#7D6855]">
            {waiting ? (
              <>
                Waiting <span className="font-semibold text-[#A8742E]">{waiting}</span>
              </>
            ) : reviewed && status !== 'pending' ? (
              <span title={reviewed.full}>Reviewed {reviewed.date}</span>
            ) : null}
          </p>
        </div>
      </motion.header>

      <motion.div variants={CARD_ITEM} className="lawyer-dash-groove" aria-hidden />

      {/* Credentials */}
      <motion.section variants={CARD_ITEM} className="flex flex-col gap-3">
        <SectionLabel>Credentials</SectionLabel>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Roll No." mono>
            {lawyer.roll_number || '—'}
          </Field>
          <Field label="IBP Chapter">{lawyer.ibp_chapter || '—'}</Field>
          <Field label="Bar Passer" mono>
            {lawyer.bar_passer_year ?? '—'}
          </Field>
          <Field label="Experience">{lawyer.experience_years != null ? `${lawyer.experience_years} yr${lawyer.experience_years === 1 ? '' : 's'}` : '—'}</Field>
        </dl>
      </motion.section>

      {/* Practice and languages */}
      <motion.section variants={CARD_ITEM} className="grid gap-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5">
          <SectionLabel>Practice areas</SectionLabel>
          {areas.length ? (
            <ul className="flex flex-wrap gap-2">
              {areas.map((area) => (
                <li key={area} className="admin-dossier-chip rounded-full px-3 py-1 font-inter text-[11.5px] font-medium text-[#4A2E25]">
                  {area}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-inter text-[12px] text-[#7D6855]">Not specified</p>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          <SectionLabel>Languages</SectionLabel>
          <p className="font-lora text-[14px] text-[#341512]">{languages.length ? languages.join(', ') : <span className="font-inter text-[12px] text-[#7D6855]">Not specified</span>}</p>
        </div>
      </motion.section>

      {/* Rates */}
      <motion.section variants={CARD_ITEM} className="flex flex-col gap-3">
        <SectionLabel>Consultation rates</SectionLabel>
        <dl className="grid grid-cols-3 gap-3">
          <Field label="30 min · Initial" mono>
            {peso(lawyer.fee_initial_30min)}
          </Field>
          <Field label="60 min · Standard" mono>
            {peso(lawyer.fee_standard_60min)}
          </Field>
          <Field label="120 min · Extended" mono>
            {peso(lawyer.fee_extended_120min)}
          </Field>
        </dl>
      </motion.section>

      {/* Statement */}
      <motion.section variants={CARD_ITEM} className="flex flex-col gap-2.5">
        <SectionLabel>Statement</SectionLabel>
        {lawyer.about ? (
          <p className="admin-dossier-cell whitespace-pre-line rounded-[14px] px-4 py-3.5 font-inter text-[12.5px] leading-relaxed text-[#3E2A1E]">{lawyer.about}</p>
        ) : (
          <p className="font-inter text-[12px] text-[#7D6855]">The applicant did not write a statement.</p>
        )}
      </motion.section>

      {note && (
        <motion.aside variants={CARD_ITEM} className={`admin-dossier-note admin-dossier-note-${note.tone} rounded-[14px] px-4 py-3`}>
          <p className={`text-[9.5px] ${CAPS}`}>{note.label}</p>
          <p className="mt-1 font-inter text-[12.5px] leading-relaxed text-[#3E2A1E]">{note.text}</p>
        </motion.aside>
      )}

      {/* Decision */}
      <motion.footer variants={CARD_ITEM} className="flex flex-col gap-4">
        <div className="lawyer-dash-groove" aria-hidden />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Link
              href={`/admin/lawyers/${lawyer.user_id}?from=queue`}
              className="group inline-flex items-center gap-1.5 self-start font-inter text-[12px] font-semibold text-[#80501F] hover:text-[#A8742E]"
            >
              Open full dossier
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {submitted && (
              <span className="font-inter text-[11px] tabular-nums text-[#7D6855]" title={submitted.full}>
                Submitted {submitted.date}, {submitted.time}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {status !== 'rejected' && (
              <DecisionButton tone="danger" disabled={busy} onClick={() => onDecision('rejected')} glyph={DECISION_GLYPH.rejected}>
                Reject
              </DecisionButton>
            )}
            {status !== 'needs_resubmission' && (
              <DecisionButton tone="plain" disabled={busy} onClick={() => onDecision('needs_resubmission')} glyph={DECISION_GLYPH.needs_resubmission}>
                Request info
              </DecisionButton>
            )}
            {status !== 'approved' && (
              <DecisionButton tone="primary" disabled={busy} onClick={() => onDecision('approved')} glyph={DECISION_GLYPH.approved}>
                Approve
              </DecisionButton>
            )}
          </div>
        </div>
      </motion.footer>
    </article>
  );
}

function DecisionButton({ tone, glyph, children, ...rest }: { tone: 'primary' | 'plain' | 'danger'; glyph: string; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  const look =
    tone === 'primary'
      ? 'neu-btn-espresso bg-[#4A2E25] text-[#F3E6D6]'
      : tone === 'danger'
        ? 'neu-raised-sm text-[#9A3B2E] hover:text-[#7E2A20]'
        : 'neu-raised-sm text-[#341512] hover:text-[#A8742E]';
  return (
    <motion.button
      type="button"
      whileHover={rest.disabled ? undefined : { y: -1.5 }}
      whileTap={rest.disabled ? undefined : { scale: 0.96 }}
      className={`inline-flex h-10 items-center gap-2 rounded-[12px] px-4 font-lora text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${look}`}
      {...rest}
    >
      <Glyph d={glyph} />
      {children}
    </motion.button>
  );
}

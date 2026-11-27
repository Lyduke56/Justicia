'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { postApprovalLawyerAction, reviewLawyerApplicationAction } from '@/app/actions/adminLawyerReview';
import { allowedPostApprovalActions, allowedReviewDecisions } from '@/lib/lawyer/verification';
import { AccountStandingPanel } from '../users/AccountStandingPanel';
import { DossierDocuments } from './DossierDocuments';
import { refreshAdminTabs } from '@/lib/live/adminRefresh';
import { ChevronLeftIcon, NeuAlert } from '@/components/shared/neu';
import { CARVE, DRAW, EASE_OUT, EMBOSS, GROUP, PAGE, RISE } from '@/components/lawyer/motion';
import { TONE_COLOR, describeActivity, stamp, timeAgo, waitedFor, type ActivityEntry } from '../overview/activity';
import { ActivityIcon } from '../overview/OverviewIcons';
import { CAPS, DECISION_GLYPH } from '../verification/ApplicationDossier';
import { ReviewDecisionModal, type DossierDecision } from '../verification/ReviewDecisionModal';
import { useScreenReveal } from '@/components/shared/loading';
import type { SubmissionResult } from '@/components/shared/feedback';
import { peso, type LawyerQueueItem } from '../verification/model';
import { DOSSIER_BACK, type DossierOrigin } from './origin';

/**
 * Lawyer Dossier (admin), laid out like the client's lawyer profile (LawyerDetailView), one
 * column in reading order, every section under the same Lora heading:
 *  - The caramel profile banner: photo, name (slides up out of a mask, the profile's one
 *    signature moment), roll number and IBP chapter, practice; status and listing on the right.
 *  - About (the full statement beside the consultation rates), Bar Credentials (every value in
 *    full, wrapping rather than truncating), Practice & Languages.
 *  - Last, under a second divider: Verification (the same decision dialog as the queue) beside
 *    the Activity trail.
 *
 * Entrance: the page embosses in reading order (banner, divider, cards), cards' contents rise.
 */

export interface DossierLawyer {
  userId: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
  rollNumber: string;
  ibpChapter: string | null;
  barPasserYear: number | null;
  experienceYears: number | null;
  practiceAreas: string[];
  languages: string[];
  about: string | null;
  feeInitial30: number | null;
  feeStandard60: number | null;
  feeExtended120: number | null;
  status: string;
  isVisible: boolean;
  isAvailable: boolean;
  adminNotes: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  accountCreatedAt: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
}

const STATUS: Record<string, { label: string; tone: string; summary: string }> = {
  approved: { label: 'Verified', tone: 'success', summary: 'Credentials verified. The lawyer can use the lawyer portal and accept consultations.' },
  pending: { label: 'Pending Review', tone: 'pending', summary: 'Waiting for your review. The lawyer is not listed in Find a Lawyer yet.' },
  needs_resubmission: { label: 'Needs Info', tone: 'info', summary: 'Returned to the lawyer for more information. It comes back here when they resubmit.' },
  rejected: { label: 'Rejected', tone: 'danger', summary: 'Credentials could not be verified. The lawyer is not listed in Find a Lawyer.' },
};
const statusOf = (s: string) => STATUS[s] ?? { label: 'Draft', tone: 'neutral', summary: 'The lawyer has not submitted an application yet.' };

/** Activity wording on the lawyer's own page: the name is implied, so it is left out. */
function dossierActivity(entry: ActivityEntry, lawyerName: string): { title: string; actor: string | null } {
  const decision = entry.action.startsWith('lawyer.verification.') ? entry.action.slice('lawyer.verification.'.length) : null;
  const title =
    entry.action === 'lawyer.submitted'
      ? 'Application submitted'
      : entry.action === 'lawyer.approved' || decision === 'approved'
        ? 'Application approved'
        : entry.action === 'lawyer.rejected' || decision === 'rejected'
          ? 'Application rejected'
          : entry.action === 'lawyer.needs_resubmission' || decision
            ? 'More information requested'
            : describeActivity(entry).title;
  const bare = (n: string) => n.replace(/^atty\.?\s+/i, '').trim().toLowerCase();
  const actor = entry.actorName && bare(entry.actorName) === bare(lawyerName) ? 'Applicant' : entry.actorName;
  return { title, actor };
}

/** Heading in the client profile's style ("Professional Background"). */
function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <motion.h2 variants={RISE} id={id} className="font-lora text-xl font-bold text-[#341512]/80 sm:text-[22px]">
      {children}
    </motion.h2>
  );
}

function Credential({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <motion.div variants={RISE} className="admin-dossier-cell min-w-0 rounded-[16px] px-4 py-3.5">
      <dt className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{label}</dt>
      <dd className={`mt-1.5 text-[15px] font-semibold leading-snug text-[#341512] [overflow-wrap:anywhere] ${mono ? 'font-inter tabular-nums tracking-[0.02em]' : 'font-lora'}`}>{value}</dd>
    </motion.div>
  );
}

/** An email that wraps after "@" (or a dot in the name part) instead of mid-word; the domain stays whole. */
function WrappingEmail({ email }: { email: string }) {
  const at = email.lastIndexOf('@');
  if (at === -1) return <>{email}</>;
  const local = email.slice(0, at + 1).split(/(?<=\.)/);
  return (
    <>
      {local.map((part, i) => (
        <span key={i}>
          {part}
          <wbr />
        </span>
      ))}
      <span className="whitespace-nowrap">{email.slice(at + 1)}</span>
    </>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <li className="neu-raised-sm rounded-full bg-[#E5D8CB] px-3.5 py-1 font-lora text-[12px] font-semibold text-[#341512]/80">{children}</li>;
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- storage URL, same as the client profile
    <img src={photoUrl} alt={name} className="h-16 w-16 rounded-full object-cover sm:h-20 sm:w-20" />
  ) : (
    <div className="flex h-16 w-16 items-center justify-center text-[#341512]/80 sm:h-20 sm:w-20" aria-hidden>
      <svg className="h-full w-full" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4.2">
        <circle cx="32" cy="32" r="28" />
        <circle cx="32" cy="24" r="8" />
        <path d="M16 48c0-8.837 7.163-14 16-14s16 5.163 16 14" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function DecisionButton({ tone, glyph, children, ...rest }: { tone: 'primary' | 'plain' | 'danger'; glyph: string; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  const look =
    tone === 'primary'
      ? 'neu-btn-espresso bg-[#4A2E25] text-[#F3E6D6]'
      : tone === 'danger'
        ? 'neu-raised-sm bg-[#E5D8CB] text-[#9A3B2E] hover:text-[#7E2A20]'
        : 'neu-raised-sm bg-[#E5D8CB] text-[#341512] hover:text-[#A8742E]';
  return (
    <motion.button
      type="button"
      whileHover={rest.disabled ? undefined : { y: -1.5 }}
      whileTap={rest.disabled ? undefined : { scale: 0.97 }}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-[12px] px-4 font-lora text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${look}`}
      {...rest}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={glyph} />
      </svg>
      {children}
    </motion.button>
  );
}

export function LawyerDossierView({ lawyer, activity, from = 'directory' }: { lawyer: DossierLawyer; activity: ActivityEntry[]; from?: DossierOrigin }) {
  // Back to the screen the dossier was opened from (?from=), else the lawyer directory.
  const back = DOSSIER_BACK[from] ?? DOSSIER_BACK.directory;
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  // The entrance plays when the portal's loading screen lifts (not underneath it).
  const { revealed } = useScreenReveal();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const [decision, setDecision] = useState<DossierDecision | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const status = statusOf(lawyer.status);
  const listed = lawyer.status === 'approved' && lawyer.isVisible;
  const submitted = lawyer.submittedAt ? stamp(lawyer.submittedAt, now) : null;
  const reviewed = lawyer.reviewedAt ? stamp(lawyer.reviewedAt, now) : null;
  const created = lawyer.accountCreatedAt ? stamp(lawyer.accountCreatedAt, now) : null;
  const note =
    lawyer.status === 'rejected' && lawyer.rejectionReason
      ? { label: 'Reason for rejection', text: lawyer.rejectionReason, tone: 'danger' }
      : lawyer.status === 'needs_resubmission' && lawyer.adminNotes
        ? { label: 'Information requested', text: lawyer.adminNotes, tone: 'info' }
        : null;
  const rates = [
    { label: 'Initial Consultation (30 mins)', value: lawyer.feeInitial30 },
    { label: 'Standard Consultation (1 hr)', value: lawyer.feeStandard60 },
    { label: 'Extended Consultation (2 hrs)', value: lawyer.feeExtended120 },
  ];
  const meta = [
    lawyer.experienceYears != null ? `${lawyer.experienceYears} year${lawyer.experienceYears === 1 ? '' : 's'} of practice` : null,
    lawyer.barPasserYear ? `Bar class of ${lawyer.barPasserYear}` : null,
    lawyer.ratingCount ? `★ ${(lawyer.ratingAvg ?? 0).toFixed(1)} (${lawyer.ratingCount} review${lawyer.ratingCount === 1 ? '' : 's'})` : null,
  ].filter(Boolean);

  // The decision dialog is shared with the verification queue, which works on queue rows.
  const asQueueItem: LawyerQueueItem = {
    user_id: lawyer.userId,
    email: lawyer.email ?? '',
    full_name: lawyer.fullName,
    roll_number: lawyer.rollNumber,
    ibp_chapter: lawyer.ibpChapter,
    bar_passer_year: lawyer.barPasserYear,
    about: lawyer.about,
    practice_areas: lawyer.practiceAreas,
    languages: lawyer.languages,
    experience_years: lawyer.experienceYears,
    fee_initial_30min: lawyer.feeInitial30,
    fee_standard_60min: lawyer.feeStandard60,
    fee_extended_120min: lawyer.feeExtended120,
    verification_status: lawyer.status,
    admin_notes: lawyer.adminNotes,
    rejection_reason: lawyer.rejectionReason,
    submitted_at: lawyer.submittedAt,
    reviewed_at: lawyer.reviewedAt,
    created_at: lawyer.accountCreatedAt ?? '',
  };

  const reviewDecisions = allowedReviewDecisions(lawyer.status);
  const postApproval = allowedPostApprovalActions(lawyer.status);

  /** Saves the decision; the dialog shows the loader, then the check or the X. */
  const confirmDecision = async (text: string, exception?: string): Promise<SubmissionResult> => {
    if (!decision) return { ok: false, error: 'Choose a decision first.' };
    try {
      const res =
        decision === 'revoke' || decision === 'reverify'
          ? await postApprovalLawyerAction(lawyer.userId, decision, text)
          : await reviewLawyerApplicationAction(lawyer.userId, decision, text, { exceptionReason: exception });
      if (res.error) return { ok: false, error: res.error };
      setNotice(
        res.message ||
          (decision === 'approved'
            ? `${lawyer.fullName} is approved and now listed in Find a Lawyer.`
            : decision === 'rejected'
              ? `${lawyer.fullName}'s application was rejected.`
              : `Your request for more information was sent to ${lawyer.fullName}.`)
      );
      return { ok: true };
    } catch {
      return { ok: false, error: 'The decision could not be saved. Please try again.' };
    }
  };

  /** "Done" on the result card: close it and refresh everything that shows this lawyer. */
  const finishDecision = () => {
    setDecision(null);
    refreshAdminTabs();
    router.refresh();
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={PAGE}
        initial={reduceMotion ? false : 'hidden'}
        animate={revealed ? 'show' : 'hidden'}
        className="lawyer-page admin-dossier mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      >
        {/* ── Back to the screen the dossier was opened from ──────────────────── */}
        <motion.div variants={RISE} className="flex items-center">
          <Link
            href={back.href}
            className="neu-raised-sm inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#E5D8CB] pl-3 pr-4 font-inter text-[11.5px] font-semibold text-[#341512] transition-[translate,color] duration-200 hover:-translate-y-0.5 hover:text-[#A8742E] active:translate-y-0"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            {back.label}
          </Link>
        </motion.div>

        {/* ── Profile banner (the client profile's header card) ─────────────── */}
        <motion.section
          variants={EMBOSS}
          aria-labelledby="dossier-name"
          className="neu-raised-highlight relative flex w-full flex-col items-start justify-between gap-5 rounded-[22px] px-6 py-5 sm:px-8 sm:py-6 md:flex-row md:items-center"
        >
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <motion.div variants={RISE} className="shrink-0">
              <Avatar name={lawyer.fullName} photoUrl={lawyer.photoUrl} />
            </motion.div>
            <div className="min-w-0 space-y-1">
              <div className="-mb-1 overflow-hidden pb-1">
                <motion.h1
                  id="dossier-name"
                  initial={reduceMotion ? false : { y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.85, delay: 0.35, ease: EASE_OUT }}
                  className="font-lora text-xl font-bold leading-snug text-[#341512]/80 sm:text-2xl"
                >
                  {lawyer.fullName || 'Unnamed lawyer'}
                </motion.h1>
              </div>
              <motion.p variants={RISE} className="font-inter text-xs font-light leading-tight text-[#341512]/80 sm:text-[13px]">
                Roll No. <span className="tabular-nums">{lawyer.rollNumber || '—'}</span>
                <span className="mx-2">|</span>
                IBP {lawyer.ibpChapter?.toUpperCase() || '—'}
              </motion.p>
              {meta.length > 0 && (
                <motion.p variants={RISE} className="font-inter text-xs font-light text-[#341512]/80 sm:text-[13px]">
                  {meta.join('  •  ')}
                </motion.p>
              )}
              {lawyer.practiceAreas.length > 0 && (
                <motion.p variants={RISE} className="font-inter text-xs font-light text-[#341512]/80 sm:text-[13px]">
                  {lawyer.practiceAreas.join(' • ')}
                </motion.p>
              )}
            </div>
          </div>

          <motion.div variants={RISE} className="flex shrink-0 flex-col items-start gap-2 md:items-end">
            <span className={`admin-pill admin-pill-${status.tone}`}>{status.label}</span>
            <span className="flex items-center gap-2 font-inter text-[12px] font-semibold text-[#341512]/80">
              <span className={`h-2 w-2 rounded-full ${listed ? 'admin-listing-on' : 'admin-listing-off'}`} aria-hidden />
              {listed ? (lawyer.isAvailable ? 'Listed · Accepting clients' : 'Listed · Not accepting') : 'Hidden from Find a Lawyer'}
            </span>
            {submitted && (
              <span className="font-inter text-[11px] tabular-nums text-[#341512]/70" title={submitted.full}>
                Submitted {submitted.date}
                {lawyer.status === 'pending' && lawyer.submittedAt ? ` · waiting ${waitedFor(lawyer.submittedAt, now)}` : ''}
              </span>
            )}
          </motion.div>
        </motion.section>

        <AnimatePresence initial={false}>
          {notice && (
            <NeuAlert key="notice" tone="success" onDismiss={() => setNotice(null)}>
              {notice}
            </NeuAlert>
          )}
        </AnimatePresence>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto my-1 w-[78%] shrink-0" aria-hidden />

        {/* ── About: the full statement beside the consultation rates ─────── */}
        <motion.section variants={GROUP} aria-label="Statement and consultation rates" className="flex flex-col gap-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
            <motion.div variants={CARVE} className="rounded-[24px] bg-[#E5D8CB] px-6 py-6 sm:px-8 sm:py-7">
              <motion.p variants={RISE} className="whitespace-pre-line text-justify font-inter text-[13px] leading-relaxed text-[#341512]/80">
                {lawyer.about || 'The lawyer has not written a statement yet.'}
              </motion.p>
            </motion.div>
            <motion.div variants={EMBOSS} className="neu-raised-highlight flex flex-col justify-center gap-4 rounded-[24px] px-6 py-6 sm:px-7">
              <motion.h3 variants={RISE} className="text-center font-lora text-lg font-bold text-[#341512]/80">
                Consultation Rates
              </motion.h3>
              <dl className="flex flex-col gap-3.5 font-inter text-[#341512]/80">
                {rates.map((row) => (
                  <motion.div variants={RISE} key={row.label} className="flex items-baseline justify-between gap-3">
                    <dt className="font-lora text-[13.5px] font-medium">{row.label}</dt>
                    <dd className="shrink-0 whitespace-nowrap font-lora text-[14.5px] font-bold tabular-nums">
                      {row.value != null ? peso(row.value) : <span className="font-inter text-[12px] font-normal italic text-[#341512]/60">Not set</span>}
                    </dd>
                  </motion.div>
                ))}
              </dl>
            </motion.div>
          </div>
        </motion.section>

        {/* ── Bar credentials: every value in full ────────────────────────── */}
        <motion.section variants={GROUP} aria-labelledby="dossier-credentials" className="flex flex-col gap-5">
          <SectionTitle id="dossier-credentials">Bar Credentials</SectionTitle>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Credential label="Roll of Attorneys No." value={lawyer.rollNumber || '—'} mono />
            <Credential label="IBP Chapter" value={lawyer.ibpChapter || '—'} />
            <Credential label="Bar Class" value={lawyer.barPasserYear ?? '—'} mono />
            <Credential label="Years of Practice" value={lawyer.experienceYears != null ? `${lawyer.experienceYears} year${lawyer.experienceYears === 1 ? '' : 's'}` : '—'} />
            <Credential label="Account Email" value={lawyer.email ? <WrappingEmail email={lawyer.email} /> : '—'} />
            <Credential label="Account Created" value={created ? `${created.date}, ${created.time}` : '—'} mono />
          </dl>
        </motion.section>

        {/* ── Practice & languages ────────────────────────────────────────── */}
        <motion.section variants={GROUP} aria-labelledby="dossier-practice" className="flex flex-col gap-5">
          <SectionTitle id="dossier-practice">Practice &amp; Languages</SectionTitle>
          <motion.div variants={RISE} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-3">
              <p className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>Practice areas</p>
              {lawyer.practiceAreas.length ? (
                <ul className="flex flex-wrap gap-2.5">
                  {lawyer.practiceAreas.map((area) => (
                    <Chip key={area}>{area}</Chip>
                  ))}
                </ul>
              ) : (
                <p className="font-inter text-[12.5px] text-[#7D6855]">Not specified</p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <p className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>Languages</p>
              {lawyer.languages.length ? (
                <ul className="flex flex-wrap gap-2.5">
                  {lawyer.languages.map((language) => (
                    <Chip key={language}>{language}</Chip>
                  ))}
                </ul>
              ) : (
                <p className="font-inter text-[12.5px] text-[#7D6855]">Not specified</p>
              )}
            </div>
          </motion.div>
        </motion.section>

        {/* ── Proof documents (private bucket, opened through short-lived links) ── */}
        <motion.section variants={GROUP} aria-labelledby="dossier-documents" className="flex flex-col gap-5">
          <SectionTitle id="dossier-documents">Verification Documents</SectionTitle>
          <DossierDocuments lawyerId={lawyer.userId} applicationStatus={lawyer.status} />
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto my-1 w-[78%] shrink-0" aria-hidden />

        {/* ── Verification + activity, at the end of the dossier ──────────── */}
        <motion.div variants={GROUP} className="grid gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-7">
          <motion.section variants={GROUP} aria-labelledby="dossier-decision" className="flex flex-col gap-5">
            <SectionTitle id="dossier-decision">Verification</SectionTitle>
            <motion.div variants={EMBOSS} className="flex flex-1 flex-col gap-5 rounded-[28px] bg-[#E5D8CB] p-6 sm:p-7">
              <motion.div variants={RISE} className="flex items-start justify-between gap-4">
                <p className="font-inter text-[12.5px] leading-relaxed text-[#5C4535]">{status.summary}</p>
                <span className={`admin-pill admin-pill-${status.tone} shrink-0`}>{status.label}</span>
              </motion.div>
              {note && (
                <motion.div variants={RISE} className={`admin-dossier-note admin-dossier-note-${note.tone} rounded-[14px] px-4 py-3`}>
                  <p className={`text-[9.5px] ${CAPS}`}>{note.label}</p>
                  <p className="mt-1 font-inter text-[12.5px] leading-relaxed text-[#3E2A1E]">{note.text}</p>
                </motion.div>
              )}
              {/* Only the actions that are valid for the current status: pending applications can be
                  approved, sent back or rejected; verified lawyers only get the separately audited
                  post-approval actions. */}
              {(reviewDecisions.length > 0 || postApproval.length > 0) && (
                <motion.div variants={RISE} className="flex flex-wrap gap-2.5 [&>*]:min-w-[170px] [&>*]:flex-1">
                  {reviewDecisions.includes('approved') && (
                    <DecisionButton tone="primary" glyph={DECISION_GLYPH.approved} onClick={() => setDecision('approved')}>
                      Approve lawyer
                    </DecisionButton>
                  )}
                  {reviewDecisions.includes('needs_resubmission') && (
                    <DecisionButton tone="plain" glyph={DECISION_GLYPH.needs_resubmission} onClick={() => setDecision('needs_resubmission')}>
                      Request information
                    </DecisionButton>
                  )}
                  {reviewDecisions.includes('rejected') && (
                    <DecisionButton tone="danger" glyph={DECISION_GLYPH.rejected} onClick={() => setDecision('rejected')}>
                      Reject application
                    </DecisionButton>
                  )}
                  {postApproval.includes('reverify') && (
                    <DecisionButton tone="plain" glyph={DECISION_GLYPH.reverify} onClick={() => setDecision('reverify')}>
                      Request re-verification
                    </DecisionButton>
                  )}
                  {postApproval.includes('revoke') && (
                    <DecisionButton tone="danger" glyph={DECISION_GLYPH.revoke} onClick={() => setDecision('revoke')}>
                      Revoke verification
                    </DecisionButton>
                  )}
                </motion.div>
              )}
              <motion.div variants={RISE} className="neu-recessed rounded-[18px]">
                <AccountStandingPanel userId={lawyer.userId} onChanged={() => router.refresh()} />
              </motion.div>
              <motion.dl variants={RISE} className="admin-queue-more mt-auto grid grid-cols-2 gap-3 pt-4">
                <div>
                  <dt className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>Submitted</dt>
                  <dd className="mt-1 font-inter text-[12px] font-semibold tabular-nums text-[#3E2A1E]">{submitted ? `${submitted.date}, ${submitted.time}` : '—'}</dd>
                </div>
                <div>
                  <dt className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>Last reviewed</dt>
                  <dd className="mt-1 font-inter text-[12px] font-semibold tabular-nums text-[#3E2A1E]">{reviewed ? `${reviewed.date}, ${reviewed.time}` : 'Not yet'}</dd>
                </div>
              </motion.dl>
            </motion.div>
          </motion.section>

          <motion.section variants={GROUP} aria-labelledby="dossier-activity" className="flex flex-col gap-5">
            <SectionTitle id="dossier-activity">Activity</SectionTitle>
            <motion.div variants={EMBOSS} className="flex-1 rounded-[28px] bg-[#E5D8CB] p-6 sm:p-7">
              {activity.length ? (
                <ol className="admin-dossier-timeline flex flex-col">
                  {activity.map((entry) => {
                    const line = describeActivity(entry);
                    const wording = dossierActivity(entry, lawyer.fullName);
                    const at = stamp(entry.timestamp, now);
                    return (
                      <motion.li variants={RISE} key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                        <span className="admin-overview-badge relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ color: TONE_COLOR[line.tone] }} aria-hidden>
                          <ActivityIcon name={line.icon} className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 pt-1">
                          <div className="min-w-0">
                            <p className="font-lora text-[14px] font-semibold leading-snug text-[#341512]">{wording.title}</p>
                            {wording.actor && <p className="mt-0.5 font-inter text-[11px] text-[#7D6855]">{wording.actor}</p>}
                          </div>
                          <time dateTime={entry.timestamp} title={timeAgo(entry.timestamp, now)} className="shrink-0 font-inter text-[11px] tabular-nums text-[#7D6855]">
                            {at.date}, {at.time}
                          </time>
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              ) : (
                <motion.p variants={RISE} className="font-inter text-[12.5px] text-[#7D6855]">
                  No activity has been recorded for this lawyer yet.
                </motion.p>
              )}
            </motion.div>
          </motion.section>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {decision && (
          <ReviewDecisionModal
            key={decision}
            lawyer={asQueueItem}
            decision={decision}
            onCancel={() => setDecision(null)}
            onConfirm={confirmDecision}
            onDone={finishDecision}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

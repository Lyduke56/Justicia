'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { VerificationDocumentsPanel } from './VerificationDocumentsPanel';
import { SUPPORT_EMAIL } from '@/lib/support';
import { NeuAlert } from '@/components/shared/neu';
import { EMBOSS, RISE } from './motion';
import {
  CompactTracker,
  ONBOARD_EASE,
  OnboardingShell,
  RailTracker,
  WorkAreaHeading,
  useLeaveLoader,
  type TrackerItem,
} from './onboarding/OnboardingShell';

/**
 * Application Status, in the same onboarding frame as the registration form: the rail tracks
 * the application (submitted → under review → decision, plus "update & resubmit" when the team
 * asks for more), and the work area shows the status at a glance, what happens next, and the
 * verification documents.
 */

interface LawyerVerificationStatusProps {
  profile: {
    verification_status: string;
    rejection_reason: string | null;
    admin_notes: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    full_name: string | null;
  } | null;
  email: string;
  fullName: string;
}

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'needs_resubmission' | 'draft' | string;

/** How each status reads at a glance: label, one-line summary, colour and icon. */
const STATUS_META: Record<string, { label: string; summary: string; color: string; tint: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Under Review',
    summary: 'Our team is checking your credentials. This typically takes 1–3 business days.',
    color: '#B7791F',
    tint: 'rgba(183, 121, 31, 0.14)',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3h12M6 21h12M7 3c0 5 5 5 5 9s-5 4-5 9M17 3c0 5-5 5-5 9s5 4 5 9" />
      </svg>
    ),
  },
  approved: {
    label: 'Approved',
    summary: 'You are a verified Justicia lawyer.',
    color: '#1F7A3A',
    tint: 'rgba(31, 122, 58, 0.14)',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <motion.path d="m5 12.5 4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.55, ease: ONBOARD_EASE }} />
      </svg>
    ),
  },
  rejected: {
    label: 'Not Approved',
    summary: 'We were unable to verify your credentials at this time.',
    color: '#B42318',
    tint: 'rgba(180, 35, 24, 0.12)',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
        <path d="M7 7l10 10M17 7 7 17" />
      </svg>
    ),
  },
  needs_resubmission: {
    label: 'Additional Info Needed',
    summary: 'The review team needs a little more from you before they can decide.',
    color: '#C2410C',
    tint: 'rgba(194, 65, 12, 0.12)',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="6" y="4" width="12" height="17" rx="2" />
        <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 11h6M9 15h4" />
      </svg>
    ),
  },
  draft: {
    label: 'Draft',
    summary: 'Your application has not been submitted yet.',
    color: '#7D6855',
    tint: 'rgba(125, 104, 85, 0.14)',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
        <path d="m13.5 6.5 4 4" />
      </svg>
    ),
  },
};

const formatDate = (value: string, withTime = false) =>
  new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: withTime ? 'long' : 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });

/** The work area's sections arrive one after another, after the rail has started. */
const PAGE: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } } };

function StatusMedallion({ status }: { status: VerificationStatus }) {
  const reduce = useReducedMotion();
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <div className="relative grid size-24 shrink-0 place-items-center">
      {/* A soft glow in the status colour. */}
      <span aria-hidden="true" className="absolute inset-0 rounded-full blur-xl" style={{ backgroundColor: meta.tint }} />
      {/* Pending: a slow caramel ring keeps turning while the team reviews. */}
      {status === 'pending' && !reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-1 rounded-full border-[3px] border-transparent"
          style={{ borderTopColor: meta.color, borderRightColor: `${meta.color}55` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3.2, ease: 'linear', repeat: Infinity }}
        />
      )}
      <motion.span
        initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.4 }}
        className="neu-raised-sm relative grid size-[72px] place-items-center rounded-full bg-[#E5D8CB]"
        style={{ color: meta.color }}
      >
        {/* One ring ripples out as the medallion lands. */}
        <motion.span
          aria-hidden="true"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 1.1, delay: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-current"
        />
        {meta.icon}
      </motion.span>
    </div>
  );
}

/** The application's milestones for the rail and the phone header. */
function timeline(status: VerificationStatus, submittedAt: string | null, reviewedAt: string | null): TrackerItem[] {
  const decided = ['approved', 'rejected', 'needs_resubmission'].includes(status);
  const decisionTone = (STATUS_META[status] ?? STATUS_META.pending).color;
  const items: TrackerItem[] = [
    {
      key: 'submitted',
      label: 'Application submitted',
      description: submittedAt ? formatDate(submittedAt) : 'Not yet submitted.',
      state: submittedAt ? 'done' : 'current',
    },
    {
      key: 'review',
      label: 'Under review',
      description: decided ? 'Review complete.' : 'Usually 1–3 business days.',
      state: decided ? 'done' : status === 'pending' ? 'current' : 'upcoming',
    },
    {
      key: 'decision',
      label: status === 'approved' ? 'Approved' : status === 'rejected' ? 'Decision issued' : status === 'needs_resubmission' ? 'More info requested' : 'Decision',
      description: reviewedAt ? formatDate(reviewedAt) : 'You will hear from us by email.',
      state: decided ? 'done' : 'upcoming',
      tone: decided ? decisionTone : undefined,
    },
  ];
  if (status === 'needs_resubmission' || status === 'rejected') {
    items.push({
      key: 'resubmit',
      label: status === 'rejected' ? 'Apply again' : 'Update & resubmit',
      description: status === 'rejected' ? 'With updated credentials.' : 'Send the requested details.',
      state: 'current',
    });
  }
  return items;
}

const ctaClass =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 font-lora text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60';
const sectionClass = 'neu-raised rounded-[28px] bg-[#E5D8CB] p-5 sm:p-7 lg:p-8';
const linkClass = 'font-semibold text-[#946525] hover:text-[#C58B3C] hover:underline';

export function LawyerVerificationStatus({ profile, email, fullName }: LawyerVerificationStatusProps) {
  const leave = useLeaveLoader();
  const status = profile?.verification_status ?? 'draft';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';
  const needsResubmission = status === 'needs_resubmission';
  const isDraft = status === 'draft' || !profile;
  const isApproved = status === 'approved';
  const shownStatus = isDraft ? 'draft' : status;
  const meta = STATUS_META[shownStatus] ?? STATUS_META.pending;
  const items = timeline(shownStatus, profile?.submitted_at ?? null, profile?.reviewed_at ?? null);

  const homeLink = (className = linkClass) => (
    <Link href="/client/dashboard" onClick={leave.onLinkClick()} className={className}>
      Return to Home
    </Link>
  );

  return (
    <OnboardingShell
      eyebrow="Lawyer Verification"
      title="Application Status"
      description="Follow your application from submission to decision. We will also email you at every step."
      rail={<RailTracker items={items} label="Application timeline" />}
      compactRail={<CompactTracker items={items} caption={`Status · ${meta.label}`} />}
      footerLink={<p>{homeLink('font-semibold text-[#D29D54] transition-colors hover:text-[#E0A458] hover:underline')}</p>}
    >
      <motion.div
        variants={PAGE}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-[840px] space-y-6 px-5 pb-12 pt-8 sm:px-8 lg:my-auto lg:px-12 lg:py-12"
      >
        <WorkAreaHeading
          eyebrow="Your application"
          title={fullName ? `Hello, ${fullName}` : 'Hello'}
          intro={
            <>
              Here is where your Justicia lawyer application stands
              {!fullName && email ? (
                <>
                  {' '}for <span className="font-semibold text-[#34150F] [overflow-wrap:anywhere]">{email}</span>
                </>
              ) : null}
              .
            </>
          }
        />

        {/* Status at a glance */}
        <motion.section variants={EMBOSS} aria-labelledby="status-heading" className={`${sectionClass} relative overflow-hidden`}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl"
            style={{ backgroundColor: meta.tint }}
          />
          <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
            <StatusMedallion status={shownStatus} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <motion.p variants={RISE} className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#7D6855]">
                Application status
              </motion.p>
              <motion.h2 variants={RISE} id="status-heading" className="font-lora text-[26px] font-semibold leading-tight" style={{ color: meta.color }}>
                {meta.label}
              </motion.h2>
              <motion.p variants={RISE} className="font-inter text-[13px] leading-relaxed text-[#5C4535]">
                {meta.summary}
              </motion.p>
            </div>
            {profile?.submitted_at && (
              <motion.div variants={RISE} className="neu-recessed shrink-0 rounded-2xl px-4 py-2.5 text-center">
                <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-[#7D6855]">Submitted</p>
                <p className="font-lora text-sm font-semibold text-[#34150F]">{formatDate(profile.submitted_at)}</p>
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* What it means / what to do */}
        <motion.section variants={EMBOSS} aria-label="Next steps" className={`${sectionClass} space-y-5`}>
          {isDraft && (
            <>
              <motion.div variants={RISE}>
                <NeuAlert tone="info" title="Application incomplete">
                  You have not yet submitted your application for review. Complete your registration to get started.
                </NeuAlert>
              </motion.div>
              <motion.div variants={RISE}>
                <Link href="/lawyer/register" onClick={leave.onLinkClick()} className={`${ctaClass} neu-btn-caramel text-[#341512]`}>
                  Complete Your Application
                </Link>
              </motion.div>
            </>
          )}

          {isPending && (
            <>
              <motion.div variants={RISE}>
                <NeuAlert tone="warning" title="Your application is under review">
                  Our team is verifying your credentials against the Integrated Bar of the Philippines records. This typically
                  takes <strong>1–3 business days</strong>.
                </NeuAlert>
              </motion.div>
              <div className="space-y-3">
                <motion.p variants={RISE} className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#A8742E]">
                  What happens next
                </motion.p>
                <ol className="space-y-2.5">
                  {[
                    <>Our admin team will review your Roll of Attorneys number and IBP Chapter.</>,
                    <>
                      You will receive an email notification at <strong className="text-[#34150F] [overflow-wrap:anywhere]">{email}</strong> when a
                      decision is made.
                    </>,
                    <>If approved, your profile becomes live on &ldquo;Find a Lawyer&rdquo; and you can accept clients.</>,
                  ].map((text, i) => (
                    <motion.li
                      key={i}
                      variants={RISE}
                      className="neu-recessed flex items-start gap-3 rounded-2xl px-4 py-3 font-inter text-[13px] leading-relaxed text-[#3E2A1E]"
                    >
                      <span className="neu-raised-sm mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-lora text-[11px] font-bold text-[#C58B3C]">
                        {i + 1}
                      </span>
                      <span>{text}</span>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {isRejected && (
            <>
              <motion.div variants={RISE}>
                <NeuAlert tone="error" title="Application not approved">
                  Unfortunately, we were unable to verify your credentials at this time. You may re-submit a new application with
                  updated information.
                </NeuAlert>
              </motion.div>
              {profile?.rejection_reason && (
                <motion.div variants={RISE} className="neu-recessed rounded-2xl px-5 py-4">
                  <p className="font-inter text-[10.5px] font-bold uppercase tracking-wider text-[#B42318]">Reason for decision</p>
                  <p className="mt-1 whitespace-pre-line font-inter text-[13px] leading-relaxed text-[#34150F]">{profile.rejection_reason}</p>
                </motion.div>
              )}
              <motion.div variants={RISE} className="font-inter text-[13px] leading-relaxed text-[#5C4535]">
                <p className="font-semibold text-[#34150F]">You can register again</p>
                <p>
                  If you believe this decision was made in error, or if you have updated credentials, you are welcome to submit a
                  new application.
                </p>
              </motion.div>
              <motion.div variants={RISE}>
                <Link href="/lawyer/register" onClick={leave.onLinkClick()} className={`${ctaClass} neu-btn-espresso text-[#F3E6D6]`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Register Again
                </Link>
              </motion.div>
            </>
          )}

          {needsResubmission && (
            <>
              <motion.div variants={RISE}>
                <NeuAlert tone="warning" title="Additional information required">
                  Our team has reviewed your application and requires additional information before we can proceed.
                </NeuAlert>
              </motion.div>
              {profile?.admin_notes && (
                <motion.div variants={RISE} className="neu-recessed rounded-2xl px-5 py-4">
                  <p className="font-inter text-[10.5px] font-bold uppercase tracking-wider text-[#C2410C]">Message from admin</p>
                  <p className="mt-1 whitespace-pre-line font-inter text-[13px] leading-relaxed text-[#34150F]">{profile.admin_notes}</p>
                </motion.div>
              )}
              <motion.div variants={RISE}>
                <Link href="/lawyer/register" onClick={leave.onLinkClick()} className={`${ctaClass} neu-btn-caramel text-[#341512]`}>
                  Update & Resubmit Application
                </Link>
              </motion.div>
            </>
          )}

          {isApproved && (
            <>
              <motion.div variants={RISE}>
                <NeuAlert tone="success" title="You are a verified Justicia lawyer">
                  Justicia now keeps proof documents on file for every verified lawyer. Please upload the required ones below; your
                  profile stays live while you do.
                </NeuAlert>
              </motion.div>
              <motion.div variants={RISE}>
                <Link href="/lawyer/dashboard" onClick={leave.onLinkClick('Opening your dashboard...')} className={`${ctaClass} neu-btn-caramel text-[#341512]`}>
                  Go to your dashboard
                </Link>
              </motion.div>
            </>
          )}
        </motion.section>

        {/* Verification documents (locked while under review) */}
        {!isDraft && (
          <motion.section variants={EMBOSS} aria-labelledby="docs-heading" className={`${sectionClass} space-y-4`}>
            <motion.div variants={RISE} className="flex items-center gap-3">
              <h2 id="docs-heading" className="font-lora text-lg font-semibold text-[#34150F]">
                Verification documents
              </h2>
              <span className="h-px flex-1 bg-gradient-to-r from-[#C8B59E]/80 to-transparent" aria-hidden="true" />
            </motion.div>
            <motion.div variants={RISE}>
              <VerificationDocumentsPanel
                intro={
                  needsResubmission || isRejected
                    ? 'Replace any document marked “Needs a new file”, then update and resubmit your application.'
                    : undefined
                }
              />
            </motion.div>
          </motion.section>
        )}

        {/* Help (the rail carries it on desktop) */}
        <motion.footer variants={RISE} className="space-y-1.5 pt-2 text-center font-inter text-[12px] text-[#7D6855] lg:hidden">
          <p>
            Questions about your application? Contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p>{homeLink()}</p>
        </motion.footer>
      </motion.div>
      {leave.loader}
    </OnboardingShell>
  );
}

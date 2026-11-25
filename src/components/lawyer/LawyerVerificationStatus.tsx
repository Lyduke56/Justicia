'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { VerificationDocumentsPanel } from './VerificationDocumentsPanel';
import { SUPPORT_EMAIL } from '@/lib/support';
import { NeuAlert } from '@/components/shared/neu';

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

const EASE = [0.22, 1, 0.36, 1] as const;

/** How each status reads at a glance: label, one-line summary, colour and icon. */
const STATUS_META: Record<string, { label: string; summary: string; color: string; tint: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Under Review',
    summary: 'Our team is checking your credentials. This typically takes 1–3 business days.',
    color: '#B7791F',
    tint: 'rgba(183, 121, 31, 0.12)',
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
    tint: 'rgba(31, 122, 58, 0.12)',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    ),
  },
  rejected: {
    label: 'Not Approved',
    summary: 'We were unable to verify your credentials at this time.',
    color: '#B42318',
    tint: 'rgba(180, 35, 24, 0.1)',
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
    tint: 'rgba(194, 65, 12, 0.1)',
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
    tint: 'rgba(125, 104, 85, 0.12)',
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

const page: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

function StatusMedallion({ status }: { status: VerificationStatus }) {
  const reduce = useReducedMotion();
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <div className="relative grid size-20 shrink-0 place-items-center">
      {/* Pending: a slow caramel ring keeps turning while the team reviews. */}
      {status === 'pending' && !reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-[3px] border-transparent"
          style={{ borderTopColor: meta.color, borderRightColor: `${meta.color}55` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3.2, ease: 'linear', repeat: Infinity }}
        />
      )}
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.25 }}
        className="neu-raised-sm grid size-16 place-items-center rounded-full"
        style={{ color: meta.color }}
      >
        {meta.icon}
      </motion.span>
    </div>
  );
}

function ProgressTracker({ status, submittedAt, reviewedAt }: { status: VerificationStatus; submittedAt: string | null; reviewedAt: string | null }) {
  const decided = ['approved', 'rejected', 'needs_resubmission'].includes(status);
  const decisionLabel =
    status === 'approved'
      ? 'Application Approved'
      : status === 'rejected'
        ? 'Decision Issued'
        : status === 'needs_resubmission'
          ? 'Info Requested'
          : 'Decision';
  const steps = [
    { label: 'Application Submitted', date: submittedAt, done: !!submittedAt, active: !submittedAt },
    { label: 'Under Review', date: null, done: decided, active: status === 'pending' },
    { label: decisionLabel, date: reviewedAt, done: decided, active: false },
  ];
  const completed = steps.filter((s) => s.done).length;
  const fill = completed <= 1 ? (status === 'pending' ? 0.5 : 0) : 1;
  const decisionColor = (STATUS_META[status] ?? STATUS_META.pending).color;

  return (
    <ol className="relative grid grid-cols-3 gap-2" aria-label="Application timeline">
      <span aria-hidden="true" className="absolute left-[16.66%] right-[16.66%] top-[15px] h-1 rounded-full neu-pressed" />
      <motion.span
        aria-hidden="true"
        className="absolute left-[16.66%] top-[15px] h-1 rounded-full bg-[#C58B3C]"
        initial={{ width: 0 }}
        animate={{ width: `calc(66.68% * ${fill})` }}
        transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
      />
      {steps.map((step, i) => {
        const isDecision = i === 2 && step.done;
        return (
          <li key={i} className="relative z-10 flex flex-col items-center text-center" aria-current={step.active ? 'step' : undefined}>
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.35 + i * 0.12 }}
              className={`relative grid size-8 place-items-center rounded-full font-inter text-xs font-bold ${
                step.done ? 'text-white' : step.active ? 'neu-raised-sm text-[#C58B3C] ring-2 ring-[#C58B3C]' : 'neu-pressed text-[#A69584]'
              }`}
              style={step.done ? { backgroundColor: isDecision ? decisionColor : '#C58B3C' } : undefined}
            >
              {step.done ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                i + 1
              )}
              {step.active && <span aria-hidden="true" className="neu-beacon absolute inset-0 rounded-full border-2 border-[#C58B3C]" />}
            </motion.span>
            <span className={`mt-2 font-inter text-[11px] sm:text-[12px] font-semibold leading-tight ${step.done || step.active ? 'text-[#34150F]' : 'text-[#A69584]'}`}>
              {step.label}
            </span>
            {step.date && <span className="mt-0.5 font-inter text-[10.5px] text-[#7D6855]">{formatDate(step.date)}</span>}
            <span className="sr-only">{step.done ? '(done)' : step.active ? '(in progress)' : '(not yet)'}</span>
          </li>
        );
      })}
    </ol>
  );
}

const ctaClass =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 font-lora text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60';

export function LawyerVerificationStatus({ profile, email, fullName }: LawyerVerificationStatusProps) {
  const status = profile?.verification_status ?? 'draft';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';
  const needsResubmission = status === 'needs_resubmission';
  const isDraft = status === 'draft' || !profile;
  const isApproved = status === 'approved';
  const meta = STATUS_META[isDraft ? 'draft' : status] ?? STATUS_META.pending;

  return (
    <div className="min-h-screen bg-[#E5D8CB] py-10 sm:py-14 px-4">
      <motion.div variants={page} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <motion.header variants={rise} className="text-center space-y-2.5">
          <p className="inline-flex items-center gap-3 font-inter text-[10.5px] font-semibold uppercase tracking-[0.26em] text-[#C58B3C]">
            <span className="h-px w-8 bg-[#C58B3C]/60" aria-hidden="true" />
            Lawyer Verification
            <span className="h-px w-8 bg-[#C58B3C]/60" aria-hidden="true" />
          </p>
          <h1 className="font-lora text-3xl sm:text-4xl font-semibold text-[#34150F]">Application Status</h1>
          <p className="font-inter text-[13.5px] text-[#5C4535]">
            Hello, <span className="font-semibold text-[#34150F]">{fullName || email}</span>. Here is the current status of your
            Justicia lawyer application.
          </p>
        </motion.header>

        {/* Status at a glance */}
        <motion.section variants={rise} aria-labelledby="status-heading" className="neu-raised rounded-[28px] bg-[#E5D8CB] p-6 sm:p-8 space-y-7">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
            <StatusMedallion status={isDraft ? 'draft' : status} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#7D6855]">Application Status</p>
              <h2 id="status-heading" className="font-lora text-2xl font-semibold" style={{ color: meta.color }}>
                {meta.label}
              </h2>
              <p className="font-inter text-[13px] leading-relaxed text-[#5C4535]">{meta.summary}</p>
            </div>
            {profile?.submitted_at && (
              <div className="neu-recessed shrink-0 rounded-2xl px-4 py-2.5 text-center">
                <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-[#7D6855]">Submitted</p>
                <p className="font-lora text-sm font-semibold text-[#34150F]">{formatDate(profile.submitted_at)}</p>
              </div>
            )}
          </div>

          {profile && <ProgressTracker status={status} submittedAt={profile.submitted_at} reviewedAt={profile.reviewed_at} />}
        </motion.section>

        {/* What it means / what to do */}
        <motion.section variants={rise} className="neu-raised rounded-[28px] bg-[#E5D8CB] p-6 sm:p-8 space-y-5">
          {isDraft && (
            <>
              <NeuAlert tone="info" title="Application incomplete">
                You have not yet submitted your application for review. Complete your registration to get started.
              </NeuAlert>
              <Link href="/lawyer/register" className={`${ctaClass} neu-btn-caramel text-[#341512]`}>
                Complete Your Application
              </Link>
            </>
          )}

          {isPending && (
            <>
              <NeuAlert tone="warning" title="Your application is under review">
                Our team is verifying your credentials against the Integrated Bar of the Philippines records. This typically
                takes <strong>1–3 business days</strong>.
              </NeuAlert>
              <div className="space-y-3">
                <p className="font-lora text-xs font-bold uppercase tracking-wider text-[#5C4535]">What happens next</p>
                <ul className="space-y-2.5">
                  {[
                    <>Our admin team will review your Roll of Attorneys number and IBP Chapter.</>,
                    <>
                      You will receive an email notification at <strong className="text-[#34150F]">{email}</strong> when a decision is
                      made.
                    </>,
                    <>If approved, your profile becomes live on &ldquo;Find a Lawyer&rdquo; and you can accept clients.</>,
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3 font-inter text-[13px] leading-relaxed text-[#3E2A1E]">
                      <span className="neu-raised-sm mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-lora text-[11px] font-bold text-[#C58B3C]">
                        {i + 1}
                      </span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {isRejected && (
            <>
              <NeuAlert tone="error" title="Application not approved">
                Unfortunately, we were unable to verify your credentials at this time. You may re-submit a new application with
                updated information.
              </NeuAlert>
              {profile?.rejection_reason && (
                <div className="neu-recessed rounded-2xl px-5 py-4">
                  <p className="font-inter text-[10.5px] font-bold uppercase tracking-wider text-[#B42318]">Reason for decision</p>
                  <p className="mt-1 font-inter text-[13px] leading-relaxed text-[#34150F] whitespace-pre-line">{profile.rejection_reason}</p>
                </div>
              )}
              <div className="font-inter text-[13px] leading-relaxed text-[#5C4535]">
                <p className="font-semibold text-[#34150F]">You can register again</p>
                <p>
                  If you believe this decision was made in error, or if you have updated credentials, you are welcome to submit a
                  new application.
                </p>
              </div>
              <Link href="/lawyer/register" className={`${ctaClass} neu-btn-espresso text-[#F3E6D6]`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Register Again
              </Link>
            </>
          )}

          {needsResubmission && (
            <>
              <NeuAlert tone="warning" title="Additional information required">
                Our team has reviewed your application and requires additional information before we can proceed.
              </NeuAlert>
              {profile?.admin_notes && (
                <div className="neu-recessed rounded-2xl px-5 py-4">
                  <p className="font-inter text-[10.5px] font-bold uppercase tracking-wider text-[#C2410C]">Message from admin</p>
                  <p className="mt-1 font-inter text-[13px] leading-relaxed text-[#34150F] whitespace-pre-line">{profile.admin_notes}</p>
                </div>
              )}
              <Link href="/lawyer/register" className={`${ctaClass} neu-btn-caramel text-[#341512]`}>
                Update & Resubmit Application
              </Link>
            </>
          )}

          {isApproved && (
            <>
              <NeuAlert tone="success" title="You are a verified Justicia lawyer">
                Justicia now keeps proof documents on file for every verified lawyer. Please upload the required ones below; your
                profile stays live while you do.
              </NeuAlert>
              <Link href="/lawyer/dashboard" className={`${ctaClass} neu-btn-caramel text-[#341512]`}>
                Go to your dashboard
              </Link>
            </>
          )}
        </motion.section>

        {/* Verification documents (locked while under review) */}
        {!isDraft && (
          <motion.section variants={rise} aria-labelledby="docs-heading" className="neu-raised rounded-[28px] bg-[#E5D8CB] p-6 sm:p-8 space-y-4">
            <h2 id="docs-heading" className="font-lora text-lg font-semibold text-[#34150F]">
              Verification Documents
            </h2>
            <VerificationDocumentsPanel
              intro={
                needsResubmission || isRejected
                  ? 'Replace any document marked “Needs a new file”, then update and resubmit your application.'
                  : undefined
              }
            />
          </motion.section>
        )}

        {/* Help section */}
        <motion.footer variants={rise} className="text-center font-inter text-[12px] text-[#7D6855] space-y-1.5">
          <p>
            Questions about your application? Contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#946525] hover:text-[#C58B3C] hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p>
            <Link href="/client/dashboard" className="font-semibold text-[#946525] hover:text-[#C58B3C] hover:underline">
              Return to Home
            </Link>
          </p>
        </motion.footer>
      </motion.div>
    </div>
  );
}

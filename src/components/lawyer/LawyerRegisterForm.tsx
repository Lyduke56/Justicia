'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useAnimate, useReducedMotion, type Variants } from 'motion/react';
import { signUpAction } from '@/app/actions/auth';
import { saveLawyerDraftAction, submitLawyerApplicationAction } from '@/app/actions/lawyerRegistration';
import type { VerificationDocumentView } from '@/app/actions/lawyerVerificationDocs';
import { VerificationDocumentsPanel } from './VerificationDocumentsPanel';
import { REQUIRED_DOCUMENT_TYPES, documentGapMessage } from '@/lib/lawyer/verification';
import { NeuAlert, NeuButton, NeuNumberStepper, ChevronLeftIcon, ChevronRightIcon, PencilIcon } from '@/components/shared/neu';
import { SubmissionModal, useSubmission } from '@/components/shared/feedback';
import { bareAttorneyName, formatAttorneyName } from '@/lib/utils/attorneyName';
import { EMBOSS, RISE } from './motion';
import {
  CompactTracker,
  ONBOARD_EASE,
  OnboardingShell,
  RAIL_ITEM,
  RailTracker,
  WorkAreaHeading,
  useLeaveLoader,
  type TrackerItem,
} from './onboarding/OnboardingShell';

/**
 * Register as a Verified Lawyer: a five-step application in the onboarding frame (dark rail
 * with the step tracker, parchment work area with a sticky action bar).
 *
 * Motion: each step slides in the direction you are going, its heading and card cascade in and
 * the card's fields rise one after another. A step that can't continue shakes its card and
 * moves focus to the first field that needs attention. Finished steps can be reopened from the
 * tracker. Submitting shows the submission card, then the loading screen while the status page
 * opens.
 */

interface ExistingUser { id: string; email: string; fullName?: string }

type Step = 0 | 1 | 2 | 3 | 4;
/** Step numbers (the documents step sits between credentials and profile). */
const DOCUMENTS_STEP = 2;
const PROFILE_STEP = 3;
const REVIEW_STEP = 4;

const STEPS: Record<Step, { label: string; rail: string; title: string; intro: string }> = {
  0: { label: 'Account', rail: 'Your name, email and password.', title: 'Create your account', intro: 'Use your legal name as it appears on your credentials. We add “Atty.” for you.' },
  1: { label: 'Credentials', rail: 'Roll number, IBP chapter, bar year.', title: 'Credentials & verification', intro: 'We check these against the Roll of Attorneys and your IBP chapter.' },
  2: { label: 'Documents', rail: 'Proof of admission and an ID.', title: 'Verification documents', intro: 'Proof of bar admission, IBP membership and a government ID. Each file saves as soon as it uploads.' },
  3: { label: 'Profile', rail: 'What clients see about you.', title: 'Your public profile', intro: 'This is what clients see when they look for a lawyer on Justicia.' },
  4: { label: 'Review & Submit', rail: 'One last look, then send.', title: 'Review & submit', intro: 'Check everything once more before sending your application to the review team.' },
};
const STEP_ORDER: Step[] = [0, 1, 2, 3, 4];

const IBP_CHAPTERS = [
  'NCR — Makati','NCR — Manila','NCR — Quezon City','NCR — Pasig','NCR — Taguig',
  'Cebu','Davao','Iloilo','Pampanga','Laguna','Cavite','Rizal','Batangas','Bulacan','Baguio',
];

const PRACTICE_AREAS = [
  'Labor & Employment','Corporate Law','Civil Law','Criminal Law','Family Law',
  'Real Estate','Tax Law','Immigration','Intellectual Property','Environmental Law',
  'Constitutional Law','Banking & Finance','Maritime Law','Human Rights','Commercial Arbitration',
];

const LANGUAGES = ['Filipino','Tagalog','English','Cebuano','Ilocano','Hiligaynon','Waray','Kapampangan','Spanish'];

interface FormState {
  // Step 0 — Account
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  // Step 1 — Credentials
  rollNumber: string;
  ibpChapter: string;
  barPasserYear: string;
  // Step 3 — Profile
  about: string;
  practiceAreas: string[];
  languages: string[];
  experienceYears: string;
  feeInitial: string;
  feeStandard: string;
  feeExtended: string;
  photoUrl: string;
}

const INITIAL: FormState = {
  fullName: '', email: '', password: '', confirmPassword: '',
  rollNumber: '', ibpChapter: '', barPasserYear: '',
  about: '', practiceAreas: [], languages: [], experienceYears: '',
  feeInitial: '', feeStandard: '', feeExtended: '', photoUrl: '',
};

interface LawyerDraft {
  full_name?: string;
  roll_number?: string;
  ibp_chapter?: string;
  bar_passer_year?: number | null;
  about?: string;
  practice_areas?: string[];
  languages?: string[];
  experience_years?: number | null;
  fee_initial_30min?: number | null;
  fee_standard_60min?: number | null;
  fee_extended_120min?: number | null;
}

type Errors = Partial<Record<keyof FormState | 'general' | 'documents', string>>;

const inputClass = (hasError: boolean, extra = '') =>
  `neu-input w-full h-11 rounded-[13px] px-4 font-inter text-[14px] text-[#34150F] ${hasError ? 'neu-input-error' : ''} ${extra}`;
const labelClass = 'block font-lora text-[13.5px] font-semibold text-[#4A3426]';
const CURRENT_YEAR = new Date().getFullYear();

// ─── Motion ───────────────────────────────────────────────────────────────────

/** A step slides in the direction you are going; its heading, notices and card cascade in. */
const STEP_SECTION: Variants = {
  hidden: (d: number) => ({ opacity: 0, x: 28 * d }),
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: ONBOARD_EASE, staggerChildren: 0.06, delayChildren: 0.04 },
  },
  exit: (d: number) => ({ opacity: 0, x: -28 * d, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }),
};

/** Review cards and chip rows: a quick stagger. */
const STAGGER: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

const SHAKE = { x: [0, -10, 9, -6, 4, 0] };

// ─── Small pieces ─────────────────────────────────────────────────────────────

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          id={id}
          role="alert"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.22, ease: ONBOARD_EASE }}
          className="font-inter text-[11.5px] font-medium text-[#B42318]"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** Thin engraved divider with a small caps title, between groups of fields. */
function GroupTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <motion.div variants={RISE} className="flex items-center gap-3">
      <span className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#A8742E]">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-[#C8B59E]/80 to-transparent" aria-hidden="true" />
      {aside}
    </motion.div>
  );
}

const CheckMark = ({ className = 'h-2.5 w-2.5' }: { className?: string }) => (
  <motion.svg
    viewBox="0 0 10 8"
    fill="none"
    className={className}
    initial={{ scale: 0, rotate: -20 }}
    animate={{ scale: 1, rotate: 0 }}
    exit={{ scale: 0 }}
    transition={{ type: 'spring', stiffness: 600, damping: 22 }}
    aria-hidden="true"
  >
    <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </motion.svg>
);

/** A toggle chip (practice area / language): raised at rest, pressed into the paper when on. */
function Chip({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <motion.label
      variants={RISE}
      whileTap={{ scale: 0.95 }}
      className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-full px-3.5 py-2 font-inter text-[12px] transition-[color,box-shadow,transform] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#C58B3C]/60 ${
        on ? 'neu-pressed font-semibold text-[#34150F]' : 'neu-raised-sm text-[#5C4535] hover:-translate-y-0.5 hover:text-[#34150F]'
      }`}
    >
      <input type="checkbox" checked={on} onChange={onToggle} className="sr-only" />
      <span
        className={`grid size-4 place-items-center rounded-full text-white transition-colors duration-200 ${on ? 'bg-[#C58B3C]' : 'border border-[#C8B59E]'}`}
        aria-hidden="true"
      >
        <AnimatePresence initial={false}>{on && <CheckMark key="on" />}</AnimatePresence>
      </span>
      {label}
    </motion.label>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function LawyerRegisterForm({
  existingUser,
  emailUnconfirmed = false,
  draft = null,
}: {
  existingUser: ExistingUser | null;
  emailUnconfirmed?: boolean;
  draft?: LawyerDraft | null;
}) {
  const reduce = useReducedMotion();
  const leave = useLeaveLoader();
  const [step, setStep] = useState<Step>(existingUser ? 1 : 0);
  const [direction, setDirection] = useState<1 | -1>(1);
  // Once the account exists, its step can't be sent again (it would try to sign up twice).
  const [accountCreated, setAccountCreated] = useState(false);
  const [form, setForm] = useState<FormState>({
    ...INITIAL,
    email: existingUser?.email ?? '',
    // fullName: prefer draft data, then existingUser metadata
    fullName: (draft?.full_name) || (existingUser?.fullName ?? ''),
    // Pre-fill from saved draft if resuming
    rollNumber: draft?.roll_number ?? '',
    ibpChapter: draft?.ibp_chapter ?? '',
    barPasserYear: draft?.bar_passer_year != null ? String(draft.bar_passer_year) : '',
    about: draft?.about ?? '',
    practiceAreas: draft?.practice_areas ?? [],
    languages: draft?.languages ?? [],
    experienceYears: draft?.experience_years != null ? String(draft.experience_years) : '',
    feeInitial: draft?.fee_initial_30min != null ? String(draft.fee_initial_30min) : '',
    feeStandard: draft?.fee_standard_60min != null ? String(draft.fee_standard_60min) : '',
    feeExtended: draft?.fee_extended_120min != null ? String(draft.fee_extended_120min) : '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documents, setDocuments] = useState<VerificationDocumentView[]>([]);
  const documentGap = documentGapMessage(documents.map((d) => ({ docType: d.docType, reviewStatus: d.reviewStatus })));
  const submission = useSubmission();
  const [cardScope, animateCard] = useAnimate<HTMLDivElement>();

  /** The first step shown in the tracker (signed-in applicants skip the account step). */
  const firstStep: Step = existingUser ? 1 : 0;
  /** The earliest step that can be reopened. */
  const earliestEditable: Step = existingUser || accountCreated ? 1 : 0;

  // A new step starts at the top of the page.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    document.getElementById('onboarding-main')?.scrollTo({ top: 0, behavior });
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior });
  }, [step, reduce]);

  const goTo = (next: Step) => {
    if (next === step) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const set = (field: keyof FormState, value: string | string[]) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const toggleArray = (field: 'practiceAreas' | 'languages', value: string) => {
    setForm((f) => {
      const arr = f[field] as string[];
      return { ...f, [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /** Shake the step's card and move focus to the first field that needs attention. */
  const flagProblem = () => {
    if (!reduce && cardScope.current) void animateCard(cardScope.current, SHAKE, { duration: 0.45, ease: 'easeInOut' });
    requestAnimationFrame(() => {
      cardScope.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: false });
    });
  };

  const validate = (s: Step): boolean => {
    const e: Errors = {};
    if (s === 0 && !existingUser) {
      if (bareAttorneyName(form.fullName).length < 2) e.fullName = 'Full name required (min 2 chars)';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required';
      if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    if (s === 1) {
      if (!form.rollNumber.trim()) e.rollNumber = 'Roll of Attorneys number is required';
      if (!form.ibpChapter) e.ibpChapter = 'IBP Chapter is required';
      if (!form.barPasserYear || isNaN(Number(form.barPasserYear))) e.barPasserYear = 'Valid bar passer year required';
    }
    if (s === DOCUMENTS_STEP && documentGap) {
      e.documents = documentGap;
    }
    if (s === PROFILE_STEP) {
      if (!form.about.trim()) e.about = 'Please write a brief bio';
      if (form.practiceAreas.length === 0) e.practiceAreas = 'Select at least one practice area';
    }
    setErrors(e);
    const ok = Object.keys(e).length === 0;
    if (!ok) flagProblem();
    return ok;
  };

  const nextStep = async () => {
    if (isSubmitting || !validate(step)) return;

    // Step 0: create account if new user
    if (step === 0 && !existingUser && !accountCreated) {
      setIsSubmitting(true);
      const fd = new FormData();
      fd.set('full_name', bareAttorneyName(form.fullName));
      fd.set('email', form.email);
      fd.set('password', form.password);
      fd.set('role', 'client'); // will be upgraded to lawyer server-side on submission
      fd.set('accept_terms', 'yes'); // agreement text is shown above the button
      const result = await signUpAction(null, fd);
      setIsSubmitting(false);
      if (result?.error) { setErrors({ general: result.error }); flagProblem(); return; }
      setAccountCreated(true);
    }

    // Save draft on the credentials and profile steps (documents save as they upload)
    if (step === 1 || step === PROFILE_STEP) {
      setIsSubmitting(true);
      const fd = buildFormData();
      const saved = await saveLawyerDraftAction(null, fd);
      setIsSubmitting(false);
      if (saved?.error) { setErrors({ general: saved.error }); flagProblem(); return; }
    }

    goTo((step < REVIEW_STEP ? step + 1 : step) as Step);
  };

  const buildFormData = (): FormData => {
    const fd = new FormData();
    fd.set('full_name', bareAttorneyName(form.fullName));
    fd.set('roll_number', form.rollNumber);
    fd.set('ibp_chapter', form.ibpChapter);
    fd.set('bar_passer_year', form.barPasserYear);
    fd.set('about', form.about);
    fd.set('experience_years', form.experienceYears);
    fd.set('fee_initial_30min', form.feeInitial);
    fd.set('fee_standard_60min', form.feeStandard);
    fd.set('fee_extended_120min', form.feeExtended);
    form.practiceAreas.forEach((a) => fd.append('practice_areas', a));
    form.languages.forEach((l) => fd.append('languages', l));
    return fd;
  };

  const handleSubmit = async () => {
    if (documentGap) { setErrors({ documents: documentGap }); goTo(DOCUMENTS_STEP); return; }
    if (!validate(PROFILE_STEP)) { goTo(PROFILE_STEP); return; }
    setErrors({});
    const result = await submission.run(async () => {
      const res = await submitLawyerApplicationAction(null, buildFormData());
      return res?.error ? { ok: false, error: res.error } : { ok: true };
    });
    if (result && !result.ok) setErrors({ general: result.error });
  };

  // Hard navigate to /lawyer/verification for a clean, immediate render without stale router
  // cache; the loading screen stays up until the status page arrives.
  const openStatus = () => leave.go('/lawyer/verification', 'Opening your application...');

  const field = (
    id: keyof FormState,
    label: string,
    type = 'text',
    placeholder = '',
    opts: { prefix?: string; autoComplete?: string; hint?: string; min?: number; max?: number; fallback?: number } = {}
  ) => (
    <motion.div variants={RISE} className="space-y-1.5">
      <label htmlFor={`reg-${id}`} className={labelClass}>{label}</label>
      <div className="relative">
        {opts.prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-inter text-sm font-semibold text-[#9A8270]" aria-hidden="true">
            {opts.prefix}
          </span>
        )}
        <input
          id={`reg-${id}`}
          name={id}
          type={type}
          value={form[id] as string}
          onChange={(e) => set(id, e.target.value)}
          placeholder={placeholder}
          autoComplete={opts.autoComplete}
          inputMode={type === 'number' ? 'numeric' : undefined}
          aria-invalid={errors[id] ? true : undefined}
          aria-describedby={errors[id] ? `reg-${id}-error` : opts.hint ? `reg-${id}-hint` : undefined}
          className={inputClass(!!errors[id], `${opts.prefix ? 'pl-9' : ''} ${type === 'number' ? 'pr-12' : ''}`)}
        />
        {type === 'number' && (
          <NeuNumberStepper
            value={form[id] as string}
            onChange={(next) => set(id, next)}
            min={opts.min}
            max={opts.max}
            fallback={opts.fallback}
            label={label}
          />
        )}
      </div>
      {opts.hint && !errors[id] && <p id={`reg-${id}-hint`} className="font-inter text-[11.5px] text-[#7D6855]">{opts.hint}</p>}
      <FieldError id={`reg-${id}-error`} message={errors[id]} />
    </motion.div>
  );

  // ─── Tracker ────────────────────────────────────────────────────────────────
  const visibleSteps = STEP_ORDER.filter((s) => s >= firstStep);
  const position = visibleSteps.indexOf(step);
  const trackerItems: TrackerItem[] = visibleSteps.map((s) => ({
    key: String(s),
    label: STEPS[s].label,
    description: STEPS[s].rail,
    state: s < step ? 'done' : s === step ? 'current' : 'upcoming',
    onSelect: s < step && s >= earliestEditable && !isSubmitting ? () => goTo(s) : undefined,
  }));
  const shellProps = {
    eyebrow: 'For Philippine Lawyers',
    title: 'Register as a Verified Lawyer',
    description: 'Join Justicia’s network of licensed Philippine lawyers. Our team reviews every profile before it goes live.',
  };

  // ─── Email confirmation gate ────────────────────────────────────────────────
  if (emailUnconfirmed) {
    const gateItems: TrackerItem[] = STEP_ORDER.map((s) => ({
      key: String(s),
      label: s === 0 ? 'Confirm your email' : STEPS[s].label,
      description: s === 0 ? 'Open the link we sent you.' : STEPS[s].rail,
      state: s === 0 ? 'current' : 'upcoming',
    }));
    return (
      <OnboardingShell
        {...shellProps}
        rail={<RailTracker items={gateItems} label="Registration progress" />}
        compactRail={<CompactTracker items={gateItems} caption="Before you start · Confirm your email" />}
      >
        <motion.div
          variants={STEP_SECTION}
          custom={1}
          initial="hidden"
          animate="show"
          className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:py-16"
        >
          <motion.div variants={EMBOSS} className="neu-raised rounded-[28px] bg-[#E5D8CB] px-6 py-10 text-center sm:px-10">
            <motion.div
              initial={{ scale: 0.4, rotate: -16, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 440, damping: 16, delay: 0.3 }}
              className="relative mx-auto grid size-16 place-items-center rounded-2xl text-[#C58B3C] neu-raised-sm"
            >
              <motion.span
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.1, delay: 0.55, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-current"
                aria-hidden="true"
              />
              <svg className="neu-float h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75" />
              </svg>
            </motion.div>
            <motion.h2 variants={RISE} className="mt-5 font-lora text-[26px] font-semibold text-[#34150F]">Check your inbox</motion.h2>
            <motion.p variants={RISE} className="mx-auto mt-2 max-w-sm font-inter text-[13px] leading-relaxed text-[#5C4535]">
              We sent a confirmation link to <strong className="text-[#34150F] [overflow-wrap:anywhere]">{existingUser?.email}</strong>. Please verify your
              email address before continuing your registration.
            </motion.p>
            <ol className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
              {[
                'Open the email from Justicia in your inbox (check spam too).',
                'Click the confirmation link inside.',
                'Return here and log in to continue your registration.',
              ].map((text, i) => (
                <motion.li key={text} variants={RISE} className="neu-recessed flex items-start gap-3 rounded-2xl px-4 py-3">
                  <span className="neu-raised-sm grid size-7 shrink-0 place-items-center rounded-full font-lora text-xs font-bold text-[#C58B3C]">{i + 1}</span>
                  <span className="pt-0.5 font-inter text-[12.5px] text-[#3E2A1E]">{text}</span>
                </motion.li>
              ))}
            </ol>
            <motion.div variants={RISE}>
              <Link
                href="/login"
                onClick={leave.onLinkClick()}
                className="neu-btn-create mt-7 inline-flex h-11 items-center justify-center rounded-[14px] px-8 font-inter text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#F3E6D6] transition-transform hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/70"
              >
                Go to Log In
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
        {leave.loader}
      </OnboardingShell>
    );
  }

  const meta = STEPS[step];
  const stepLabel = `Step ${position + 1} of ${visibleSteps.length}`;
  const cardless = step === DOCUMENTS_STEP || step === REVIEW_STEP;

  return (
    <OnboardingShell
      {...shellProps}
      rail={<RailTracker items={trackerItems} label="Registration progress" />}
      compactRail={<CompactTracker items={trackerItems} caption={`${stepLabel} · ${meta.label}`} />}
    >
      {/* ─── Step content + actions ──────────────────────────────────────────
          Desktop: one block centred in the work area (my-auto), the actions right under the
          card; a step taller than the window simply scrolls. Phones: the actions stay pinned to
          the bottom of the screen. */}
      <div className="mx-auto flex w-full max-w-[840px] flex-1 flex-col px-5 pt-8 sm:px-8 lg:my-auto lg:flex-none lg:px-12 lg:py-12">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.section
            key={step}
            custom={direction}
            variants={STEP_SECTION}
            initial="hidden"
            animate="show"
            exit="exit"
            aria-labelledby="reg-step-title"
            className="space-y-6 pb-8 lg:pb-0"
          >
            <WorkAreaHeading id="reg-step-title" eyebrow={stepLabel} title={meta.title} intro={meta.intro} />

            {/* Notices */}
            <AnimatePresence initial={false}>
              {draft && step === firstStep && (
                <motion.div key="draft" variants={RAIL_ITEM} exit={{ opacity: 0, height: 0 }}>
                  <NeuAlert tone="info" title="Draft restored">
                    Your previous progress has been pre-filled. Review and continue where you left off.
                  </NeuAlert>
                </motion.div>
              )}
              {errors.general && (
                <motion.div key="general" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <NeuAlert tone="error" title="Something needs your attention" onDismiss={() => setErrors((e) => ({ ...e, general: undefined }))}>
                    {errors.general}
                  </NeuAlert>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={cardScope}>
              <motion.div
                variants={cardless ? STAGGER : EMBOSS}
                className={cardless ? 'space-y-5' : 'neu-raised rounded-[28px] bg-[#E5D8CB] p-5 sm:p-7 lg:p-8'}
              >
                {/* Step 0: Account */}
                {step === 0 && !existingUser && (
                  <div className="space-y-4">
                    {field('fullName', 'Full Name', 'text', 'e.g. Juan Dela Cruz', {
                      autoComplete: 'name',
                      hint: form.fullName.trim() ? `Clients will see “${formatAttorneyName(form.fullName)}”.` : 'Your legal name, as it appears on your credentials.',
                    })}
                    {field('email', 'Email Address', 'email', 'you@example.com', { autoComplete: 'email' })}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field('password', 'Password', 'password', 'Min 8 characters', { autoComplete: 'new-password' })}
                      {field('confirmPassword', 'Confirm Password', 'password', 'Re-enter password', { autoComplete: 'new-password' })}
                    </div>
                    <motion.div variants={RISE} className="neu-recessed space-y-1.5 rounded-2xl px-4 py-3.5 font-inter text-[12px] leading-relaxed text-[#5C4535]">
                      <p>You will need to verify your email before your application is reviewed.</p>
                      <p>
                        By creating an account you agree to the{' '}
                        <Link href="/terms" target="_blank" className="font-semibold text-[#946525] hover:underline">Terms of Service</Link>,{' '}
                        <Link href="/privacy" target="_blank" className="font-semibold text-[#946525] hover:underline">Privacy Policy</Link> and{' '}
                        <Link href="/ai-disclaimer" target="_blank" className="font-semibold text-[#946525] hover:underline">AI Disclaimer</Link>.
                      </p>
                    </motion.div>
                    <motion.p variants={RISE} className="text-center font-inter text-[12px] text-[#7D6855]">
                      Already started an application?{' '}
                      <Link href="/login" onClick={leave.onLinkClick()} className="font-semibold text-[#946525] hover:text-[#C58B3C] hover:underline">
                        Sign in to continue
                      </Link>
                    </motion.p>
                  </div>
                )}

                {/* Step 1: Credentials */}
                {step === 1 && (
                  <div className="space-y-5">
                    {field('rollNumber', 'Roll of Attorneys Number', 'text', 'Your unique roll number', { hint: 'As listed on the Supreme Court’s Roll of Attorneys.' })}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <motion.div variants={RISE} className="space-y-1.5">
                        <label htmlFor="reg-ibpChapter" className={labelClass}>IBP Chapter</label>
                        <div className="relative">
                          <select
                            id="reg-ibpChapter"
                            value={form.ibpChapter}
                            onChange={(e) => set('ibpChapter', e.target.value)}
                            aria-invalid={errors.ibpChapter ? true : undefined}
                            aria-describedby={errors.ibpChapter ? 'reg-ibpChapter-error' : undefined}
                            className={inputClass(!!errors.ibpChapter, `cursor-pointer appearance-none pr-10 ${form.ibpChapter ? '' : 'text-[#9A8270]'}`)}
                          >
                            <option value="">Select IBP Chapter</option>
                            {IBP_CHAPTERS.map((c) => <option key={c} value={c} className="text-[#34150F]">{c}</option>)}
                          </select>
                          <ChevronRightIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-[#9A8270]" />
                        </div>
                        <FieldError id="reg-ibpChapter-error" message={errors.ibpChapter} />
                      </motion.div>
                      {field('barPasserYear', 'Bar Passer Year', 'number', 'e.g. 2018', { min: 1900, max: CURRENT_YEAR, fallback: CURRENT_YEAR })}
                    </div>
                    <motion.div variants={RISE}>
                      <NeuAlert tone="info">Next, you will upload proof of your bar admission, IBP membership and a government ID.</NeuAlert>
                    </motion.div>
                  </div>
                )}

                {/* Step 2: Documents */}
                {step === DOCUMENTS_STEP && (
                  <motion.div variants={RISE} className="space-y-4">
                    <VerificationDocumentsPanel
                      intro="Upload clear scans or photos. Items marked * are required before you can submit."
                      onDocumentsChange={(next) => {
                        setDocuments(next);
                        setErrors((e) => ({ ...e, documents: undefined }));
                      }}
                    />
                    <AnimatePresence initial={false}>
                      {errors.documents && (
                        <motion.div key="docs-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                          <NeuAlert tone="error">{errors.documents}</NeuAlert>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Step 3: Profile */}
                {step === PROFILE_STEP && (
                  <div className="space-y-7">
                    <div className="space-y-3">
                      <GroupTitle aside={<span className="font-inter text-[11px] tabular-nums text-[#9A8270]">{form.about.length} characters</span>}>
                        About you
                      </GroupTitle>
                      <motion.div variants={RISE} className="space-y-1.5">
                        <label htmlFor="reg-about" className="sr-only">About You</label>
                        <textarea
                          id="reg-about"
                          value={form.about}
                          onChange={(e) => set('about', e.target.value)}
                          rows={5}
                          aria-invalid={errors.about ? true : undefined}
                          aria-describedby={errors.about ? 'reg-about-error' : undefined}
                          className={`neu-input w-full resize-y rounded-2xl px-4 py-3 font-inter text-[14px] leading-relaxed text-[#34150F] ${errors.about ? 'neu-input-error' : ''}`}
                          placeholder="Briefly describe your legal background, expertise, and approach..."
                        />
                        <FieldError id="reg-about-error" message={errors.about} />
                      </motion.div>
                    </div>

                    <fieldset className="space-y-3" aria-describedby={errors.practiceAreas ? 'reg-practiceAreas-error' : undefined}>
                      <legend className="sr-only">Practice Areas</legend>
                      <GroupTitle aside={<span className="font-inter text-[11px] text-[#9A8270]">{form.practiceAreas.length ? `${form.practiceAreas.length} selected` : 'Select all that apply'}</span>}>
                        Practice areas
                      </GroupTitle>
                      <motion.div variants={STAGGER} className="flex flex-wrap gap-2.5">
                        {PRACTICE_AREAS.map((area) => (
                          <Chip key={area} label={area} on={form.practiceAreas.includes(area)} onToggle={() => toggleArray('practiceAreas', area)} />
                        ))}
                      </motion.div>
                      <FieldError id="reg-practiceAreas-error" message={errors.practiceAreas} />
                    </fieldset>

                    <fieldset className="space-y-3">
                      <legend className="sr-only">Languages / Dialects</legend>
                      <GroupTitle>Languages &amp; dialects</GroupTitle>
                      <motion.div variants={STAGGER} className="flex flex-wrap gap-2.5">
                        {LANGUAGES.map((lang) => (
                          <Chip key={lang} label={lang} on={form.languages.includes(lang)} onToggle={() => toggleArray('languages', lang)} />
                        ))}
                      </motion.div>
                    </fieldset>

                    <div className="space-y-4">
                      <GroupTitle>Fees &amp; experience</GroupTitle>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {field('feeInitial', 'Initial (30 min)', 'number', '700', { prefix: '₱', min: 0 })}
                        {field('feeStandard', 'Standard (1 hr)', 'number', '1500', { prefix: '₱', min: 0 })}
                        {field('feeExtended', 'Extended (2 hrs)', 'number', '2300', { prefix: '₱', min: 0 })}
                      </div>
                      <div className="sm:max-w-[16rem]">{field('experienceYears', 'Years of Practice', 'number', 'e.g. 5', { min: 0 })}</div>
                    </div>

                    <motion.div variants={RISE}>
                      <NeuAlert tone="warning" title="Confidentiality reminder">
                        When adding case summaries to your profile, do NOT include client names, case numbers, or any privileged or
                        confidential information. Use only anonymized, general descriptions.
                      </NeuAlert>
                    </motion.div>
                  </div>
                )}

                {/* Step 4: Review & Submit */}
                {step === REVIEW_STEP && (
                  <>
                    <div className="grid gap-5 md:grid-cols-2">
                      <ReviewGroup title="Account" onEdit={earliestEditable === 0 ? () => goTo(0) : undefined}>
                        <ReviewRow label="Full Name" value={formatAttorneyName(form.fullName)} />
                        <ReviewRow label="Email" value={form.email || existingUser?.email || '—'} />
                      </ReviewGroup>
                      <ReviewGroup title="Credentials" onEdit={() => goTo(1)}>
                        <ReviewRow label="Roll Number" value={form.rollNumber} />
                        <ReviewRow label="IBP Chapter" value={form.ibpChapter} />
                        <ReviewRow label="Bar Passer Year" value={form.barPasserYear} />
                      </ReviewGroup>
                      <ReviewGroup title="Documents" onEdit={() => goTo(DOCUMENTS_STEP)}>
                        <ReviewRow
                          label="Status"
                          value={documentGap || `All ${REQUIRED_DOCUMENT_TYPES.length} required documents uploaded${documents.length > REQUIRED_DOCUMENT_TYPES.length ? ' (plus MCLE)' : ''}`}
                          tone={documentGap ? 'warning' : 'ok'}
                        />
                      </ReviewGroup>
                      <ReviewGroup title="Profile" onEdit={() => goTo(PROFILE_STEP)}>
                        <ReviewRow label="Practice Areas" value={form.practiceAreas.join(', ') || 'None'} />
                        <ReviewRow label="Languages" value={form.languages.join(', ') || 'None'} />
                        <ReviewRow
                          label="Fees"
                          value={
                            [form.feeInitial && `₱${form.feeInitial} / 30 min`, form.feeStandard && `₱${form.feeStandard} / hr`, form.feeExtended && `₱${form.feeExtended} / 2 hrs`]
                              .filter(Boolean)
                              .join(' · ') || 'Not set'
                          }
                        />
                      </ReviewGroup>
                    </div>
                    <motion.div variants={RISE} className="neu-recessed flex items-start gap-3 rounded-2xl px-4 py-4 font-inter text-[12.5px] leading-relaxed text-[#5C4535] sm:px-5">
                      <span className="neu-raised-sm mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-[#C58B3C]" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                      </span>
                      <div className="space-y-1.5">
                        <p>By submitting, you confirm that all information is accurate and that you are a licensed member of the Integrated Bar of the Philippines.</p>
                        <p>Your application will be reviewed by the Justicia team. You will be notified by email and in-app when a decision is made.</p>
                      </div>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </div>
          </motion.section>
        </AnimatePresence>

      {/* ─── Actions ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ONBOARD_EASE, delay: 0.45 }}
        className="sticky bottom-0 z-20 -mx-5 mt-auto border-t border-[#CDBCA8]/70 bg-[#E5D8CB]/90 backdrop-blur-md sm:-mx-8 lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
      >
        <div className="flex w-full items-center gap-3 px-5 py-3.5 sm:px-8 lg:p-0">
          <AnimatePresence initial={false}>
            {step > earliestEditable && (
              <motion.div
                key="back"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <NeuButton
                  variant="secondary"
                  icon={<ChevronLeftIcon className="h-4 w-4" />}
                  onClick={() => goTo((step - 1) as Step)}
                  disabled={isSubmitting}
                >
                  Back
                </NeuButton>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="hidden flex-1 text-center font-inter text-[11.5px] text-[#9A8270] md:block">
            {step === REVIEW_STEP ? 'Nothing is sent until you submit.' : step === DOCUMENTS_STEP ? 'Documents save as they upload.' : 'Your progress saves at each step.'}
          </p>
          <div className="ml-auto flex-1 md:flex-none [&>button]:w-full md:[&>button]:w-auto">
            {step < REVIEW_STEP ? (
              <NeuButton variant="primary" onClick={nextStep} loading={isSubmitting} id={`reg-next-step-${step}`}>
                {isSubmitting ? 'Saving…' : step === 0 && !existingUser && !accountCreated ? 'Create Account & Continue' : 'Save & Continue'}
                {!isSubmitting && <ChevronRightIcon className="h-4 w-4" />}
              </NeuButton>
            ) : (
              <NeuButton variant="dark" onClick={handleSubmit} disabled={submission.processing} id="reg-submit-btn">
                Submit Application
              </NeuButton>
            )}
          </div>
        </div>
      </motion.div>
      </div>

      {/* ─── Submission feedback ──────────────────────────────────────────── */}
      <AnimatePresence>
        {submission.phase !== 'idle' && (
          <SubmissionModal
            key="application-submit"
            phase={submission.phase}
            titleId="reg-submit-status"
            onClose={submission.phase === 'success' ? openStatus : submission.reset}
            onRetry={submission.reset}
            error={submission.error}
            processing={{ title: 'Submitting your application', message: 'Sending your credentials and documents for review.' }}
            success={{
              title: 'Application submitted',
              message: 'The Justicia team will review it and let you know by email and in-app once a decision is made.',
              actionLabel: 'View Application Status',
            }}
            failure={{ title: "We couldn't submit your application", retryLabel: 'Back to Review' }}
          >
            {null}
          </SubmissionModal>
        )}
      </AnimatePresence>
      {leave.loader}
    </OnboardingShell>
  );
}

function ReviewGroup({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <motion.div variants={EMBOSS} className="neu-raised flex flex-col rounded-[22px] bg-[#E5D8CB] p-4 sm:p-5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#A8742E]">{title}</p>
        {onEdit && (
          <motion.button
            type="button"
            onClick={onEdit}
            whileTap={{ scale: 0.94 }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-inter text-[11.5px] font-semibold text-[#946525] transition-colors hover:text-[#C58B3C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60"
          >
            <PencilIcon className="h-3.5 w-3.5" /> Edit
          </motion.button>
        )}
      </div>
      <dl className="divide-y divide-[#D8CAAD]/60">{children}</dl>
    </motion.div>
  );
}

function ReviewRow({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warning' }) {
  return (
    <motion.div variants={RISE} className="flex flex-col gap-0.5 py-2.5">
      <dt className="font-inter text-[11.5px] font-medium text-[#7D6855]">{label}</dt>
      <dd
        className={`font-inter text-[13px] [overflow-wrap:anywhere] ${
          tone === 'warning' ? 'font-semibold text-[#B7791F]' : tone === 'ok' ? 'font-semibold text-[#1F7A3A]' : 'text-[#34150F]'
        }`}
      >
        {value || '—'}
      </dd>
    </motion.div>
  );
}

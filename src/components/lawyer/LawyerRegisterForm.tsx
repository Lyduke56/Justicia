'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { signUpAction } from '@/app/actions/auth';
import { saveLawyerDraftAction, submitLawyerApplicationAction } from '@/app/actions/lawyerRegistration';
import type { VerificationDocumentView } from '@/app/actions/lawyerVerificationDocs';
import { VerificationDocumentsPanel } from './VerificationDocumentsPanel';
import { REQUIRED_DOCUMENT_TYPES, documentGapMessage } from '@/lib/lawyer/verification';
import { NeuAlert, NeuButton, NeuNumberStepper, ChevronLeftIcon, ChevronRightIcon, PencilIcon } from '@/components/shared/neu';
import { SubmissionModal, useSubmission } from '@/components/shared/feedback';

interface ExistingUser { id: string; email: string; fullName?: string }

const STEPS = ['Account', 'Credentials', 'Documents', 'Profile', 'Review & Submit'] as const;
type Step = 0 | 1 | 2 | 3 | 4;
/** Step numbers (the documents step sits between credentials and profile). */
const PROFILE_STEP = 3;
const REVIEW_STEP = 4;

const STEP_INTROS: Record<Step, { title: string; text: string }> = {
  0: { title: 'Create your account', text: 'Use your legal name as it appears on your credentials.' },
  1: { title: 'Credentials & verification', text: 'We check these against the Roll of Attorneys and your IBP chapter.' },
  2: { title: 'Verification documents', text: 'Proof of bar admission, IBP membership and a government ID.' },
  3: { title: 'Profile information', text: 'This is what clients see when they look for a lawyer.' },
  4: { title: 'Review & submit', text: 'Check everything once more before sending your application.' },
};

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
  // Step 2 — Profile
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

const inputClass = (hasError: boolean, extra = '') =>
  `neu-input w-full h-11 rounded-[13px] px-4 font-inter text-[14px] text-[#34150F] ${hasError ? 'neu-input-error' : ''} ${extra}`;
const labelClass = 'block font-lora text-[13px] font-semibold text-[#4A3426]';
const CURRENT_YEAR = new Date().getFullYear();

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <motion.p
      id={id}
      role="alert"
      initial={{ opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      className="font-inter text-[11.5px] font-medium text-[#B42318]"
    >
      {message}
    </motion.p>
  );
}

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
  const [step, setStep] = useState<Step>(existingUser ? 1 : 0);
  const [direction, setDirection] = useState<1 | -1>(1);
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
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'general' | 'documents', string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documents, setDocuments] = useState<VerificationDocumentView[]>([]);
  const documentGap = documentGapMessage(documents.map((d) => ({ docType: d.docType, reviewStatus: d.reviewStatus })));
  const submission = useSubmission();

  const firstStep: Step = existingUser ? 1 : 0;

  const goTo = (next: Step) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const set = (field: keyof FormState, value: string | string[]) =>
    setForm(f => ({ ...f, [field]: value }));

  const toggleArray = (field: 'practiceAreas' | 'languages', value: string) => {
    setForm(f => {
      const arr = f[field] as string[];
      return { ...f, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const validate = (s: Step): boolean => {
    const e: typeof errors = {};
    if (s === 0 && !existingUser) {
      if (form.fullName.trim().length < 2) e.fullName = 'Full name required (min 2 chars)';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required';
      if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    if (s === 1) {
      if (!form.rollNumber.trim()) e.rollNumber = 'Roll of Attorneys number is required';
      if (!form.ibpChapter) e.ibpChapter = 'IBP Chapter is required';
      if (!form.barPasserYear || isNaN(Number(form.barPasserYear))) e.barPasserYear = 'Valid bar passer year required';
    }
    if (s === 2 && documentGap) {
      e.documents = documentGap;
    }
    if (s === PROFILE_STEP) {
      if (!form.about.trim()) e.about = 'Please write a brief bio';
      if (form.practiceAreas.length === 0) e.practiceAreas = 'Select at least one practice area';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = async () => {
    if (isSubmitting || !validate(step)) return;

    // Step 0: create account if new user
    if (step === 0 && !existingUser) {
      setIsSubmitting(true);
      const fd = new FormData();
      fd.set('full_name', form.fullName);
      fd.set('email', form.email);
      fd.set('password', form.password);
      fd.set('role', 'client'); // will be upgraded to lawyer server-side on submission
      fd.set('accept_terms', 'yes'); // agreement text is shown above the button
      const result = await signUpAction(null, fd);
      setIsSubmitting(false);
      if (result?.error) { setErrors({ general: result.error }); return; }
    }

    // Save draft on the credentials and profile steps (documents save as they upload)
    if (step === 1 || step === PROFILE_STEP) {
      setIsSubmitting(true);
      const fd = buildFormData();
      const saved = await saveLawyerDraftAction(null, fd);
      setIsSubmitting(false);
      if (saved?.error) { setErrors({ general: saved.error }); return; }
    }

    goTo((step < REVIEW_STEP ? step + 1 : step) as Step);
  };

  const buildFormData = (): FormData => {
    const fd = new FormData();
    fd.set('full_name', form.fullName);
    fd.set('roll_number', form.rollNumber);
    fd.set('ibp_chapter', form.ibpChapter);
    fd.set('bar_passer_year', form.barPasserYear);
    fd.set('about', form.about);
    fd.set('experience_years', form.experienceYears);
    fd.set('fee_initial_30min', form.feeInitial);
    fd.set('fee_standard_60min', form.feeStandard);
    fd.set('fee_extended_120min', form.feeExtended);
    form.practiceAreas.forEach(a => fd.append('practice_areas', a));
    form.languages.forEach(l => fd.append('languages', l));
    return fd;
  };

  const handleSubmit = async () => {
    if (documentGap) { setErrors({ documents: documentGap }); goTo(2); return; }
    if (!validate(PROFILE_STEP)) { goTo(PROFILE_STEP); return; }
    setErrors({});
    const result = await submission.run(async () => {
      const res = await submitLawyerApplicationAction(null, buildFormData());
      return res?.error ? { ok: false, error: res.error } : { ok: true };
    });
    if (result && !result.ok) setErrors({ general: result.error });
  };

  // Hard navigate to /lawyer/verification for a clean, immediate render without stale router cache
  const openStatus = () => {
    window.location.href = '/lawyer/verification';
  };

  const field = (
    id: keyof FormState,
    label: string,
    type = 'text',
    placeholder = '',
    opts: { prefix?: string; autoComplete?: string; hint?: string; min?: number; max?: number; fallback?: number } = {}
  ) => (
    <div className="space-y-1.5">
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
          onChange={e => set(id, e.target.value)}
          placeholder={placeholder}
          autoComplete={opts.autoComplete}
          inputMode={type === 'number' ? 'numeric' : undefined}
          aria-invalid={errors[id] ? true : undefined}
          aria-describedby={errors[id] ? `reg-${id}-error` : undefined}
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
      {opts.hint && !errors[id] && <p className="font-inter text-[11.5px] text-[#7D6855]">{opts.hint}</p>}
      <FieldError id={`reg-${id}-error`} message={errors[id]} />
    </div>
  );

  // ─── Email confirmation gate ────────────────────────────────────────────────
  if (emailUnconfirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="neu-raised rounded-[28px] bg-[#E5D8CB] px-6 py-10 sm:px-12 text-center"
      >
        <div className="mx-auto grid size-16 place-items-center rounded-2xl text-[#C58B3C] neu-raised-sm">
          <svg className="neu-float h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75" />
          </svg>
        </div>
        <h2 className="mt-5 font-lora text-2xl font-semibold text-[#34150F]">Check your inbox</h2>
        <p className="mx-auto mt-2 max-w-sm font-inter text-[13px] leading-relaxed text-[#5C4535]">
          We sent a confirmation link to <strong className="text-[#34150F]">{existingUser?.email}</strong>. Please verify your
          email address before continuing your registration.
        </p>
        <ol className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
          {[
            'Open the email from Justicia in your inbox (check spam too).',
            'Click the confirmation link inside.',
            'Return here and log in to continue your registration.',
          ].map((text, i) => (
            <li key={text} className="neu-recessed flex items-start gap-3 rounded-2xl px-4 py-3">
              <span className="neu-raised-sm grid size-7 shrink-0 place-items-center rounded-full font-lora text-xs font-bold text-[#C58B3C]">{i + 1}</span>
              <span className="pt-0.5 font-inter text-[12.5px] text-[#3E2A1E]">{text}</span>
            </li>
          ))}
        </ol>
        <Link
          href="/login"
          className="neu-btn-create mt-7 inline-flex h-11 items-center justify-center rounded-[14px] px-8 font-inter text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#F3E6D6] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/70"
        >
          Go to Log In
        </Link>
      </motion.div>
    );
  }

  const visibleSteps = STEPS.map((label, i) => ({ label, index: i as Step })).filter((s) => s.index >= firstStep);
  const position = visibleSteps.findIndex((s) => s.index === step);
  const progress = visibleSteps.length > 1 ? position / (visibleSteps.length - 1) : 1;
  const intro = STEP_INTROS[step];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="neu-raised rounded-[28px] bg-[#E5D8CB] p-5 sm:p-8 lg:p-10 space-y-7"
    >
      {/* ─── Stepper ───────────────────────────────────────────────────────── */}
      <nav aria-label="Registration progress">
        <ol className="relative flex items-start justify-between">
          {/* Track and animated fill, centred on the step dots */}
          <span aria-hidden="true" className="absolute left-4 right-4 top-[15px] h-1 rounded-full neu-pressed" />
          <motion.span
            aria-hidden="true"
            className="absolute left-4 top-[15px] h-1 rounded-full bg-[#C58B3C]"
            initial={false}
            animate={{ width: `calc((100% - 2rem) * ${progress})` }}
            transition={{ type: 'spring', stiffness: 160, damping: 26 }}
          />
          {visibleSteps.map(({ label, index }) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={label} className="relative z-10 flex flex-col items-center gap-2" aria-current={current ? 'step' : undefined}>
                <motion.span
                  initial={false}
                  animate={{ scale: current ? 1.08 : 1 }}
                  className={`grid size-8 place-items-center rounded-full font-inter text-xs font-bold transition-colors duration-300 ${
                    done
                      ? 'bg-[#C58B3C] text-white shadow-[0_3px_8px_rgba(165,110,40,0.35)]'
                      : current
                        ? 'neu-raised-sm text-[#C58B3C] ring-2 ring-[#C58B3C]'
                        : 'neu-pressed text-[#A69584]'
                  }`}
                >
                  {done ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    index - firstStep + 1
                  )}
                </motion.span>
                <span
                  className={`hidden sm:block max-w-[7rem] text-center font-inter text-[11px] font-semibold leading-tight ${
                    current ? 'text-[#34150F]' : done ? 'text-[#5C4535]' : 'text-[#A69584]'
                  }`}
                >
                  {label}
                  <span className="sr-only">{done ? ' (completed)' : current ? ' (current step)' : ''}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-center font-inter text-[11.5px] font-semibold text-[#7D6855] sm:hidden">
          Step {position + 1} of {visibleSteps.length} · {STEPS[step]}
        </p>
      </nav>

      {/* ─── Notices ───────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {draft && step === firstStep && (
          <motion.div key="draft" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
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

      {/* ─── Step content ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.section
          key={step}
          custom={direction}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 32 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -32 * direction }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          aria-labelledby="reg-step-title"
          className="space-y-5"
        >
          <header className="space-y-1">
            <h2 id="reg-step-title" className="font-lora text-[22px] sm:text-2xl font-semibold text-[#34150F]">{intro.title}</h2>
            <p className="font-inter text-[13px] text-[#5C4535]">{intro.text}</p>
          </header>

          {/* Step 0: Account */}
          {step === 0 && !existingUser && (
            <div className="space-y-4">
              {field('fullName', 'Full Name', 'text', 'Your legal name as it appears on your credentials', { autoComplete: 'name' })}
              {field('email', 'Email Address', 'email', 'you@example.com', { autoComplete: 'email' })}
              <div className="grid gap-4 sm:grid-cols-2">
                {field('password', 'Password', 'password', 'Min 8 characters', { autoComplete: 'new-password' })}
                {field('confirmPassword', 'Confirm Password', 'password', 'Re-enter password', { autoComplete: 'new-password' })}
              </div>
              <div className="neu-recessed rounded-2xl px-4 py-3.5 font-inter text-[12px] leading-relaxed text-[#5C4535] space-y-1.5">
                <p>You will need to verify your email before your application is reviewed.</p>
                <p>
                  By creating an account you agree to the{' '}
                  <Link href="/terms" target="_blank" className="font-semibold text-[#946525] hover:underline">Terms of Service</Link>,{' '}
                  <Link href="/privacy" target="_blank" className="font-semibold text-[#946525] hover:underline">Privacy Policy</Link> and{' '}
                  <Link href="/ai-disclaimer" target="_blank" className="font-semibold text-[#946525] hover:underline">AI Disclaimer</Link>.
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Credentials */}
          {step === 1 && (
            <div className="space-y-4">
              {field('rollNumber', 'Roll of Attorneys Number', 'text', 'Your unique IBP roll number')}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="reg-ibpChapter" className={labelClass}>IBP Chapter</label>
                  <div className="relative">
                    <select
                      id="reg-ibpChapter"
                      value={form.ibpChapter}
                      onChange={e => set('ibpChapter', e.target.value)}
                      aria-invalid={errors.ibpChapter ? true : undefined}
                      className={inputClass(!!errors.ibpChapter, 'cursor-pointer')}
                    >
                      <option value="">Select IBP Chapter</option>
                      {IBP_CHAPTERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <FieldError id="reg-ibpChapter-error" message={errors.ibpChapter} />
                </div>
                {field('barPasserYear', 'Bar Passer Year', 'number', 'e.g. 2018', { min: 1900, max: CURRENT_YEAR, fallback: CURRENT_YEAR })}
              </div>
              <NeuAlert tone="info">Next, you will upload proof of your bar admission, IBP membership and a government ID.</NeuAlert>
            </div>
          )}

          {/* Step 2: Documents */}
          {step === 2 && (
            <div className="space-y-4">
              <VerificationDocumentsPanel
                intro="Upload clear scans or photos. Items marked * are required before you can submit; each file saves as soon as it uploads."
                onDocumentsChange={(next) => {
                  setDocuments(next);
                  setErrors((e) => ({ ...e, documents: undefined }));
                }}
              />
              {errors.documents && <NeuAlert tone="error">{errors.documents}</NeuAlert>}
            </div>
          )}

          {/* Step 3: Profile */}
          {step === PROFILE_STEP && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <div className="flex items-end justify-between gap-3">
                  <label htmlFor="reg-about" className={labelClass}>About You</label>
                  <span className="font-inter text-[11px] tabular-nums text-[#9A8270]">{form.about.length} characters</span>
                </div>
                <textarea
                  id="reg-about"
                  value={form.about}
                  onChange={e => set('about', e.target.value)}
                  rows={5}
                  aria-invalid={errors.about ? true : undefined}
                  className={`neu-input w-full rounded-2xl px-4 py-3 font-inter text-[14px] leading-relaxed text-[#34150F] resize-y ${errors.about ? 'neu-input-error' : ''}`}
                  placeholder="Briefly describe your legal background, expertise, and approach..."
                />
                <FieldError id="reg-about-error" message={errors.about} />
              </div>

              {/* Practice Areas */}
              <fieldset className="space-y-2.5">
                <legend className={`${labelClass} mb-2.5`}>
                  Practice Areas <span className="font-inter text-[11.5px] font-normal text-[#7D6855]">(select all that apply)</span>
                </legend>
                <div className="flex flex-wrap gap-2.5">
                  {PRACTICE_AREAS.map(area => {
                    const on = form.practiceAreas.includes(area);
                    return (
                      <label
                        key={area}
                        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-inter text-[12px] cursor-pointer select-none transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#C58B3C]/60 ${
                          on ? 'neu-pressed text-[#34150F] font-semibold' : 'neu-raised-sm text-[#5C4535] hover:-translate-y-0.5'
                        }`}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggleArray('practiceAreas', area)} className="sr-only" />
                        <span
                          className={`grid size-4 place-items-center rounded-full transition-colors ${on ? 'bg-[#C58B3C]' : 'border border-[#C8B59E]'}`}
                          aria-hidden="true"
                        >
                          {on && (
                            <svg className="h-2.5 w-2.5" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {area}
                      </label>
                    );
                  })}
                </div>
                <FieldError id="reg-practiceAreas-error" message={errors.practiceAreas} />
              </fieldset>

              {/* Languages */}
              <fieldset className="space-y-2.5">
                <legend className={`${labelClass} mb-2.5`}>Languages / Dialects</legend>
                <div className="flex flex-wrap gap-2.5">
                  {LANGUAGES.map(lang => {
                    const on = form.languages.includes(lang);
                    return (
                      <label
                        key={lang}
                        className={`inline-flex items-center rounded-full px-3.5 py-1.5 font-inter text-[12px] cursor-pointer select-none transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#C58B3C]/60 ${
                          on ? 'bg-[#C58B3C] text-white font-semibold shadow-[0_3px_8px_rgba(165,110,40,0.3)]' : 'neu-raised-sm text-[#5C4535] hover:-translate-y-0.5'
                        }`}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggleArray('languages', lang)} className="sr-only" />
                        {lang}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* Fees & experience */}
              <div className="space-y-3">
                <p className={labelClass}>Consultation fees</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {field('feeInitial', 'Initial (30 min)', 'number', '700', { prefix: '₱', min: 0 })}
                  {field('feeStandard', 'Standard (1 hr)', 'number', '1500', { prefix: '₱', min: 0 })}
                  {field('feeExtended', 'Extended (2 hrs)', 'number', '2300', { prefix: '₱', min: 0 })}
                </div>
              </div>
              <div className="sm:max-w-[16rem]">{field('experienceYears', 'Years of Practice', 'number', 'e.g. 5', { min: 0 })}</div>

              <NeuAlert tone="warning" title="Confidentiality reminder">
                When adding case summaries to your profile, do NOT include client names, case numbers, or any privileged or
                confidential information. Use only anonymized, general descriptions.
              </NeuAlert>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {step === REVIEW_STEP && (
            <div className="space-y-4">
              <ReviewGroup title="Account" onEdit={existingUser ? undefined : () => goTo(0)}>
                <ReviewRow label="Full Name" value={form.fullName} />
                <ReviewRow label="Email" value={form.email || existingUser?.email || '—'} />
              </ReviewGroup>
              <ReviewGroup title="Credentials" onEdit={() => goTo(1)}>
                <ReviewRow label="Roll Number" value={form.rollNumber} />
                <ReviewRow label="IBP Chapter" value={form.ibpChapter} />
                <ReviewRow label="Bar Passer Year" value={form.barPasserYear} />
              </ReviewGroup>
              <ReviewGroup title="Documents" onEdit={() => goTo(2)}>
                <ReviewRow
                  label="Documents"
                  value={documentGap || `All ${REQUIRED_DOCUMENT_TYPES.length} required documents uploaded${documents.length > REQUIRED_DOCUMENT_TYPES.length ? ' (plus MCLE)' : ''}`}
                  tone={documentGap ? 'warning' : 'ok'}
                />
              </ReviewGroup>
              <ReviewGroup title="Profile" onEdit={() => goTo(PROFILE_STEP)}>
                <ReviewRow label="Practice Areas" value={form.practiceAreas.join(', ') || 'None'} />
                <ReviewRow label="Languages" value={form.languages.join(', ') || 'None'} />
                <ReviewRow label="Standard Rate" value={form.feeStandard ? `₱${form.feeStandard}/hr` : 'Not set'} />
              </ReviewGroup>
              <div className="neu-recessed rounded-2xl px-4 py-3.5 font-inter text-[12px] leading-relaxed text-[#5C4535] space-y-1.5">
                <p>By submitting, you confirm that all information is accurate and that you are a licensed member of the Integrated Bar of the Philippines.</p>
                <p>Your application will be reviewed by the Justicia team. You will be notified by email and in-app when a decision is made.</p>
              </div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      {/* ─── Navigation ───────────────────────────────────────────────────── */}
      <div className="flex flex-col-reverse gap-3 border-t border-[#CDBCA8]/60 pt-6 sm:flex-row sm:items-center">
        {step > firstStep && (
          <NeuButton
            variant="secondary"
            icon={<ChevronLeftIcon className="h-4 w-4" />}
            onClick={() => goTo((step > 0 ? step - 1 : 0) as Step)}
            disabled={isSubmitting}
          >
            Back
          </NeuButton>
        )}
        <div className="sm:ml-auto [&>button]:w-full sm:[&>button]:w-auto">
          {step < REVIEW_STEP ? (
            <NeuButton
              variant="primary"
              onClick={nextStep}
              loading={isSubmitting}
              id={`reg-next-step-${step}`}
            >
              {isSubmitting ? 'Saving…' : step === 0 && !existingUser ? 'Create Account & Continue' : 'Save & Continue'}
              {!isSubmitting && <ChevronRightIcon className="h-4 w-4" />}
            </NeuButton>
          ) : (
            <NeuButton variant="dark" onClick={handleSubmit} disabled={submission.processing} id="reg-submit-btn">
              Submit Application
            </NeuButton>
          )}
        </div>
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
    </motion.div>
  );
}

function ReviewGroup({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <div className="neu-raised-highlight rounded-[20px] p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-lora text-[11px] font-bold uppercase tracking-[0.14em] text-[#C58B3C]">{title}</p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-inter text-[11.5px] font-semibold text-[#946525] transition-colors hover:text-[#C58B3C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60 cursor-pointer"
          >
            <PencilIcon className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>
      <dl className="divide-y divide-[#D8CAAD]/60">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warning' }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="min-w-[140px] shrink-0 font-inter text-[12.5px] font-medium text-[#7D6855]">{label}</dt>
      <dd
        className={`font-inter text-[13px] [overflow-wrap:anywhere] ${
          tone === 'warning' ? 'font-semibold text-[#B7791F]' : tone === 'ok' ? 'font-semibold text-[#1F7A3A]' : 'text-[#34150F]'
        }`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

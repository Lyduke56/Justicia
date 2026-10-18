'use client';

import { useState } from 'react';
import { signUpAction } from '@/app/actions/auth';
import { saveLawyerDraftAction, submitLawyerApplicationAction } from '@/app/actions/lawyerRegistration';

interface ExistingUser { id: string; email: string }

const STEPS = ['Account', 'Credentials', 'Profile', 'Review & Submit'] as const;
type Step = 0 | 1 | 2 | 3;

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

export function LawyerRegisterForm({ existingUser }: { existingUser: ExistingUser | null }) {
  const [step, setStep] = useState<Step>(existingUser ? 1 : 0);
  const [form, setForm] = useState<FormState>({
    ...INITIAL,
    email: existingUser?.email ?? '',
    fullName: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'general', string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (s === 2) {
      if (!form.about.trim()) e.about = 'Please write a brief bio';
      if (form.practiceAreas.length === 0) e.practiceAreas = 'Select at least one practice area';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = async () => {
    if (!validate(step)) return;

    // Step 0: create account if new user
    if (step === 0 && !existingUser) {
      setIsSubmitting(true);
      const fd = new FormData();
      fd.set('full_name', form.fullName);
      fd.set('email', form.email);
      fd.set('password', form.password);
      fd.set('role', 'client'); // will be upgraded to lawyer server-side on submission
      const result = await signUpAction(null, fd);
      setIsSubmitting(false);
      if (result?.error) { setErrors({ general: result.error }); return; }
    }

    // Save draft on steps 1 & 2
    if (step >= 1) {
      setIsSubmitting(true);
      const fd = buildFormData();
      await saveLawyerDraftAction(null, fd);
      setIsSubmitting(false);
    }

    setStep((s => (s < 3 ? s + 1 : s) as Step)(step));
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
    if (!validate(2)) { setStep(2); return; }
    setIsSubmitting(true);
    const fd = buildFormData();
    const result = await submitLawyerApplicationAction(null, fd);
    setIsSubmitting(false);
    if (result?.error) setErrors({ general: result.error });
    // On success, the action redirects to /lawyer/verification
  };

  const field = (id: keyof FormState, label: string, type = 'text', placeholder = '') => (
    <div className="space-y-1.5">
      <label htmlFor={`reg-${id}`} className="block text-sm font-medium text-[#34150F]">{label}</label>
      <input
        id={`reg-${id}`}
        name={id}
        type={type}
        value={form[id] as string}
        onChange={e => set(id, e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl bg-[#EFE5D8] border border-[#D8CAAD]/70 text-sm text-[#34150F] placeholder-[#A69584] focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40"
        style={{ boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.07),inset -2px -2px 5px rgba(255,255,255,0.8)' }}
      />
      {errors[id] && <p className="text-xs text-red-600">{errors[id]}</p>}
    </div>
  );

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 bg-[#EFE5D8] space-y-6"
      style={{ boxShadow: '8px 8px 20px rgba(0,0,0,0.07),-8px -8px 20px rgba(255,255,255,0.95)' }}
    >
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all ${
              i < step ? 'bg-[#C58B3C] border-[#C58B3C] text-white'
              : i === step ? 'border-[#C58B3C] text-[#C58B3C] bg-[#F5EDE2]'
              : 'border-[#D8CAAD] text-[#A69584] bg-[#EFE5D8]'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className="hidden sm:block ml-2 text-xs font-medium text-[#5C4535] whitespace-nowrap">{label}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-[#C58B3C]' : 'bg-[#D8CAAD]'}`} />}
          </div>
        ))}
      </div>

      {/* General error */}
      {errors.general && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{errors.general}</div>
      )}

      {/* ─── Step 0: Account ──────────────────────────────────────────────── */}
      {step === 0 && !existingUser && (
        <div className="space-y-4">
          <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">Create Your Account</h2>
          {field('fullName', 'Full Name', 'text', 'Your legal name as it appears on your credentials')}
          {field('email', 'Email Address', 'email', 'you@example.com')}
          {field('password', 'Password', 'password', 'Min 8 characters')}
          {field('confirmPassword', 'Confirm Password', 'password')}
          <p className="text-xs text-[#7D6855]">You will need to verify your email before your application is reviewed.</p>
        </div>
      )}

      {/* ─── Step 1: Credentials ──────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">Credentials & Verification</h2>
          {field('rollNumber', 'Roll of Attorneys Number', 'text', 'Your unique IBP roll number')}
          <div className="space-y-1.5">
            <label htmlFor="reg-ibpChapter" className="block text-sm font-medium text-[#34150F]">IBP Chapter</label>
            <select
              id="reg-ibpChapter"
              value={form.ibpChapter}
              onChange={e => set('ibpChapter', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#EFE5D8] border border-[#D8CAAD]/70 text-sm text-[#34150F] focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40"
              style={{ boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.07),inset -2px -2px 5px rgba(255,255,255,0.8)' }}
            >
              <option value="">Select IBP Chapter</option>
              {IBP_CHAPTERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.ibpChapter && <p className="text-xs text-red-600">{errors.ibpChapter}</p>}
          </div>
          {field('barPasserYear', 'Bar Passer Year', 'number', 'e.g. 2018')}
          <div className="p-4 rounded-xl bg-[#F5EDE2] border border-[#E8DCCB] space-y-2">
            <p className="text-sm font-medium text-[#34150F]">Verification Documents</p>
            <p className="text-xs text-[#7D6855]">
              Document upload will be available after your account is created and email is verified. 
              You can submit your application now and upload documents from your lawyer dashboard.
            </p>
          </div>
        </div>
      )}

      {/* ─── Step 2: Profile ──────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">Profile Information</h2>

          <div className="space-y-1.5">
            <label htmlFor="reg-about" className="block text-sm font-medium text-[#34150F]">About You</label>
            <textarea
              id="reg-about"
              value={form.about}
              onChange={e => set('about', e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl bg-[#EFE5D8] border border-[#D8CAAD]/70 text-sm text-[#34150F] placeholder-[#A69584] focus:outline-none focus:ring-2 focus:ring-[#C58B3C]/40 resize-none"
              style={{ boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.07),inset -2px -2px 5px rgba(255,255,255,0.8)' }}
              placeholder="Briefly describe your legal background, expertise, and approach..."
            />
            {errors.about && <p className="text-xs text-red-600">{errors.about}</p>}
          </div>

          {/* Practice Areas */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#34150F]">Practice Areas (select all that apply)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRACTICE_AREAS.map(area => (
                <label key={area} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs ${
                  form.practiceAreas.includes(area)
                    ? 'bg-[#C58B3C]/15 border border-[#C58B3C]/50 text-[#34150F]'
                    : 'bg-[#F5EDE2] border border-[#D8CAAD]/50 text-[#5C4535] hover:bg-[#E8DCCB]'
                }`}>
                  <input
                    type="checkbox"
                    checked={form.practiceAreas.includes(area)}
                    onChange={() => toggleArray('practiceAreas', area)}
                    className="sr-only"
                  />
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    form.practiceAreas.includes(area) ? 'bg-[#C58B3C] border-[#C58B3C]' : 'border-[#D8CAAD]'
                  }`}>
                    {form.practiceAreas.includes(area) && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  {area}
                </label>
              ))}
            </div>
            {errors.practiceAreas && <p className="text-xs text-red-600">{errors.practiceAreas}</p>}
          </div>

          {/* Languages */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#34150F]">Languages / Dialects</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(lang => (
                <label key={lang} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer text-xs transition-all ${
                  form.languages.includes(lang)
                    ? 'bg-[#C58B3C] text-white'
                    : 'bg-[#F5EDE2] border border-[#D8CAAD] text-[#5C4535] hover:bg-[#E8DCCB]'
                }`}>
                  <input type="checkbox" checked={form.languages.includes(lang)} onChange={() => toggleArray('languages', lang)} className="sr-only" />
                  {lang}
                </label>
              ))}
            </div>
          </div>

          {/* Fees */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {field('feeInitial', 'Initial Consultation Fee (30 min) ₱', 'number', '700')}
            {field('feeStandard', 'Standard Consultation Fee (1 hr) ₱', 'number', '1500')}
            {field('feeExtended', 'Extended Consultation Fee (2 hrs) ₱', 'number', '2300')}
          </div>
          {field('experienceYears', 'Years of Practice', 'number', 'e.g. 5')}

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <strong>⚠️ Confidentiality Reminder:</strong> When adding case summaries to your profile, do NOT include client names, case numbers, or any privileged or confidential information. Use only anonymized, general descriptions.
          </div>
        </div>
      )}

      {/* ─── Step 3: Review & Submit ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">Review & Submit</h2>
          <div className="space-y-3 text-sm">
            <ReviewRow label="Full Name" value={form.fullName} />
            <ReviewRow label="Email" value={form.email || existingUser?.email || '—'} />
            <ReviewRow label="Roll Number" value={form.rollNumber} />
            <ReviewRow label="IBP Chapter" value={form.ibpChapter} />
            <ReviewRow label="Bar Passer Year" value={form.barPasserYear} />
            <ReviewRow label="Practice Areas" value={form.practiceAreas.join(', ') || 'None'} />
            <ReviewRow label="Languages" value={form.languages.join(', ') || 'None'} />
            <ReviewRow label="Standard Rate" value={form.feeStandard ? `₱${form.feeStandard}/hr` : 'Not set'} />
          </div>
          <div className="p-4 rounded-xl bg-[#F5EDE2] border border-[#E8DCCB] text-xs text-[#7D6855] space-y-1">
            <p>By submitting, you confirm that all information is accurate and that you are a licensed member of the Integrated Bar of the Philippines.</p>
            <p>Your application will be reviewed by the Justicia team. You will be notified by email and in-app when a decision is made.</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(s => (s > 0 ? (s - 1) as Step : 0))}
            className="px-5 py-2.5 rounded-xl border border-[#D8CAAD] text-[#5C4535] text-sm font-medium hover:bg-[#E5D7C5] transition-colors"
          >
            Back
          </button>
        )}
        <div className="ml-auto">
          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={isSubmitting}
              id={`reg-next-step-${step}`}
              className="px-6 py-2.5 rounded-xl bg-[#C58B3C] text-white text-sm font-semibold hover:bg-[#B07A2E] transition-colors disabled:opacity-60 shadow-md"
            >
              {isSubmitting ? 'Saving…' : step === 0 && !existingUser ? 'Create Account & Continue' : 'Save & Continue'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              id="reg-submit-btn"
              className="px-6 py-2.5 rounded-xl bg-[#34150F] text-white text-sm font-semibold hover:bg-[#23150F] transition-colors disabled:opacity-60 shadow-md"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-2 border-b border-[#E8DCCB] last:border-0">
      <span className="text-[#7D6855] font-medium min-w-[140px] shrink-0">{label}:</span>
      <span className="text-[#34150F]">{value || '—'}</span>
    </div>
  );
}

'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';
import {
  updateLawyerProfileAction,
  saveLawyerCaseAction,
  deleteLawyerCaseAction,
  type LawyerOwnProfileDetails,
  type UpdateLawyerProfileInput,
} from '@/app/actions/lawyerProfileActions';
import type { LawyerCaseSummaryRow } from '@/types/database';

// ─── Shared modal chrome ──────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const noopSubscribe = () => () => {};

/**
 * Remounts `Inner` every time `open` flips to true so each session starts from fresh state
 * (seeded from the latest saved data) while still letting the close animation play out.
 */
function useOpenSession(open: boolean): number {
  const [session, setSession] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSession((s) => s + 1);
  }
  return session;
}

const inputClass =
  'select-text w-full rounded-[12px] bg-[#E5D8CB] neu-recessed px-3.5 py-2.5 text-xs sm:text-[13px] font-inter text-[#341512] placeholder:text-[#341512]/40 focus:outline-none focus:ring-2 focus:ring-[#D39758]/60 transition-shadow';
const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-[#341512]/70 font-inter mb-1.5';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-[12px] px-6 py-2.5 font-lora text-sm font-bold text-[#341512] bg-[#D9A877] shadow-[4px_4px_10px_rgba(145,110,75,0.35),-3px_-3px_8px_rgba(255,244,232,0.55)] hover:brightness-105 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer';
const secondaryBtn =
  'inline-flex items-center justify-center rounded-[12px] px-6 py-2.5 font-lora text-sm font-bold text-[#341512] border border-[#341512]/70 hover:bg-[#D39758]/15 active:translate-y-px disabled:opacity-50 transition cursor-pointer';
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-semibold font-inter text-[#341512]/80 hover:text-[#341512] hover:bg-[#D39758]/15 transition cursor-pointer';

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin motion-reduce:animate-none`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function CloseIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Backdrop + animated dialog panel. Closes on Escape and backdrop click unless `locked`. */
function ModalFrame({
  open,
  onClose,
  label,
  locked = false,
  zIndex = 60,
  className = 'max-w-3xl',
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  locked?: boolean;
  zIndex?: number;
  className?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, locked, onClose]);

  // Portal to <body>: the shell's view wrapper animates with `transform`, which would otherwise
  // trap `position: fixed` inside the scrolling content area instead of the viewport.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => !locked && onClose()}
          style={{ zIndex }}
          className="fixed inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 28, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`w-full ${className} rounded-[28px] sm:rounded-[32px] bg-[#E5D8CB] max-h-[90vh] flex flex-col overflow-hidden text-[#341512]`}
            style={{ boxShadow: '16px 16px 40px rgba(0,0,0,0.35), -8px -8px 24px rgba(255,255,255,0.55)' }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function ModalHeader({ title, subtitle, onClose, disabled }: { title: string; subtitle?: string; onClose: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 sm:pt-7 pb-4 border-b border-[#D1BEA8]/80 shrink-0">
      <div>
        <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/90 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-[#341512]/70 font-inter mt-1">{subtitle}</p>}
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        disabled={disabled}
        className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[#341512]/70 hover:text-[#341512] hover:bg-[#D39758]/15 transition-colors cursor-pointer disabled:opacity-40"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="overflow-hidden rounded-[12px] bg-rose-100/80 border border-rose-300 px-4 py-2.5 text-xs font-medium text-rose-900"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

// ─── Confirmation modal (Figma: "Update Lawyer Profile?") ─────────────────────

export function ConfirmUpdateModal({
  open,
  pending,
  onCancel,
  onConfirm,
  title = 'Update Lawyer Profile?',
  message = 'You are about to update your public lawyer profile. Your bio, consultation rates, credentials, professional background and educational background will be saved and shown to clients browsing the Justicia lawyer directory as soon as you confirm. Please make sure every detail is accurate, current, and consistent with the Code of Professional Responsibility and Accountability before you continue.',
  confirmLabel = 'Update',
}: {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
}) {
  return (
    <ModalFrame open={open} onClose={onCancel} label={title} locked={pending} zIndex={70} className="max-w-[780px]">
      <div className="px-6 py-8 sm:px-14 sm:py-10 flex flex-col items-center gap-7 overflow-y-auto">
        <div className="neu-raised-highlight rounded-[16px] px-8 sm:px-16 py-4 sm:py-5">
          <h2 className="font-lora text-2xl sm:text-[32px] font-bold text-[#341512]/75 text-center leading-tight">{title}</h2>
        </div>
        <p className="font-inter text-[13px] sm:text-[15px] leading-[1.75] text-[#341512]/80 text-justify indent-8 sm:indent-14">
          {message}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-16 pt-1">
          <button type="button" onClick={onCancel} disabled={pending} className={`${secondaryBtn} w-36 sm:w-44`}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={`${primaryBtn} w-36 sm:w-44`}>
            {pending && <Spinner />}
            {pending ? 'Updating…' : confirmLabel}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

// ─── About tab: Edit Information ──────────────────────────────────────────────

type Row = Record<string, string> & { key: string; id?: string };

interface FieldDef {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'textarea';
  /** Tailwind col-span inside the 2-col row grid. */
  wide?: boolean;
}

let rowSeq = 0;
const newKey = () => `row-${Date.now().toString(36)}-${(rowSeq++).toString(36)}`;

function emptyRow(fields: FieldDef[]): Row {
  return Object.fromEntries([['key', newKey()], ...fields.map((f) => [f.name, ''])]) as Row;
}

const AREA_FIELDS: FieldDef[] = [
  { name: 'area', label: 'Practice area', placeholder: 'e.g. Labor & Employment', required: true },
  { name: 'description', label: 'Description', placeholder: 'Short description of the work you handle' },
];
const EXPERIENCE_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Position / Role', placeholder: 'e.g. Senior Associate', required: true },
  { name: 'organization', label: 'Firm / Organization', placeholder: 'e.g. Santos & Reyes Law Offices' },
  { name: 'years', label: 'Years', placeholder: 'e.g. 2019 – Present' },
  { name: 'description', label: 'Description', placeholder: 'Key responsibilities or achievements' },
];
const SERVICE_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Service', placeholder: 'e.g. Contract review', required: true },
  { name: 'description', label: 'Description', placeholder: 'What the client gets' },
];
const EDUCATION_FIELDS: FieldDef[] = [
  { name: 'degree', label: 'Degree', placeholder: 'e.g. Juris Doctor', required: true },
  { name: 'school', label: 'School', placeholder: 'e.g. University of the Philippines - Cebu' },
  { name: 'startYear', label: 'Start year', placeholder: '2017', type: 'number' },
  { name: 'endYear', label: 'End year', placeholder: '2021', type: 'number' },
  { name: 'description', label: 'Highlights (one per line)', placeholder: 'Dean’s Lister\nMoot court finalist', type: 'textarea', wide: true },
];

function RowListSection({
  title,
  hint,
  fields,
  rows,
  onChange,
  addLabel,
  disabled,
  showErrors = false,
}: {
  title: string;
  hint?: string;
  fields: FieldDef[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
  addLabel: string;
  disabled?: boolean;
  /** Outline required fields that are still empty (after a failed save attempt). */
  showErrors?: boolean;
}) {
  const update = (key: string, name: string, value: string) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, [name]: value } : r)));
  const remove = (key: string) => onChange(rows.filter((r) => r.key !== key));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-lora text-base sm:text-lg font-bold text-[#341512]/85">{title}</h3>
          {hint && <p className="text-[11px] text-[#341512]/60 font-inter">{hint}</p>}
        </div>
        <button type="button" disabled={disabled} onClick={() => onChange([...rows, emptyRow(fields)])} className={ghostBtn}>
          <span className="text-sm leading-none">+</span> {addLabel}
        </button>
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-[#341512]/55 font-inter italic px-1">Nothing added yet.</p>
      )}

      <AnimatePresence initial={false}>
        {rows.map((row, index) => (
          <motion.div
            key={row.key}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="neu-raised-sm rounded-[16px] bg-[#E5D8CB] p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map((f) => {
                const id = `${row.key}-${f.name}`;
                const invalid = showErrors && f.required && !isBlankRow(row, fields) && !row[f.name]?.trim();
                const ring = invalid ? ' ring-2 ring-rose-400/80' : '';
                return (
                  <div key={f.name} className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={id} className={labelClass}>
                      {f.label}
                      {f.required && <span className="text-[#C58B3C]"> *</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea
                        id={id}
                        rows={3}
                        value={row[f.name] ?? ''}
                        disabled={disabled}
                        placeholder={f.placeholder}
                        onChange={(e) => update(row.key, f.name, e.target.value)}
                        aria-invalid={invalid || undefined}
                        className={`${inputClass} resize-y${ring}`}
                      />
                    ) : (
                      <input
                        id={id}
                        type={f.type === 'number' ? 'number' : 'text'}
                        inputMode={f.type === 'number' ? 'numeric' : undefined}
                        value={row[f.name] ?? ''}
                        disabled={disabled}
                        placeholder={f.placeholder}
                        onChange={(e) => update(row.key, f.name, e.target.value)}
                        aria-invalid={invalid || undefined}
                        className={`${inputClass}${ring}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-1">
              <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} className={`${ghostBtn} disabled:opacity-30`} aria-label="Move up">
                ↑
              </button>
              <button type="button" disabled={disabled || index === rows.length - 1} onClick={() => move(index, 1)} className={`${ghostBtn} disabled:opacity-30`} aria-label="Move down">
                ↓
              </button>
              <button type="button" disabled={disabled} onClick={() => remove(row.key)} className={`${ghostBtn} hover:!text-rose-800`}>
                Remove
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}

interface ProfileFormState {
  about: string;
  ibpChapter: string;
  languages: string;
  experienceYears: string;
  barPasserYear: string;
  feeInitial30min: string;
  feeStandard60min: string;
  feeExtended120min: string;
  practiceAreas: Row[];
  experiences: Row[];
  services: Row[];
  education: Row[];
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function buildInitialForm(lawyer: PublicLawyerProfile, details: LawyerOwnProfileDetails): ProfileFormState {
  // Fall back to the registration-time practice area tags when no detailed rows exist yet.
  const areaRows: Row[] = details.practiceAreaDetails.length
    ? details.practiceAreaDetails.map((p) => ({ key: newKey(), id: p.id, area: p.area, description: str(p.description) }))
    : (lawyer.practiceAreas || []).map((area) => ({ key: newKey(), area, description: '' }));

  return {
    about: str(lawyer.about),
    ibpChapter: str(lawyer.ibpChapter),
    languages: (lawyer.languages || []).join(', '),
    experienceYears: str(lawyer.experienceYears),
    barPasserYear: str(lawyer.barPasserYear),
    feeInitial30min: str(lawyer.feeInitial30min),
    feeStandard60min: str(lawyer.feeStandard60min),
    feeExtended120min: str(lawyer.feeExtended120min),
    practiceAreas: areaRows,
    experiences: details.experiences.map((e) => ({
      key: newKey(), id: e.id, title: e.title, organization: str(e.organization), years: str(e.years), description: str(e.description),
    })),
    services: details.services.map((s) => ({ key: newKey(), id: s.id, name: s.name, description: str(s.description) })),
    education: details.education.map((e) => ({
      key: newKey(), id: e.id, degree: e.degree, school: str(e.school), startYear: str(e.start_year), endYear: str(e.end_year), description: str(e.description),
    })),
  };
}

const toNum = (v: string): number | null => (v.trim() === '' ? null : Number(v));

/** A row the user added but never typed into. These are dropped on save instead of blocking it. */
function isBlankRow(row: Row, fields: FieldDef[]): boolean {
  return fields.every((f) => !row[f.name]?.trim());
}

function withoutBlankRows(form: ProfileFormState): ProfileFormState {
  return {
    ...form,
    practiceAreas: form.practiceAreas.filter((r) => !isBlankRow(r, AREA_FIELDS)),
    experiences: form.experiences.filter((r) => !isBlankRow(r, EXPERIENCE_FIELDS)),
    services: form.services.filter((r) => !isBlankRow(r, SERVICE_FIELDS)),
    education: form.education.filter((r) => !isBlankRow(r, EDUCATION_FIELDS)),
  };
}

function toPayload(raw: ProfileFormState): UpdateLawyerProfileInput {
  const form = withoutBlankRows(raw);
  return {
    about: form.about,
    ibpChapter: form.ibpChapter,
    languages: form.languages.split(',').map((l) => l.trim()).filter(Boolean),
    experienceYears: toNum(form.experienceYears),
    barPasserYear: toNum(form.barPasserYear),
    feeInitial30min: toNum(form.feeInitial30min),
    feeStandard60min: toNum(form.feeStandard60min),
    feeExtended120min: toNum(form.feeExtended120min),
    practiceAreas: form.practiceAreas.map((r) => ({ id: r.id, area: r.area, description: r.description })),
    experiences: form.experiences.map((r) => ({ id: r.id, title: r.title, organization: r.organization, years: r.years, description: r.description })),
    services: form.services.map((r) => ({ id: r.id, name: r.name, description: r.description })),
    education: form.education.map((r) => ({
      id: r.id, degree: r.degree, school: r.school, startYear: toNum(r.startYear), endYear: toNum(r.endYear), description: r.description,
    })),
  };
}

interface FormProblem {
  message: string;
  /** DOM id of the input to scroll to and focus. */
  focusId?: string;
}

/** Quick client-side check so obvious mistakes are caught before the confirmation step. */
function validateForm(raw: ProfileFormState): FormProblem | null {
  const form = withoutBlankRows(raw);
  if (form.practiceAreas.length === 0) {
    return { message: 'Add at least one area of practice.' };
  }
  const firstMissing = (rows: Row[], field: string) => rows.find((r) => !r[field]?.trim());
  const checks: Array<[Row[], string, string]> = [
    [form.practiceAreas, 'area', 'Areas of Practice: enter a practice area name (or remove that entry).'],
    [form.experiences, 'title', 'Legal Experience: enter the Position / Role for each entry (or remove that entry).'],
    [form.services, 'name', 'Consultation Services: enter the Service name for each entry (or remove that entry).'],
    [form.education, 'degree', 'Educational Background: enter the Degree for each entry (or remove that entry).'],
  ];
  for (const [rows, field, message] of checks) {
    const row = firstMissing(rows, field);
    if (row) return { message, focusId: `${row.key}-${field}` };
  }
  for (const r of form.education) {
    for (const field of ['startYear', 'endYear'] as const) {
      const v = r[field]?.trim();
      if (v && !/^\d{4}$/.test(v)) {
        return { message: 'Educational Background: years must be 4-digit numbers (e.g. 2017).', focusId: `${r.key}-${field}` };
      }
    }
    if (r.startYear?.trim() && r.endYear?.trim() && Number(r.endYear) < Number(r.startYear)) {
      return { message: 'Educational Background: the end year cannot be before the start year.', focusId: `${r.key}-endYear` };
    }
  }
  for (const [label, key] of [
    ['Initial consultation fee', 'feeInitial30min'],
    ['Standard consultation fee', 'feeStandard60min'],
    ['Extended consultation fee', 'feeExtended120min'],
  ] as const) {
    const value = form[key];
    if (value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      return { message: `${label} must be a positive amount.`, focusId: `profile-${key}` };
    }
  }
  return null;
}

function focusField(id?: string) {
  if (!id) return;
  // Wait a frame so newly-applied error rings are rendered before scrolling.
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLInputElement | null)?.focus({ preventScroll: true });
  });
}

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  lawyer: PublicLawyerProfile;
  details: LawyerOwnProfileDetails;
}

export function EditProfileModal(props: EditProfileModalProps) {
  const session = useOpenSession(props.open);
  return <EditProfileModalInner key={session} {...props} />;
}

function EditProfileModalInner({ open, onClose, onSaved, lawyer, details }: EditProfileModalProps) {
  const [form, setForm] = useState<ProfileFormState>(() => buildInitialForm(lawyer, details));
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateForm(form);
    setError(problem?.message ?? null);
    setShowErrors(!!problem);
    if (problem) {
      focusField(problem.focusId);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setPending(true);
    try {
      const res = await updateLawyerProfileAction(toPayload(form));
      if (!res.success) {
        setError(res.error);
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      onSaved();
    } catch {
      setError('Unable to update your profile. Please try again.');
      setConfirmOpen(false);
    } finally {
      setPending(false);
    }
  };

  const textField = (key: keyof ProfileFormState, label: string, opts: { placeholder?: string; type?: 'number'; prefix?: string } = {}) => (
    <div>
      <label htmlFor={`profile-${key}`} className={labelClass}>{label}</label>
      <div className="relative">
        {opts.prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#341512]/60">{opts.prefix}</span>
        )}
        <input
          id={`profile-${key}`}
          type={opts.type ?? 'text'}
          inputMode={opts.type === 'number' ? 'decimal' : undefined}
          min={opts.type === 'number' ? 0 : undefined}
          value={form[key] as string}
          disabled={pending}
          placeholder={opts.placeholder}
          onChange={(e) => set(key, e.target.value as never)}
          className={`${inputClass} ${opts.prefix ? 'pl-8' : ''}`}
        />
      </div>
    </div>
  );

  return (
    <>
      <ModalFrame open={open} onClose={onClose} label="Edit lawyer information" locked={pending || confirmOpen}>
        <ModalHeader
          title="Edit Information"
          subtitle="Update what clients see on your Lawyer Profile. Your name and Roll No. are verified credentials and can only be changed through support."
          onClose={onClose}
          disabled={pending}
        />
        <form onSubmit={handleReview} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto neu-scrollbar-discrete px-6 sm:px-8 py-6 space-y-8">
            <section className="space-y-2">
              <h3 className="font-lora text-base sm:text-lg font-bold text-[#341512]/85">About</h3>
              <label htmlFor="profile-about" className="sr-only">About</label>
              <textarea
                id="profile-about"
                rows={6}
                maxLength={5000}
                value={form.about}
                disabled={pending}
                onChange={(e) => set('about', e.target.value)}
                placeholder="Introduce yourself to clients: your practice, approach, and the matters you handle."
                className={`${inputClass} resize-y leading-relaxed`}
              />
              <p className="text-right text-[10px] text-[#341512]/50 font-inter">{form.about.length}/5000</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-lora text-base sm:text-lg font-bold text-[#341512]/85">Consultation Rates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {textField('feeInitial30min', 'Initial (30 mins)', { type: 'number', prefix: '₱', placeholder: '700' })}
                {textField('feeStandard60min', 'Standard (1 hr)', { type: 'number', prefix: '₱', placeholder: '1500' })}
                {textField('feeExtended120min', 'Extended (2 hrs)', { type: 'number', prefix: '₱', placeholder: '2300' })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-lora text-base sm:text-lg font-bold text-[#341512]/85">Credentials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {textField('ibpChapter', 'IBP Chapter', { placeholder: 'e.g. Makati' })}
                {textField('languages', 'Languages (comma separated)', { placeholder: 'English, Filipino' })}
                {textField('experienceYears', 'Years of practice', { type: 'number', placeholder: '9' })}
                {textField('barPasserYear', 'Bar passer year', { type: 'number', placeholder: '2016' })}
              </div>
            </section>

            <RowListSection
              title="Areas of Practice"
              hint="Shown on your banner and used by the lawyer directory filters. At least one is required."
              fields={AREA_FIELDS}
              rows={form.practiceAreas}
              onChange={(rows) => set('practiceAreas', rows)}
              addLabel="Add area"
              disabled={pending}
              showErrors={showErrors}
            />
            <RowListSection
              title="Legal Experience"
              fields={EXPERIENCE_FIELDS}
              rows={form.experiences}
              onChange={(rows) => set('experiences', rows)}
              addLabel="Add experience"
              disabled={pending}
              showErrors={showErrors}
            />
            <RowListSection
              title="Consultation Services"
              fields={SERVICE_FIELDS}
              rows={form.services}
              onChange={(rows) => set('services', rows)}
              addLabel="Add service"
              disabled={pending}
              showErrors={showErrors}
            />
            <RowListSection
              title="Educational Background"
              fields={EDUCATION_FIELDS}
              rows={form.education}
              onChange={(rows) => set('education', rows)}
              addLabel="Add education"
              disabled={pending}
              showErrors={showErrors}
            />
          </div>

          {/* Footer stays visible, so a save problem is never hidden above the scrolled form. */}
          <div className="shrink-0 px-6 sm:px-8 py-4 border-t border-[#D1BEA8]/80 space-y-3">
            <ErrorBanner message={error} />
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} disabled={pending} className={secondaryBtn}>Cancel</button>
              <button type="submit" disabled={pending} className={primaryBtn}>Save Changes</button>
            </div>
          </div>
        </form>
      </ModalFrame>

      <ConfirmUpdateModal
        open={open && confirmOpen}
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}

// ─── Cases Handled: full case view (clients and the owning lawyer) ────────────

export interface CaseDetailItem {
  id: number | string;
  docket: string;
  title: string;
  content: string;
}

export function CaseDetailModal({ caseItem, onClose }: { caseItem: CaseDetailItem | null; onClose: () => void }) {
  // Keep the last case rendered while the close animation plays.
  const [shown, setShown] = useState<CaseDetailItem | null>(caseItem);
  if (caseItem && caseItem !== shown) setShown(caseItem);
  const item = caseItem ?? shown;

  return (
    <ModalFrame open={!!caseItem} onClose={onClose} label={item ? `Case: ${item.title}` : 'Case details'}>
      {item && (
        <>
          <div className="flex items-start justify-between gap-4 px-6 sm:px-9 pt-6 sm:pt-8 pb-4 border-b border-[#D1BEA8]/80 shrink-0">
            <div className="space-y-1.5 min-w-0">
              <p className="font-inter font-bold text-[10px] sm:text-[11px] text-[#D39758] uppercase tracking-wider">{item.docket}</p>
              <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512] leading-tight">{item.title}</h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[#341512]/70 hover:text-[#341512] hover:bg-[#D39758]/15 transition-colors cursor-pointer"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto neu-scrollbar-discrete px-6 sm:px-9 py-6">
            <div className="neu-recessed rounded-[20px] bg-[#E5D8CB] p-5 sm:p-7">
              <p className="select-text font-inter text-[13px] sm:text-sm text-[#341512]/85 leading-relaxed text-justify whitespace-pre-line indent-6">
                {item.content}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 sm:px-9 py-4 border-t border-[#D1BEA8]/80">
            <p className="text-[11px] text-[#341512]/60 font-inter">
              Case summaries are anonymized. No client names, case numbers, or privileged information are disclosed.
            </p>
            <button type="button" onClick={onClose} className={`${secondaryBtn} shrink-0`}>
              Close
            </button>
          </div>
        </>
      )}
    </ModalFrame>
  );
}

// ─── Cases Handled: Edit Visible Cases ────────────────────────────────────────

interface CaseFormState {
  id?: string;
  title: string;
  practiceArea: string;
  year: string;
  summary: string;
}

const EMPTY_CASE: CaseFormState = { title: '', practiceArea: '', year: '', summary: '' };

export function caseDocketLabel(c: Pick<LawyerCaseSummaryRow, 'practice_area' | 'year'>): string {
  const parts = [c.practice_area, c.year ? String(c.year) : null].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Subject Matter & Case Docket';
}

interface ManageCasesModalProps {
  open: boolean;
  onClose: () => void;
  cases: LawyerCaseSummaryRow[];
  practiceAreaSuggestions: string[];
  onChanged: (message: string) => void;
}

export function ManageCasesModal(props: ManageCasesModalProps) {
  const session = useOpenSession(props.open);
  return <ManageCasesModalInner key={session} {...props} />;
}

function ManageCasesModalInner({ open, onClose, cases, practiceAreaSuggestions, onChanged }: ManageCasesModalProps) {
  const [editing, setEditing] = useState<CaseFormState | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (c?: LawyerCaseSummaryRow) => {
    setError(null);
    setPendingDeleteId(null);
    setEditing(
      c
        ? { id: c.id, title: c.title, practiceArea: c.practice_area ?? '', year: c.year ? String(c.year) : '', summary: c.anonymized_summary }
        : { ...EMPTY_CASE }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim()) return setError('Please enter a case title.');
    if (!editing.summary.trim()) return setError('Please enter an anonymized case summary.');
    setBusy(true);
    setError(null);
    try {
      const res = await saveLawyerCaseAction({
        id: editing.id,
        title: editing.title,
        practiceArea: editing.practiceArea,
        year: editing.year.trim() ? Number(editing.year) : null,
        summary: editing.summary,
      });
      if (!res.success) return setError(res.error);
      setEditing(null);
      onChanged(editing.id ? 'Case updated.' : 'Case added to your profile.');
    } catch {
      setError('Unable to save this case. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await deleteLawyerCaseAction(id);
      if (!res.success) return setError(res.error);
      setPendingDeleteId(null);
      onChanged('Case removed from your profile.');
    } catch {
      setError('Unable to delete this case. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame open={open} onClose={onClose} label="Edit visible cases" locked={busy}>
      <ModalHeader
        title={editing ? (editing.id ? 'Edit Case' : 'Add Case') : 'Edit Visible Cases'}
        subtitle="Cases listed here are public. Keep summaries anonymized — never include client names, case numbers, or privileged details."
        onClose={onClose}
        disabled={busy}
      />

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.form
            key="case-form"
            onSubmit={handleSave}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="flex-1 min-h-0 overflow-y-auto neu-scrollbar-discrete px-6 sm:px-8 py-6 space-y-4">
              <ErrorBanner message={error} />
              <div>
                <label htmlFor="case-title" className={labelClass}>Case title <span className="text-[#C58B3C]">*</span></label>
                <input
                  id="case-title"
                  value={editing.title}
                  maxLength={200}
                  disabled={busy}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. Residential Lease Deposit Dispute & Formal Notice to Vacate"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_140px] gap-3">
                <div>
                  <label htmlFor="case-area" className={labelClass}>Subject matter</label>
                  <input
                    id="case-area"
                    list="case-area-suggestions"
                    value={editing.practiceArea}
                    maxLength={120}
                    disabled={busy}
                    onChange={(e) => setEditing({ ...editing, practiceArea: e.target.value })}
                    placeholder="e.g. Civil Law"
                    className={inputClass}
                  />
                  <datalist id="case-area-suggestions">
                    {practiceAreaSuggestions.map((a) => <option key={a} value={a} />)}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="case-year" className={labelClass}>Year</label>
                  <input
                    id="case-year"
                    type="number"
                    inputMode="numeric"
                    value={editing.year}
                    disabled={busy}
                    onChange={(e) => setEditing({ ...editing, year: e.target.value })}
                    placeholder={String(new Date().getFullYear())}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="case-summary" className={labelClass}>Anonymized summary <span className="text-[#C58B3C]">*</span></label>
                <textarea
                  id="case-summary"
                  rows={8}
                  maxLength={5000}
                  value={editing.summary}
                  disabled={busy}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                  placeholder="Describe the matter, your role, and the outcome without identifying any party."
                  className={`${inputClass} resize-y leading-relaxed`}
                />
              </div>
            </div>
            <div className="shrink-0 flex items-center justify-end gap-3 px-6 sm:px-8 py-4 border-t border-[#D1BEA8]/80">
              <button type="button" onClick={() => { setEditing(null); setError(null); }} disabled={busy} className={secondaryBtn}>
                Back
              </button>
              <button type="submit" disabled={busy} className={primaryBtn}>
                {busy && <Spinner />}
                {busy ? 'Saving…' : editing.id ? 'Save Case' : 'Add Case'}
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="case-list"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="flex-1 min-h-0 overflow-y-auto neu-scrollbar-discrete px-6 sm:px-8 py-6 space-y-3">
              <ErrorBanner message={error} />
              {cases.length === 0 && (
                <p className="py-10 text-center text-xs text-[#341512]/60 font-lora">
                  You haven’t added any cases yet. Use “Add Case” to showcase the matters you’ve handled.
                </p>
              )}
              {cases.map((c) => {
                const confirming = pendingDeleteId === c.id;
                return (
                  <motion.div
                    key={c.id}
                    layout
                    className="neu-raised-sm rounded-[16px] bg-[#E5D8CB] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-inter font-bold text-[10px] text-[#D39758] uppercase tracking-wider truncate">{caseDocketLabel(c)}</p>
                      <p className="font-lora text-sm sm:text-base font-bold text-[#341512] leading-snug truncate">{c.title}</p>
                    </div>
                    {confirming ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-inter text-rose-900">Delete this case?</span>
                        <button type="button" disabled={busy} onClick={() => setPendingDeleteId(null)} className={ghostBtn}>Keep</button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDelete(c.id)}
                          className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-bold font-inter text-white bg-rose-800 hover:bg-rose-900 disabled:opacity-50 transition cursor-pointer"
                        >
                          {busy && <Spinner className="w-3 h-3" />} Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" disabled={busy} onClick={() => startEdit(c)} className={ghostBtn}>Edit</button>
                        <button type="button" disabled={busy} onClick={() => setPendingDeleteId(c.id)} className={`${ghostBtn} hover:!text-rose-800`}>Delete</button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 sm:px-8 py-4 border-t border-[#D1BEA8]/80">
              <span className="text-xs font-inter text-[#341512]/70">{cases.length} case{cases.length === 1 ? '' : 's'} on your profile</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>Done</button>
                <button type="button" onClick={() => startEdit()} disabled={busy} className={primaryBtn}>+ Add Case</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalFrame>
  );
}

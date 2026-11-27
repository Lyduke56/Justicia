'use client';

/**
 * Lawyer Profile (owner) dialogs, all in the shared neumorphic modal frame (NeuModal) used by the
 * booking, cancellation and documents dialogs: raised icon tile, Lora title, scrolling body that
 * cascades in, and a footer with NeuButtons.
 *  - EditProfileModal: "Edit Information" for the About tab. Its sections follow the About tab
 *    top to bottom: About Me, Consultation Rates, Areas of Practice, Legal Experience,
 *    Consultation Services, Philippine Bar Examination Passer, Educational Background.
 *  - ConfirmUpdateModal: "Update your lawyer profile?" before the changes go public. Confirming
 *    morphs it into the submission loader, which then writes a check or an X.
 *  - ManageCasesModal: "Edit Visible Cases" (list, add, edit, delete). Saving or deleting a case
 *    morphs the dialog into the loader → check / X, then back to the list.
 *  - CaseDetailModal: the full case view (clients and the owner).
 */
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { PublicLawyerProfile } from '@/components/client/LawyerGrid';
import {
  updateLawyerProfileAction,
  saveLawyerCaseAction,
  deleteLawyerCaseAction,
  type LawyerOwnProfileDetails,
  type UpdateLawyerProfileInput,
} from '@/app/actions/lawyerProfileActions';
import type { LawyerCaseSummaryRow } from '@/types/database';
import { SubmitModal, settle, useSubmission, type SubmissionCopy, type SubmissionState } from '@/components/shared/feedback';
import {
  AlertIcon,
  CheckCircleIcon,
  ClipboardIcon,
  EmptyState,
  InfoIcon,
  NeuAlert,
  NeuButton,
  NeuModal,
  NeuNumberStepper,
  PencilIcon,
  TrashIcon,
  UserIcon,
  WalletIcon,
} from '@/components/shared/neu';

// ─── Shared form parts ────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const CURRENT_YEAR = new Date().getFullYear();

const labelClass = 'block font-lora text-[11px] font-bold uppercase tracking-[0.14em] text-[#946525] mb-2';
const inputClass =
  'neu-input select-text w-full h-11 rounded-xl px-4 font-inter text-[13px] text-[#23150F] disabled:cursor-not-allowed disabled:opacity-60';
const textareaClass =
  'neu-input neu-scrollbar-discrete select-text w-full rounded-[18px] px-4 py-3.5 font-inter text-[13px] text-[#23150F] leading-relaxed resize-y disabled:cursor-not-allowed disabled:opacity-60';
const iconBtnClass =
  'neu-raised-sm grid size-8 shrink-0 place-items-center rounded-full bg-[#E5D8CB] text-[#5C4535] transition-colors hover:text-[#A8742E] disabled:pointer-events-none disabled:opacity-35 cursor-pointer';

/** Line icon in the same stroke style as the About tab's card icons. */
function Glyph({ children, className = 'w-[18px] h-[18px]' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS = {
  areas: (
    <Glyph>
      <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </Glyph>
  ),
  experience: (
    <Glyph>
      <path d="m14 13-7.5 7.5a2.12 2.12 0 1 1-3-3L11 10" />
      <path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8" />
    </Glyph>
  ),
  services: (
    <Glyph>
      <path d="M7.5 8.25h9m-9 3H12m-9.75 6.75 3.19-1.595A3 3 0 0 1 7.234 16H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12.75Z" />
    </Glyph>
  ),
  bar: (
    <Glyph>
      <circle cx="12" cy="8" r="5.5" />
      <path d="M15.5 13.5 17.5 21l-5.5-2.75L6.5 21l2-7.5" />
      <path d="m9.75 8 1.5 1.5 3-3" />
    </Glyph>
  ),
  education: (
    <Glyph>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </Glyph>
  ),
  lock: (
    <Glyph className="w-3.5 h-3.5">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Glyph>
  ),
};

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}

/** One titled group of the form: raised icon tile, Lora heading, a hint and an optional action. */
function FormSection({
  id,
  icon,
  title,
  hint,
  action,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="neu-raised-sm grid size-9 shrink-0 place-items-center rounded-xl bg-[#E5D8CB] text-[#C58B3C]">{icon}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 id={id} className="font-lora text-[15px] sm:text-base font-bold leading-tight text-[#341512]">
            {title}
          </h3>
          {hint && <p className="mt-1 font-inter text-[11.5px] leading-relaxed text-[#7D6855]">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** A number field with the raised up / down capsule (and an optional ₱ prefix). */
function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  min,
  max,
  step,
  fallback,
  prefix,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  fallback?: number;
  prefix?: string;
  invalid?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-inter text-[13px] font-semibold text-[#7D6855]">{prefix}</span>
        )}
        <input
          id={id}
          type="number"
          inputMode={step && step % 1 !== 0 ? 'decimal' : 'numeric'}
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          className={`${inputClass} pr-12 ${prefix ? 'pl-8' : ''} ${invalid ? 'neu-input-error' : ''}`}
        />
        <NeuNumberStepper value={value} onChange={onChange} min={min} max={max} step={step} fallback={fallback} label={label.toLowerCase()} disabled={disabled} />
      </div>
    </div>
  );
}

// ─── Confirmation ("Update your lawyer profile?") ─────────────────────────────

export function ConfirmUpdateModal({
  open,
  submission,
  onClose,
  onConfirm,
  title = 'Update your lawyer profile?',
  message = 'Your changes will be shown to clients browsing the Justicia lawyer directory as soon as you confirm. Please make sure every detail is accurate, current, and consistent with the Code of Professional Responsibility and Accountability.',
  confirmLabel = 'Update Profile',
}: {
  open: boolean;
  submission: SubmissionState;
  /** Cancel, or close the result card (the caller checks submission.phase). */
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <SubmitModal
          key="confirm-update"
          submission={submission}
          onClose={onClose}
          processing={{ title: 'Updating your profile', message: 'Saving your changes to the lawyer directory.' }}
          success={{ title: 'Profile updated', message: 'Clients now see your updated information on your Lawyer Profile.' }}
          failure={{ title: "We couldn't update your profile", retryLabel: 'Try Again' }}
          size="md"
          icon={<AlertIcon className="w-5 h-5" />}
          title={title}
          subtitle={message}
          bodyClassName="space-y-4"
          footer={
            <>
              <NeuButton variant="secondary" onClick={onClose} disabled={submission.phase === 'processing'}>
                Keep Editing
              </NeuButton>
              <NeuButton variant="primary" disabled={submission.phase === 'processing'} icon={<CheckCircleIcon className="w-4 h-4" />} onClick={onConfirm}>
                {confirmLabel}
              </NeuButton>
            </>
          }
        >
          <NeuAlert tone="info">Your name and Roll of Attorneys No. are verified credentials. They stay as they are and can only be changed through support.</NeuAlert>
        </SubmitModal>
      )}
    </AnimatePresence>
  );
}

// ─── About tab: Edit Information ──────────────────────────────────────────────

type Row = Record<string, string> & { key: string; id?: string };

interface FieldDef {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'year' | 'textarea';
  maxLength?: number;
  /** Spans both columns of the entry grid. */
  wide?: boolean;
}

let rowSeq = 0;
const newKey = () => `row-${Date.now().toString(36)}-${(rowSeq++).toString(36)}`;

function emptyRow(fields: FieldDef[]): Row {
  return Object.fromEntries([['key', newKey()], ...fields.map((f) => [f.name, ''])]) as Row;
}

const AREA_FIELDS: FieldDef[] = [
  { name: 'area', label: 'Practice area', placeholder: 'e.g. Labor & Employment', required: true, maxLength: 120 },
  { name: 'description', label: 'Description', placeholder: 'Short description of the work you handle', maxLength: 1000 },
];
const EXPERIENCE_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Position / Role', placeholder: 'e.g. Senior Associate', required: true, maxLength: 200 },
  { name: 'organization', label: 'Firm / Organization', placeholder: 'e.g. Santos & Reyes Law Offices', maxLength: 200 },
  { name: 'years', label: 'Years', placeholder: 'e.g. 2019 – Present', maxLength: 50 },
  { name: 'description', label: 'Description', placeholder: 'Key responsibilities or achievements', maxLength: 1000 },
];
const SERVICE_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Service', placeholder: 'e.g. Contract review', required: true, maxLength: 200 },
  { name: 'description', label: 'Description', placeholder: 'What the client gets', maxLength: 1000 },
];
const EDUCATION_FIELDS: FieldDef[] = [
  { name: 'degree', label: 'Degree', placeholder: 'e.g. Juris Doctor', required: true, maxLength: 200 },
  { name: 'school', label: 'School', placeholder: 'e.g. University of the Philippines - Cebu', maxLength: 200 },
  { name: 'startYear', label: 'Start year', placeholder: '2017', type: 'year' },
  { name: 'endYear', label: 'End year', placeholder: '2021', type: 'year' },
  { name: 'description', label: 'Highlights (one per line)', placeholder: 'Dean’s Lister\nMoot court finalist', type: 'textarea', wide: true, maxLength: 2000 },
];

function RowList({
  id,
  icon,
  title,
  hint,
  itemLabel,
  addLabel,
  fields,
  rows,
  onChange,
  disabled,
  showErrors = false,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  /** Names each entry ("Area 1", "Service 2"…). */
  itemLabel: string;
  addLabel: string;
  fields: FieldDef[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
  disabled?: boolean;
  /** Mark required fields that are still empty (after a failed save attempt). */
  showErrors?: boolean;
}) {
  const update = (key: string, name: string, value: string) => onChange(rows.map((r) => (r.key === key ? { ...r, [name]: value } : r)));
  const remove = (key: string) => onChange(rows.filter((r) => r.key !== key));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <FormSection
      id={id}
      icon={icon}
      title={title}
      hint={hint}
      action={
        <NeuButton size="sm" disabled={disabled} onClick={() => onChange([...rows, emptyRow(fields)])}>
          <span aria-hidden="true" className="text-sm leading-none">+</span> {addLabel}
        </NeuButton>
      }
    >
      {rows.length === 0 && (
        <p className="neu-recessed rounded-[18px] px-5 py-4 text-center font-inter text-xs text-[#7D6855]">Nothing added yet.</p>
      )}

      <AnimatePresence initial={false}>
        {rows.map((row, index) => (
          <motion.div
            key={row.key}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="neu-raised-sm rounded-[20px] bg-[#E5D8CB] p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-inter text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#7D6855]">
                {itemLabel} {index + 1}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} className={iconBtnClass} aria-label={`Move ${itemLabel.toLowerCase()} ${index + 1} up`}>
                  <Arrow up />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === rows.length - 1}
                  onClick={() => move(index, 1)}
                  className={iconBtnClass}
                  aria-label={`Move ${itemLabel.toLowerCase()} ${index + 1} down`}
                >
                  <Arrow up={false} />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(row.key)}
                  className={`${iconBtnClass} hover:text-[#B42318]!`}
                  aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((f) => {
                const fieldId = `${row.key}-${f.name}`;
                const invalid = showErrors && !!f.required && !isBlankRow(row, fields) && !row[f.name]?.trim();
                const value = row[f.name] ?? '';
                if (f.type === 'year') {
                  return (
                    <NumberField
                      key={f.name}
                      id={fieldId}
                      label={f.label}
                      value={value}
                      onChange={(v) => update(row.key, f.name, v)}
                      disabled={disabled}
                      placeholder={f.placeholder}
                      min={1950}
                      max={CURRENT_YEAR + 8}
                      fallback={CURRENT_YEAR}
                    />
                  );
                }
                return (
                  <div key={f.name} className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={fieldId} className={labelClass}>
                      {f.label}
                      {f.required && <span className="text-[#C58B3C]"> *</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea
                        id={fieldId}
                        rows={3}
                        maxLength={f.maxLength}
                        value={value}
                        disabled={disabled}
                        placeholder={f.placeholder}
                        onChange={(e) => update(row.key, f.name, e.target.value)}
                        className={textareaClass}
                      />
                    ) : (
                      <input
                        id={fieldId}
                        type="text"
                        maxLength={f.maxLength}
                        value={value}
                        disabled={disabled}
                        placeholder={f.placeholder}
                        onChange={(e) => update(row.key, f.name, e.target.value)}
                        aria-invalid={invalid || undefined}
                        className={`${inputClass} ${invalid ? 'neu-input-error' : ''}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </FormSection>
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
  if (form.practiceAreas.length === 0) {
    return { message: 'Add at least one area of practice.' };
  }
  const firstMissing = (rows: Row[], field: string) => rows.find((r) => !r[field]?.trim());
  const checks: Array<[Row[], string, string]> = [
    [form.practiceAreas, 'area', 'Areas of Practice: enter a practice area name (or remove that entry).'],
    [form.experiences, 'title', 'Legal Experience: enter the Position / Role for each entry (or remove that entry).'],
    [form.services, 'name', 'Consultation Services: enter the Service name for each entry (or remove that entry).'],
  ];
  for (const [rows, field, message] of checks) {
    const row = firstMissing(rows, field);
    if (row) return { message, focusId: `${row.key}-${field}` };
  }
  const bar = form.barPasserYear.trim();
  if (bar && (!/^\d{4}$/.test(bar) || Number(bar) < 1901 || Number(bar) > CURRENT_YEAR)) {
    return { message: `Philippine Bar Examination: enter the year you passed (1901 – ${CURRENT_YEAR}).`, focusId: 'profile-barPasserYear' };
  }
  const years = form.experienceYears.trim();
  if (years && (!/^\d{1,2}$/.test(years) || Number(years) > 80)) {
    return { message: 'Years of practice must be a whole number from 0 to 80.', focusId: 'profile-experienceYears' };
  }
  const missingDegree = firstMissing(form.education, 'degree');
  if (missingDegree) {
    return { message: 'Educational Background: enter the Degree for each entry (or remove that entry).', focusId: `${missingDegree.key}-degree` };
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
  return null;
}

function focusField(id?: string) {
  if (!id) return;
  // Wait a frame so newly applied error styles are rendered before scrolling.
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

/** Each opening starts from the latest saved profile (the dialog remounts), and its exit plays. */
export function EditProfileModal({ open, ...props }: EditProfileModalProps) {
  return <AnimatePresence>{open && <EditProfileDialog key="edit-profile" {...props} />}</AnimatePresence>;
}

function EditProfileDialog({ onClose, onSaved, lawyer, details }: Omit<EditProfileModalProps, 'open'>) {
  const [form, setForm] = useState<ProfileFormState>(() => buildInitialForm(lawyer, details));
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submission = useSubmission();
  // The form is locked while saving and once saved (the dialog closes after "Done").
  const pending = submission.phase === 'processing' || submission.phase === 'success';
  const [showErrors, setShowErrors] = useState(false);

  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const review = () => {
    const problem = validateForm(form);
    setError(problem?.message ?? null);
    setShowErrors(!!problem);
    if (problem) {
      focusField(problem.focusId);
      return;
    }
    submission.reset();
    setConfirmOpen(true);
  };

  /** The confirmation morphs into the loader, then the check (or the X with the reason). */
  const confirm = async () => {
    const result = await submission.run(() => settle(() => updateLawyerProfileAction(toPayload(form)), 'Unable to update your profile. Please try again.'));
    if (result && !result.ok) setError(result.error);
  };

  /** "Done" after a success closes everything; otherwise back to the form. */
  const closeConfirm = () => {
    if (submission.phase === 'success') onSaved();
    else setConfirmOpen(false);
  };

  const textField = (key: 'ibpChapter' | 'languages', label: string, placeholder: string, maxLength = 120) => (
    <div>
      <label htmlFor={`profile-${key}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`profile-${key}`}
        type="text"
        maxLength={maxLength}
        value={form[key]}
        disabled={pending}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
        className={inputClass}
      />
    </div>
  );

  const barYear = form.barPasserYear.trim();

  return (
    <>
      <NeuModal
        onClose={onClose}
        dismissible={!pending && !confirmOpen}
        size="xl"
        icon={<PencilIcon className="w-5 h-5" />}
        title="Edit Information"
        subtitle="Update what clients see on the About tab of your Lawyer Profile. Your name and Roll No. are verified credentials and can only be changed through support."
        bodyClassName="space-y-8 [&>*+*]:border-t [&>*+*]:border-[#CDBCA8]/60 [&>*+*]:pt-8"
        footerStart={
          error ? (
            <span role="alert" className="flex items-start gap-2 text-left font-medium text-[#B42318]">
              <AlertIcon className="mt-px h-4 w-4 shrink-0" />
              {error}
            </span>
          ) : (
            'Changes go live on your profile after you confirm.'
          )
        }
        footer={
          <>
            <NeuButton variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </NeuButton>
            <NeuButton variant="primary" onClick={review} disabled={pending}>
              Save Changes
            </NeuButton>
          </>
        }
      >
        {/* About Me (the bio card) */}
        <FormSection id="edit-about" icon={<UserIcon className="w-[18px] h-[18px]" />} title="About Me" hint="The introduction at the top of your About tab.">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="profile-about" className={labelClass}>
                Introduction
              </label>
              <span className="font-inter text-[10.5px] text-[#7D6855]">{form.about.length}/5000</span>
            </div>
            <textarea
              id="profile-about"
              rows={6}
              maxLength={5000}
              value={form.about}
              disabled={pending}
              onChange={(e) => set('about', e.target.value)}
              placeholder="Introduce yourself to clients: your practice, approach, and the matters you handle."
              className={textareaClass}
            />
          </div>
          {textField('languages', 'Languages spoken (comma separated)', 'English, Filipino, Cebuano')}
          <p className="-mt-2 font-inter text-[11px] text-[#7D6855]">Clients can filter the Find a Lawyer directory by language.</p>
        </FormSection>

        {/* Consultation Rates card */}
        <FormSection id="edit-rates" icon={<WalletIcon className="w-[18px] h-[18px]" />} title="Consultation Rates" hint="Per session. Leave a rate empty to show “Not set”.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField id="profile-feeInitial30min" label="Initial (30 mins)" prefix="₱" placeholder="700" min={0} step={50} fallback={500} value={form.feeInitial30min} onChange={(v) => set('feeInitial30min', v)} disabled={pending} />
            <NumberField id="profile-feeStandard60min" label="Standard (1 hr)" prefix="₱" placeholder="1500" min={0} step={50} fallback={1000} value={form.feeStandard60min} onChange={(v) => set('feeStandard60min', v)} disabled={pending} />
            <NumberField id="profile-feeExtended120min" label="Extended (2 hrs)" prefix="₱" placeholder="2300" min={0} step={50} fallback={2000} value={form.feeExtended120min} onChange={(v) => set('feeExtended120min', v)} disabled={pending} />
          </div>
        </FormSection>

        {/* Professional Background, in the order of its four cards */}
        <RowList
          id="edit-areas"
          icon={ICONS.areas}
          title="Areas of Practice"
          hint="Shown on your banner and used by the lawyer directory filters. At least one is required."
          itemLabel="Area"
          addLabel="Add area"
          fields={AREA_FIELDS}
          rows={form.practiceAreas}
          onChange={(rows) => set('practiceAreas', rows)}
          disabled={pending}
          showErrors={showErrors}
        />
        <RowList
          id="edit-experience"
          icon={ICONS.experience}
          title="Legal Experience"
          itemLabel="Position"
          addLabel="Add experience"
          fields={EXPERIENCE_FIELDS}
          rows={form.experiences}
          onChange={(rows) => set('experiences', rows)}
          disabled={pending}
          showErrors={showErrors}
        />
        <RowList
          id="edit-services"
          icon={ICONS.services}
          title="Consultation Services"
          itemLabel="Service"
          addLabel="Add service"
          fields={SERVICE_FIELDS}
          rows={form.services}
          onChange={(rows) => set('services', rows)}
          disabled={pending}
          showErrors={showErrors}
        />

        {/* Philippine Bar Examination Passer card */}
        <FormSection
          id="edit-bar"
          icon={ICONS.bar}
          title="Philippine Bar Examination Passer"
          hint={
            <>
              Shown on your profile as{' '}
              <strong className="font-semibold text-[#5C4535]">“Philippine Bar Examination Passer{barYear ? ` (${barYear})` : ''}”</strong>, with your Roll No., IBP
              chapter and years of practice listed under it.
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              id="profile-barPasserYear"
              label="Year passed"
              placeholder="2016"
              min={1901}
              max={CURRENT_YEAR}
              fallback={CURRENT_YEAR - 1}
              value={form.barPasserYear}
              onChange={(v) => set('barPasserYear', v)}
              disabled={pending}
            />
            <div>
              <label htmlFor="profile-rollNumber" className={labelClass}>
                Roll of Attorneys No.
              </label>
              <div className="relative">
                <input
                  id="profile-rollNumber"
                  type="text"
                  readOnly
                  value={lawyer.rollNumber || '—'}
                  aria-describedby="profile-rollNumber-note"
                  className={`${inputClass} cursor-not-allowed pr-11 text-[#5C4535]`}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9A8270]">{ICONS.lock}</span>
              </div>
              <p id="profile-rollNumber-note" className="mt-1.5 font-inter text-[10.5px] text-[#7D6855]">
                Verified credential. Contact support to change it.
              </p>
            </div>
            {textField('ibpChapter', 'IBP Chapter', 'e.g. Makati')}
            <NumberField
              id="profile-experienceYears"
              label="Years of practice"
              placeholder="9"
              min={0}
              max={80}
              fallback={1}
              value={form.experienceYears}
              onChange={(v) => set('experienceYears', v)}
              disabled={pending}
            />
          </div>
        </FormSection>

        <RowList
          id="edit-education"
          icon={ICONS.education}
          title="Educational Background"
          itemLabel="School"
          addLabel="Add education"
          fields={EDUCATION_FIELDS}
          rows={form.education}
          onChange={(rows) => set('education', rows)}
          disabled={pending}
          showErrors={showErrors}
        />
      </NeuModal>

      <ConfirmUpdateModal open={confirmOpen} submission={submission} onClose={closeConfirm} onConfirm={confirm} />
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
  return (
    <AnimatePresence>
      {caseItem && (
        <NeuModal
          key={`case-${caseItem.id}`}
          onClose={onClose}
          size="xl"
          icon={<ClipboardIcon className="w-5 h-5" />}
          title={caseItem.title}
          subtitle={<span className="font-bold uppercase tracking-[0.12em] text-[#946525]">{caseItem.docket}</span>}
          footerStart="Case summaries are anonymized. No client names, case numbers, or privileged information are disclosed."
          footer={<NeuButton onClick={onClose}>Close</NeuButton>}
        >
          <div className="neu-recessed rounded-[22px] p-5 sm:p-7">
            <p className="select-text whitespace-pre-line text-justify indent-6 font-inter text-[13px] leading-relaxed text-[#3E2A1E] sm:text-sm">{caseItem.content}</p>
          </div>
        </NeuModal>
      )}
    </AnimatePresence>
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

export function ManageCasesModal({ open, ...props }: ManageCasesModalProps) {
  return <AnimatePresence>{open && <ManageCasesDialog key="manage-cases" {...props} />}</AnimatePresence>;
}

const VIEW_SWAP = {
  initial: (dir: number) => ({ opacity: 0, x: 24 * dir }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.26, ease: EASE_OUT } },
  exit: (dir: number) => ({ opacity: 0, x: -24 * dir, transition: { duration: 0.16 } }),
};

function ManageCasesDialog({ onClose, cases, practiceAreaSuggestions, onChanged }: Omit<ManageCasesModalProps, 'open'>) {
  const [editing, setEditing] = useState<CaseFormState | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const submission = useSubmission();
  const busy = submission.processing;
  /** Wording of the result card for the save or delete in progress. */
  const [copy, setCopy] = useState<{ processing: SubmissionCopy; success: SubmissionCopy; failure: string }>({
    processing: { title: 'Saving the case' },
    success: { title: 'Case saved' },
    failure: "We couldn't save this case",
  });
  /** Form problems (missing title or summary). Request errors are shown by the result card. */
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ title?: boolean; summary?: boolean }>({});

  const startEdit = (c?: LawyerCaseSummaryRow) => {
    setError(null);
    setMissing({});
    setPendingDeleteId(null);
    setEditing(
      c ? { id: c.id, title: c.title, practiceArea: c.practice_area ?? '', year: c.year ? String(c.year) : '', summary: c.anonymized_summary } : { ...EMPTY_CASE }
    );
  };

  const back = () => {
    setEditing(null);
    setError(null);
    setMissing({});
  };

  const save = async () => {
    if (!editing) return;
    const gaps = { title: !editing.title.trim(), summary: !editing.summary.trim() };
    setMissing(gaps);
    if (gaps.title || gaps.summary) {
      setError(gaps.title ? 'Please enter a case title.' : 'Please enter an anonymized case summary.');
      focusField(gaps.title ? 'case-title' : 'case-summary');
      return;
    }
    setError(null);
    const isNew = !editing.id;
    setCopy({
      processing: { title: isNew ? 'Adding the case' : 'Saving the case', message: 'Updating the cases on your profile.' },
      success: { title: isNew ? 'Case added' : 'Case updated', message: 'Clients can now read it on your Cases Handled tab.' },
      failure: "We couldn't save this case",
    });
    const result = await submission.run(() =>
      settle(
        () =>
          saveLawyerCaseAction({
            id: editing.id,
            title: editing.title,
            practiceArea: editing.practiceArea,
            year: editing.year.trim() ? Number(editing.year) : null,
            summary: editing.summary,
          }),
        'Unable to save this case. Please try again.'
      )
    );
    if (result?.ok) onChanged(isNew ? 'Case added to your profile.' : 'Case updated.');
  };

  const remove = async (id: string) => {
    setError(null);
    setCopy({
      processing: { title: 'Removing the case', message: 'Taking it off your profile.' },
      success: { title: 'Case removed', message: 'It no longer appears on your Cases Handled tab.' },
      failure: "We couldn't remove this case",
    });
    const result = await submission.run(() => settle(() => deleteLawyerCaseAction(id), 'Unable to delete this case. Please try again.'));
    if (result?.ok) onChanged('Case removed from your profile.');
  };

  /** "Back to Cases" after a success returns to the list; otherwise the dialog closes. */
  const closeOrContinue = () => {
    if (submission.phase === 'success') {
      setEditing(null);
      setPendingDeleteId(null);
      submission.reset();
    } else {
      onClose();
    }
  };

  const dir = editing ? 1 : -1;

  return (
    <SubmitModal
      submission={submission}
      onClose={closeOrContinue}
      processing={copy.processing}
      success={{ ...copy.success, actionLabel: 'Back to Cases' }}
      failure={{ title: copy.failure }}
      size="xl"
      icon={editing ? <PencilIcon className="w-5 h-5" /> : <ClipboardIcon className="w-5 h-5" />}
      title={editing ? (editing.id ? 'Edit Case' : 'Add Case') : 'Edit Visible Cases'}
      subtitle="Cases listed here are public. Keep summaries anonymized: never include client names, case numbers, or privileged details."
      bodyClassName="space-y-5"
      footerStart={editing ? undefined : `${cases.length} case${cases.length === 1 ? '' : 's'} on your profile`}
      footer={
        editing ? (
          <>
            <NeuButton key="back" onClick={back} disabled={busy}>
              Back
            </NeuButton>
            <NeuButton key="save" variant="primary" disabled={busy} icon={<CheckCircleIcon className="w-4 h-4" />} onClick={save}>
              {editing.id ? 'Save Case' : 'Add Case'}
            </NeuButton>
          </>
        ) : (
          <>
            <NeuButton key="done" onClick={onClose} disabled={busy}>
              Done
            </NeuButton>
            <NeuButton key="add" variant="primary" onClick={() => startEdit()} disabled={busy}>
              + Add Case
            </NeuButton>
          </>
        )
      }
    >
      <div className="space-y-5">
        <AnimatePresence initial={false}>
          {error && (
            <NeuAlert key="case-error" tone="error" onDismiss={() => setError(null)}>
              {error}
            </NeuAlert>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          {editing ? (
            <motion.div key="case-form" custom={dir} variants={VIEW_SWAP} initial="initial" animate="animate" exit="exit" className="space-y-5">
              <div>
                <label htmlFor="case-title" className={labelClass}>
                  Case title <span className="text-[#C58B3C]">*</span>
                </label>
                <input
                  id="case-title"
                  value={editing.title}
                  maxLength={200}
                  disabled={busy}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. Residential Lease Deposit Dispute & Formal Notice to Vacate"
                  aria-invalid={missing.title || undefined}
                  className={`${inputClass} ${missing.title && !editing.title.trim() ? 'neu-input-error' : ''}`}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
                <div>
                  <label htmlFor="case-area" className={labelClass}>
                    Subject matter
                  </label>
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
                    {practiceAreaSuggestions.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
                <NumberField
                  id="case-year"
                  label="Year"
                  value={editing.year}
                  onChange={(year) => setEditing({ ...editing, year })}
                  min={1900}
                  max={CURRENT_YEAR}
                  fallback={CURRENT_YEAR}
                  placeholder={String(CURRENT_YEAR)}
                  disabled={busy}
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="case-summary" className={labelClass}>
                    Anonymized summary <span className="text-[#C58B3C]">*</span>
                  </label>
                  <span className="font-inter text-[10.5px] text-[#7D6855]">{editing.summary.length}/5000</span>
                </div>
                <textarea
                  id="case-summary"
                  rows={8}
                  maxLength={5000}
                  value={editing.summary}
                  disabled={busy}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                  placeholder="Describe the matter, your role, and the outcome without identifying any party."
                  aria-invalid={missing.summary || undefined}
                  className={`${textareaClass} ${missing.summary && !editing.summary.trim() ? 'neu-input-error' : ''}`}
                />
              </div>
              <p className="flex items-start gap-2 font-inter text-[11px] leading-relaxed text-[#7D6855]">
                <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0 text-[#C58B3C]" />
                Clients see the subject matter and year above the title, and the full summary when they open the case.
              </p>
            </motion.div>
          ) : (
            <motion.div key="case-list" custom={dir} variants={VIEW_SWAP} initial="initial" animate="animate" exit="exit" className="space-y-3">
              {cases.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<ClipboardIcon />}
                  title="No cases on your profile yet"
                  description="Use “Add Case” to showcase the matters you’ve handled."
                />
              ) : (
                cases.map((c) => {
                  const confirming = pendingDeleteId === c.id;
                  return (
                    <motion.div key={c.id} layout className="neu-raised-sm flex flex-col gap-3 rounded-[20px] bg-[#E5D8CB] p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-inter text-[10px] font-bold uppercase tracking-[0.12em] text-[#946525]">{caseDocketLabel(c)}</p>
                        <p className="mt-1 truncate font-lora text-sm font-bold leading-snug text-[#341512] sm:text-[15px]">{c.title}</p>
                        <p className="mt-0.5 line-clamp-1 font-inter text-[11.5px] text-[#7D6855]">{c.anonymized_summary}</p>
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        {confirming ? (
                          <motion.div
                            key="confirm"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.18 }}
                            className="flex shrink-0 flex-wrap items-center gap-2"
                          >
                            <span className="font-inter text-[11.5px] font-medium text-[#B42318]">Delete this case?</span>
                            <NeuButton size="sm" disabled={busy} onClick={() => setPendingDeleteId(null)}>
                              Keep
                            </NeuButton>
                            <NeuButton size="sm" variant="danger" disabled={busy} onClick={() => remove(c.id)}>
                              Delete
                            </NeuButton>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="actions"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.18 }}
                            className="flex shrink-0 items-center gap-2 self-end sm:self-auto"
                          >
                            <button type="button" disabled={busy} onClick={() => startEdit(c)} className={`${iconBtnClass} size-9`} aria-label={`Edit ${c.title}`}>
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setError(null);
                                setPendingDeleteId(c.id);
                              }}
                              className={`${iconBtnClass} size-9 hover:text-[#B42318]!`}
                              aria-label={`Delete ${c.title}`}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SubmitModal>
  );
}

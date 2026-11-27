'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getMyConsultationHoursAction, saveMyConsultationHoursAction } from '@/app/actions/consultationHoursActions';
import { NeuSwitch } from '@/components/account/ClientAccountSettings';
import { SubmissionOverlay, useSubmission } from '@/components/shared/feedback';
import { NeuAlert } from '@/components/shared/neu';
import {
  CONSULTATION_WEEKDAYS,
  DEFAULT_CONSULTATION_HOURS,
  DEFAULT_DAY_HOURS,
  EARLIEST_MINUTES,
  LATEST_MINUTES,
  MAX_BREAKS,
  SLOT_MINUTES,
  STEP_MINUTES,
  formatClock,
  normalizeHours,
  slotStartsFor,
  type ConsultationHours,
  type DayHours,
  type WeekdayNumber,
} from '@/lib/lawyer/consultationHours';

/**
 * Lawyer Profile → Availability: the regular weekly consultation hours, Monday to Saturday.
 * Each day is open or closed, with its own hours and breaks (lunch, dinner, ...). Clients can
 * only book one-hour slots inside these hours; specific dates are still blocked with
 * "Set Unavailability" below. Same building blocks as LawyerUnavailabilityManager.
 */

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TIME_OPTIONS = Array.from(
  { length: (LATEST_MINUTES - EARLIEST_MINUTES) / STEP_MINUTES + 1 },
  (_, i) => EARLIEST_MINUTES + i * STEP_MINUTES
);

const selectClass =
  'w-full rounded-full bg-[#E5D8CB] neu-recessed px-4 py-2.5 text-xs sm:text-[13px] font-lora text-[#341512] focus:outline-none focus:ring-2 focus:ring-[#D39758]/60 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const linkButtonClass =
  'rounded-[10px] px-3 py-1.5 text-[11px] font-semibold font-inter text-[#341512]/80 hover:text-[#341512] hover:bg-[#D39758]/15 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const key = (day: WeekdayNumber) => String(day) as `${WeekdayNumber}`;
const clone = (h: ConsultationHours): ConsultationHours => JSON.parse(JSON.stringify(h));

function TimeSelect({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className={selectClass}>
      {options.map((m) => (
        <option key={m} value={m}>
          {formatClock(m)}
        </option>
      ))}
    </select>
  );
}

export function ConsultationHoursEditor({ onSaved }: { onSaved?: (hours: ConsultationHours) => void }) {
  const [saved, setSaved] = useState<ConsultationHours | null>(null);
  const [draft, setDraft] = useState<ConsultationHours>(() => clone(DEFAULT_CONSULTATION_HOURS));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const submission = useSubmission();
  const saving = submission.processing;

  useEffect(() => {
    let active = true;
    getMyConsultationHoursAction()
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setSaved(res.hours);
          setDraft(clone(res.hours));
        } else {
          setError(res.error);
        }
      })
      .catch(() => active && setError('Your consultation hours could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const dirty = useMemo(() => !!saved && JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  const updateDay = (day: WeekdayNumber, change: (d: DayHours) => DayHours) => {
    setError(null);
    setDraft((prev) => ({ days: { ...prev.days, [key(day)]: change(prev.days[key(day)]) } }));
  };

  const setOpen = (day: WeekdayNumber, open: boolean) =>
    updateDay(day, (d) =>
      open && d.end - d.start < SLOT_MINUTES ? { ...DEFAULT_DAY_HOURS, breaks: DEFAULT_DAY_HOURS.breaks.map((b) => ({ ...b })) } : { ...d, open }
    );

  const setStart = (day: WeekdayNumber, start: number) =>
    updateDay(day, (d) => ({
      ...d,
      start,
      end: Math.max(d.end, Math.min(start + SLOT_MINUTES, LATEST_MINUTES)),
      breaks: d.breaks.filter((b) => b.start >= start),
    }));

  const setEnd = (day: WeekdayNumber, end: number) =>
    updateDay(day, (d) => ({ ...d, end, breaks: d.breaks.filter((b) => b.end <= end) }));

  const addBreak = (day: WeekdayNumber) =>
    updateDay(day, (d) => {
      // Default: the first free hour after the last break (or the middle of the day).
      const last = d.breaks[d.breaks.length - 1];
      const from = last ? last.end + SLOT_MINUTES : d.start + Math.floor((d.end - d.start) / 2 / SLOT_MINUTES) * SLOT_MINUTES;
      const start = Math.min(Math.max(from, d.start + STEP_MINUTES), d.end - STEP_MINUTES);
      return { ...d, breaks: [...d.breaks, { start, end: Math.min(start + SLOT_MINUTES, d.end) }] };
    });

  const setBreak = (day: WeekdayNumber, index: number, part: 'start' | 'end', value: number) =>
    updateDay(day, (d) => ({
      ...d,
      breaks: d.breaks.map((b, i) => {
        if (i !== index) return b;
        const next = { ...b, [part]: value };
        if (part === 'start' && next.end <= next.start) next.end = Math.min(next.start + STEP_MINUTES, d.end);
        return next;
      }),
    }));

  const removeBreak = (day: WeekdayNumber, index: number) => updateDay(day, (d) => ({ ...d, breaks: d.breaks.filter((_, i) => i !== index) }));

  const copyToAll = (day: WeekdayNumber) =>
    setDraft((prev) => {
      const source = prev.days[key(day)];
      const days = { ...prev.days };
      for (const w of CONSULTATION_WEEKDAYS) {
        if (w.day !== day && days[key(w.day)].open) days[key(w.day)] = { ...source, breaks: source.breaks.map((b) => ({ ...b })) };
      }
      return { days };
    });

  const handleSave = async () => {
    setError(null);
    const clean = normalizeHours(draft);
    if ('error' in clean) return setError(clean.error);
    const result = await submission.run(async () => {
      try {
        const res = await saveMyConsultationHoursAction(clean.hours);
        if (!res.success) return { ok: false, error: res.error };
        setSaved(res.hours);
        setDraft(clone(res.hours));
        onSaved?.(res.hours);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Your consultation hours could not be saved. Please try again.' };
      }
    });
    if (result && !result.ok) setError(result.error);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className="space-y-3"
    >
      <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512] mb-5">Regular Consultation Hours</h2>
      <div className="neu-raised rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 bg-[#E5D8CB] space-y-5">
        <p className="font-inter text-[11px] sm:text-xs text-[#341512]/70 leading-relaxed">
          Set the days and hours you take consultations, Monday to Saturday. Clients can only book 1-hour slots inside these
          hours, and your breaks are skipped. To block a specific date, use Set Unavailability below.
        </p>

        {loading ? (
          <p className="py-6 text-center font-lora text-xs text-[#341512]/60">Loading your consultation hours…</p>
        ) : (
          <div className="divide-y divide-dotted divide-[#C8B59E]">
            {CONSULTATION_WEEKDAYS.map(({ day, label }) => {
              const d = draft.days[key(day)];
              const slots = d.open ? slotStartsFor(draft, day) : [];
              const labelId = `hours-${day}-label`;
              return (
                <div key={day} className="py-5 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="flex items-center gap-3 min-w-[150px]">
                      <NeuSwitch checked={d.open} disabled={saving} onChange={(open) => setOpen(day, open)} labelledBy={labelId} />
                      <span id={labelId} className="font-lora text-sm sm:text-base font-bold text-[#341512]">
                        {label}
                      </span>
                    </div>
                    {d.open ? (
                      <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[240px]">
                        <div className="w-[132px]">
                          <TimeSelect label={`${label} opening time`} value={d.start} disabled={saving} onChange={(v) => setStart(day, v)} options={TIME_OPTIONS.filter((m) => m <= LATEST_MINUTES - SLOT_MINUTES)} />
                        </div>
                        <span className="font-lora text-sm text-[#341512]/70">to</span>
                        <div className="w-[132px]">
                          <TimeSelect label={`${label} closing time`} value={d.end} disabled={saving} onChange={(v) => setEnd(day, v)} options={TIME_OPTIONS.filter((m) => m >= d.start + SLOT_MINUTES)} />
                        </div>
                      </div>
                    ) : (
                      <span className="font-lora text-sm text-[#341512]/60">Closed — no consultations</span>
                    )}
                    {d.open && (
                      <button type="button" disabled={saving} onClick={() => copyToAll(day)} className={`${linkButtonClass} ml-auto`}>
                        Copy to other open days
                      </button>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {d.open && (
                      <motion.div
                        key="details"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2.5 p-1 sm:pl-[66px]">
                          {d.breaks.map((b, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-3">
                              <span className="font-lora text-[13px] font-medium text-[#341512] w-14">Break</span>
                              <div className="w-[132px]">
                                <TimeSelect label={`${label} break ${i + 1} start`} value={b.start} disabled={saving} onChange={(v) => setBreak(day, i, 'start', v)} options={TIME_OPTIONS.filter((m) => m >= d.start && m < d.end)} />
                              </div>
                              <span className="font-lora text-sm text-[#341512]/70">to</span>
                              <div className="w-[132px]">
                                <TimeSelect label={`${label} break ${i + 1} end`} value={b.end} disabled={saving} onChange={(v) => setBreak(day, i, 'end', v)} options={TIME_OPTIONS.filter((m) => m > b.start && m <= d.end)} />
                              </div>
                              <button type="button" disabled={saving} onClick={() => removeBreak(day, i)} className={`${linkButtonClass} hover:!text-[#B42318]`}>
                                Remove
                              </button>
                            </div>
                          ))}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-inter text-[11px] text-[#341512]/60">
                              {slots.length > 0
                                ? `Bookable slots: ${slots.map((s) => formatClock(s)).join(', ')}`
                                : 'No full 1-hour slot fits these hours.'}
                            </p>
                            {d.breaks.length < MAX_BREAKS && (
                              <button type="button" disabled={saving} onClick={() => addBreak(day)} className={linkButtonClass}>
                                + Add break
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            <div className="pt-5">
              <p className="font-inter text-[11px] text-[#341512]/60">Sunday is not a consultation day.</p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {error && (
            <NeuAlert key="err" tone="error" onDismiss={() => setError(null)}>
              {error}
            </NeuAlert>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {dirty && !saving && (
            <button type="button" onClick={() => saved && setDraft(clone(saved))} className={linkButtonClass}>
              Discard changes
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving || !dirty}
            className="neu-raised-sm !bg-[#D39758]/70 inline-flex items-center gap-2 rounded-xl px-7 py-2.5 text-xs sm:text-sm font-lora font-semibold text-[#341512] cursor-pointer select-none active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Save Consultation Hours
          </button>
        </div>
      </div>

      <SubmissionOverlay
        submission={submission}
        processing={{ title: 'Saving your hours', message: 'Updating the times clients can book.' }}
        success={{ title: 'Consultation hours saved', message: 'New bookings and reschedules follow these hours. Existing bookings stay as they are.' }}
        failure={{ title: "We couldn't save your hours" }}
      />
    </motion.div>
  );
}

export default ConsultationHoursEditor;

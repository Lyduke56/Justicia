'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  addUnavailabilityAction,
  getMyUnavailabilityAction,
  removeUnavailabilityAction,
  type MyUnavailabilityEntry,
} from '@/app/actions/availabilityActions';

/**
 * Lawyer Profile → Availability: block off the date selected on the calendar (whole day or a
 * time range) and list every upcoming unavailable day/time. Blocked times are disabled in the
 * client booking calendar and rejected by the booking server action.
 */

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** 30-minute steps from 6:00 AM to 10:00 PM (minutes from midnight). */
const TIME_OPTIONS = Array.from({ length: (22 - 6) * 2 + 1 }, (_, i) => 6 * 60 + i * 30);

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "2:00 PM - 3:00 PM • PST, GMT+8" → { start, end } in minutes. */
function parseSlot(slot: string): { start: number; end: number } | null {
  const m = [...slot.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (m.length < 2) return null;
  const toMin = (x: RegExpMatchArray) => (Number(x[1]) % 12 + (x[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + (x[2] ? Number(x[2]) : 0);
  const start = toMin(m[0]);
  const end = toMin(m[1]);
  return end > start ? { start, end } : null;
}

function todayManilaIso(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin motion-reduce:animate-none`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative w-full flex items-start gap-3.5 p-4 sm:p-5 rounded-[20px] text-left cursor-pointer select-none transition-all active:translate-y-px ${
        selected ? 'neu-raised-highlight' : 'neu-recessed hover:bg-[#E5D8CB]/40'
      }`}
    >
      <span
        className={`mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-[#341512]' : 'border-[#341512]/60'
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-[#341512]" />}
      </span>
      <span className="space-y-1">
        <span className="block font-lora text-xs sm:text-sm font-bold text-[#341512]">{title}</span>
        <span className="block text-[11px] sm:text-xs text-[#341512]/80 leading-normal font-inter">{description}</span>
      </span>
    </button>
  );
}

const selectClass =
  'w-full rounded-full bg-[#E5D8CB] neu-recessed px-4 py-2.5 text-xs sm:text-[13px] font-lora text-[#341512] focus:outline-none focus:ring-2 focus:ring-[#D39758]/60 cursor-pointer';

export function LawyerUnavailabilityManager({
  selectedDateIso,
  selectedDateLabel,
  selectedSlot,
  onChanged,
  onJumpToDate,
}: {
  /** Date currently selected on the booking calendar (YYYY-MM-DD). */
  selectedDateIso: string;
  selectedDateLabel: string;
  /** Time slot currently selected in "Available Time Slots"; used to prefill the range. */
  selectedSlot: string;
  /** Called after an entry is added/removed so the calendar can refresh its blocked days. */
  onChanged: () => void;
  onJumpToDate: (iso: string) => void;
}) {
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState(14 * 60);
  const [end, setEnd] = useState(15 * 60);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [entries, setEntries] = useState<MyUnavailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Picking a slot in "Available Time Slots" prefills the range (adjusting state during render).
  const [prevSlot, setPrevSlot] = useState(selectedSlot);
  if (selectedSlot !== prevSlot) {
    setPrevSlot(selectedSlot);
    const range = parseSlot(selectedSlot);
    if (range) {
      setStart(range.start);
      setEnd(range.end);
      setAllDay(false);
    }
  }

  const loadEntries = useCallback(async () => {
    const res = await getMyUnavailabilityAction();
    if (res.success) {
      setEntries(res.entries);
      setListError(null);
    } else {
      setListError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    getMyUnavailabilityAction().then((res) => {
      if (!active) return;
      if (res.success) setEntries(res.entries);
      else setListError(res.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const isPastDate = selectedDateIso < todayManilaIso();
  const dayEntries = entries.filter((e) => e.date === selectedDateIso);

  const handleAdd = async () => {
    setError(null);
    setNotice(null);
    if (isPastDate) return setError('Choose today or a future date on the calendar.');
    if (!allDay && end <= start) return setError('The end time must be after the start time.');
    setSaving(true);
    try {
      const res = await addUnavailabilityAction({
        date: selectedDateIso,
        allDay,
        startMinutes: allDay ? null : start,
        endMinutes: allDay ? null : end,
        reason,
      });
      if (!res.success) return setError(res.error);
      setReason('');
      setNotice(
        allDay
          ? `${selectedDateLabel} is now marked as unavailable.`
          : `${formatClock(start)} – ${formatClock(end)} on ${selectedDateLabel} is now unavailable.`
      );
      await loadEntries();
      onChanged();
    } catch {
      setError('Unable to save your unavailability. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setListError(null);
    try {
      const res = await removeUnavailabilityAction(id);
      if (!res.success) return setListError(res.error);
      setConfirmRemoveId(null);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      onChanged();
    } catch {
      setListError('Unable to remove this entry. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* ─── Set Unavailability ─── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="space-y-3"
      >
        <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512] mb-5">Set Unavailability</h2>
        <div className="neu-raised rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 bg-[#E5D8CB] space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-lora text-sm sm:text-base text-[#341512]">
              Selected date: <span className="font-bold">{selectedDateLabel}</span>
            </p>
            <p className="font-inter text-[11px] text-[#341512]/60">Pick a date on the calendar above to change it.</p>
          </div>

          {dayEntries.length > 0 && (
            <p className="font-inter text-[11px] sm:text-xs text-rose-900/80">
              Already unavailable on this date: {dayEntries.map((e) => (e.startMinutes === null ? 'Entire day' : `${formatClock(e.startMinutes)} – ${formatClock(e.endMinutes!)}`)).join(', ')}
            </p>
          )}

          <div role="radiogroup" aria-label="Unavailability type" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OptionCard
              selected={allDay}
              onSelect={() => setAllDay(true)}
              title="Entire Day"
              description="Clients won't be able to book any time slot on this date."
            />
            <OptionCard
              selected={!allDay}
              onSelect={() => setAllDay(false)}
              title="Specific Time Range"
              description="Block only part of the day. Tip: pick a slot under Available Time Slots to prefill it."
            />
          </div>

          <AnimatePresence initial={false}>
            {!allDay && (
              <motion.div
                key="range"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-1">
                  <label className="space-y-1.5">
                    <span className="block font-lora text-sm font-medium text-[#341512]">From:</span>
                    <select value={start} onChange={(e) => setStart(Number(e.target.value))} className={selectClass}>
                      {TIME_OPTIONS.slice(0, -1).map((m) => (
                        <option key={m} value={m}>{formatClock(m)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="block font-lora text-sm font-medium text-[#341512]">To:</span>
                    <select value={end} onChange={(e) => setEnd(Number(e.target.value))} className={selectClass}>
                      {TIME_OPTIONS.slice(1).map((m) => (
                        <option key={m} value={m} disabled={m <= start}>{formatClock(m)}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <label className="block space-y-1.5">
            <span className="block font-lora text-sm font-medium text-[#341512]">Note (optional, only visible to you):</span>
            <input
              type="text"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Court hearing, personal leave"
              className="select-text w-full rounded-full bg-[#E5D8CB] neu-recessed px-4 py-2.5 text-xs sm:text-[13px] font-lora text-[#341512] placeholder:text-[#341512]/40 focus:outline-none focus:ring-2 focus:ring-[#D39758]/60"
            />
          </label>

          <AnimatePresence initial={false}>
            {(error || notice) && (
              <motion.p
                key={error ? 'err' : 'ok'}
                role={error ? 'alert' : 'status'}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`overflow-hidden rounded-2xl px-4 py-3 text-xs sm:text-sm ${
                  error ? 'bg-rose-100/80 border border-rose-300 text-rose-900' : 'bg-amber-100/90 border border-amber-300 text-amber-900'
                }`}
              >
                {error || notice}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || isPastDate}
              className="neu-raised-sm !bg-[#D39758]/70 inline-flex items-center gap-2 rounded-xl px-7 py-2.5 text-xs sm:text-sm font-lora font-semibold text-[#341512] cursor-pointer select-none active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving && <Spinner />}
              {saving ? 'Saving…' : isPastDate ? 'Date has passed' : 'Mark as Unavailable'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── List of all unavailable days / times ─── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.05, ease: EASE_OUT }}
        className="space-y-3 pb-6"
      >
        <div className="flex items-baseline justify-between gap-3 mb-5">
          <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]">Unavailable Dates &amp; Times</h2>
          <span className="neu-raised-sm bg-[#E5D8CB] px-3 py-0.5 rounded-full font-lora text-xs font-semibold text-[#D39758]">
            {entries.length}
          </span>
        </div>
        <div className="neu-recessed rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 space-y-3">
          {listError && (
            <p role="alert" className="rounded-2xl px-4 py-3 text-xs sm:text-sm bg-rose-100/80 border border-rose-300 text-rose-900">
              {listError}
            </p>
          )}
          {loading ? (
            <p className="py-6 text-center font-lora text-xs text-[#341512]/60">Loading your unavailable dates…</p>
          ) : entries.length === 0 && !listError ? (
            <p className="py-6 text-center font-lora text-xs sm:text-sm text-[#341512]/70">
              You&apos;re available on all upcoming dates. Blocked days and times will appear here.
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {entries.map((entry) => {
                const confirming = confirmRemoveId === entry.id;
                const removing = removingId === entry.id;
                return (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className={`neu-raised-sm rounded-[18px] bg-[#E5D8CB] p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                      entry.date === selectedDateIso ? 'ring-1 ring-[#C58B3C]/45' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-lora text-sm font-bold text-[#341512] leading-snug">{entry.label}</p>
                      {entry.reason && <p className="font-inter text-[11px] text-[#341512]/65 mt-0.5 truncate">{entry.reason}</p>}
                    </div>
                    {confirming ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-inter text-rose-900">Make available again?</span>
                        <button
                          type="button"
                          disabled={removing}
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded-[10px] px-3 py-1.5 text-[11px] font-semibold font-inter text-[#341512]/80 hover:bg-[#D39758]/15 transition cursor-pointer"
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          disabled={removing}
                          onClick={() => handleRemove(entry.id)}
                          className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-bold font-inter text-white bg-rose-800 hover:bg-rose-900 disabled:opacity-50 transition cursor-pointer"
                        >
                          {removing && <Spinner className="w-3 h-3" />} Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onJumpToDate(entry.date)}
                          className="rounded-[10px] px-3 py-1.5 text-[11px] font-semibold font-inter text-[#341512]/80 hover:text-[#341512] hover:bg-[#D39758]/15 transition cursor-pointer"
                        >
                          View on calendar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(entry.id)}
                          className="rounded-[10px] px-3 py-1.5 text-[11px] font-semibold font-inter text-[#341512]/80 hover:text-rose-800 hover:bg-[#D39758]/15 transition cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default LawyerUnavailabilityManager;

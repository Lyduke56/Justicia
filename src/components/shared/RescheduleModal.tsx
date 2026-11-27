'use client';

/**
 * Reschedule dialogs for confirmed appointments (client and lawyer portals), built on the shared
 * neumorphic modal frame so they match the rest of the consultation booking flow. Sending morphs
 * the dialog into the submission loader, which then writes a check or an X (SubmitModal).
 *  - request:  pick a new date + time slot (both calendars are checked server-side) and a reason
 *  - respond:  accept or decline the other party's proposal (optional reason when declining)
 *  - withdraw: cancel your own open request
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getRescheduleOptionsAction,
  requestRescheduleAction,
  respondToRescheduleAction,
  withdrawRescheduleAction,
  type RescheduleInfo,
  type RescheduleOptions,
} from '@/app/actions/consultationActions';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { PanelLoader } from '@/components/shared/loading';
import { SubmitModal, settle, useSubmission, type SubmissionResult, type SubmissionState } from '@/components/shared/feedback';
import {
  NeuButton,
  NeuAlert,
  EmptyState,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownIcon,
  SendIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@/components/shared/neu';

export type RescheduleModalMode = 'request' | 'respond' | 'withdraw';

interface RescheduleModalProps {
  mode: RescheduleModalMode;
  consultationId: string;
  /** The other participant, e.g. "Atty. Maria Santos" or the client's name. */
  counterpartName: string;
  /** Current schedule, e.g. "Thursday, November 26, 2026 · 2:00 PM - 3:00 PM". */
  currentLabel: string;
  /** Current start (ISO), used to open the calendar on the right month. */
  currentStart: string | null;
  pending: RescheduleInfo['pending'];
  remaining: number;
  onClose: () => void;
  /** Called after a successful change so the caller can refresh. */
  onDone: (message: string) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const REASON_MIN = 5;
const REASON_MAX = 500;
const pad = (n: number) => String(n).padStart(2, '0');

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const GRID_SLIDE: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 30 }),
  center: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 340, damping: 32 } },
  exit: (d: number) => ({ opacity: 0, x: -d * 30, transition: { duration: 0.14 } }),
};
const TITLE_SWAP: Variants = {
  enter: (d: number) => ({ opacity: 0, y: d * 10 }),
  center: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: (d: number) => ({ opacity: 0, y: -d * 10, transition: { duration: 0.14 } }),
};
const SLOT_LIST: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};
const SLOT_ITEM: Variants = {
  hidden: { opacity: 0, x: 14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } },
};

/** Today's date in Asia/Manila as YYYY-MM-DD. */
function manilaToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function monthOf(iso: string): { year: number; month: number } {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 };
}

function dayIso(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return `${weekday}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

export function RescheduleModal(props: RescheduleModalProps) {
  const { mode, pending, onClose, onDone } = props;
  const submission = useSubmission();
  const [doneMessage, setDoneMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Sends the request; the dialog morphs into the loader, then the check or the X. */
  const send = (call: () => Promise<unknown>, fallback: string, message: string) => {
    setDoneMessage(message);
    setError(null);
    return submission.run(() => settle(call, fallback));
  };
  /** Closing after a success hands the confirmation to the caller (which refreshes). */
  const finish = () => (submission.phase === 'success' ? onDone(doneMessage) : onClose());
  const shared = { ...props, submitting: submission.processing, submission, send, finish, error, setError };

  if (mode === 'request') return <RequestStep {...shared} />;
  if (mode === 'respond' && pending) return <RespondStep {...shared} pending={pending} />;
  if (mode === 'withdraw' && pending) return <WithdrawStep {...shared} pending={pending} />;
  return null;
}

type StepProps = RescheduleModalProps & {
  submitting: boolean;
  submission: SubmissionState;
  send: (call: () => Promise<unknown>, fallback: string, message: string) => Promise<SubmissionResult | null>;
  finish: () => void;
  /** Errors other than the submission's own (e.g. loading the free time slots). */
  error: string | null;
  setError: (v: string | null) => void;
};

const labelClass = 'block font-lora text-[11px] font-bold uppercase tracking-[0.14em] text-[#946525]';

// ─── Request: choose a new date & time ─────────────────────────────────────

function RequestStep({
  consultationId,
  counterpartName,
  currentLabel,
  currentStart,
  remaining,
  submitting,
  submission,
  send,
  finish,
  error,
  setError,
  onClose,
}: StepProps) {
  const today = manilaToday();
  // Open on the current appointment's month (or today, if that month has already begun).
  const [initialIso] = useState(() => {
    const currentIso = currentStart ? new Date(new Date(currentStart).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10) : today;
    const firstOfMonth = `${currentIso.slice(0, 7)}-01`;
    return firstOfMonth > today ? firstOfMonth : today;
  });
  const [view, setView] = useState(() => monthOf(initialIso));
  const [monthDir, setMonthDir] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialIso);
  const [options, setOptions] = useState<RescheduleOptions | null>(null);
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null);
  const [blockedDays, setBlockedDays] = useState<{ key: string; days: number[] }>({ key: '', days: [] });
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slot, setSlot] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const requestSeq = useRef(0);

  const fetchOptions = useCallback(
    async (iso: string, seq: number) => {
      try {
        const res = await getRescheduleOptionsAction(consultationId, iso);
        if (seq !== requestSeq.current) return;
        if (!('options' in res) || !res.options) {
          setOptions(null);
          setError(('error' in res && res.error) || 'Available times could not be loaded.');
          return;
        }
        setOptions(res.options);
        setBounds({ min: res.options.minDate, max: res.options.maxDate });
        setBlockedDays({ key: iso.slice(0, 7), days: res.options.blockedDays });
      } catch {
        if (seq === requestSeq.current) setError('Available times could not be loaded. Please try again.');
      } finally {
        if (seq === requestSeq.current) setLoadingSlots(false);
      }
    },
    [consultationId, setError]
  );

  /** Selects a date and loads its slots. */
  const loadDate = (iso: string) => {
    const seq = ++requestSeq.current;
    setSelectedDate(iso);
    setSlot(null);
    setLoadingSlots(true);
    setError(null);
    void fetchOptions(iso, seq);
  };

  useEffect(() => {
    const seq = ++requestSeq.current;
    void fetchOptions(initialIso, seq);
  }, [fetchOptions, initialIso]);

  /** First selectable day of a month (respecting the earliest / latest allowed dates). */
  const firstSelectable = (year: number, month: number) => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const min = bounds?.min ?? today;
    for (let d = 1; d <= lastDay; d++) {
      const iso = dayIso(year, month, d);
      if (iso >= min && (!bounds || iso <= bounds.max)) return iso;
    }
    return null;
  };

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
    const total = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
    return [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)] as Array<number | null>;
  }, [view]);

  const monthKey = `${view.year}-${pad(view.month + 1)}`;
  const minMonth = (bounds?.min ?? today).slice(0, 7);
  const maxMonth = bounds?.max.slice(0, 7) ?? '9999-12';
  const changeMonth = (delta: number) => {
    setMonthDir(delta > 0 ? 1 : -1);
    const d = new Date(Date.UTC(view.year, view.month + delta, 1));
    const next = { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    setView(next);
    const iso = firstSelectable(next.year, next.month);
    if (iso) loadDate(iso);
  };

  const chosen = options?.slots.find((s) => s.startMinutes === slot) ?? null;
  const reasonLength = reason.trim().length;
  const valid = !!selectedDate && !!chosen && chosen.state === 'available' && reasonLength >= REASON_MIN;
  const noOpenSlots = !!options && !loadingSlots && options.slots.every((s) => s.state !== 'available');

  const submit = async () => {
    if (!valid || !selectedDate || slot === null) return;
    const date = selectedDate;
    const result = await send(
      () => requestRescheduleAction(consultationId, { date, startMinutes: slot, reason: reason.trim() }),
      'Your request could not be sent. Please try again.',
      `Reschedule request sent to ${counterpartName}.`
    );
    // The slot may have been taken in the meantime: refresh the day's times.
    if (result && !result.ok) loadDate(date);
  };

  const newLabel = selectedDate && chosen ? `${longDate(selectedDate)} · ${chosen.label.replace(' • PST, GMT+8', '')}` : null;

  return (
    <SubmitModal
      submission={submission}
      onClose={finish}
      processing={{ title: 'Sending your request', message: `Asking ${counterpartName} to move the consultation.` }}
      success={{
        title: 'Request sent',
        message: `${counterpartName} will be asked to accept the new time. The current schedule stays until they do.`,
      }}
      failure={{ title: "We couldn't send your request", retryLabel: 'Review Request' }}
      details={newLabel ? <SchedulePill label={newLabel} /> : undefined}
      waitingAfterSuccess
      size="2xl"
      bodyClassName="space-y-8 sm:space-y-9"
      icon={<CalendarClockIcon className="w-5 h-5" />}
      title="Reschedule Consultation"
      subtitle={
        <>
          Pick a new date and time. <strong className="font-semibold text-[#341512]">{counterpartName}</strong> will be asked to
          accept it. Your payment and Google Meet link stay the same.
        </>
      }
      footerStart={
        remaining < 2 ? (
          <>
            {remaining} reschedule{remaining === 1 ? '' : 's'} left for this booking
          </>
        ) : undefined
      }
      footer={
        <>
          <NeuButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </NeuButton>
          <NeuButton variant="primary" onClick={submit} disabled={!valid || submitting} icon={<SendIcon className="w-4 h-4" />}>
            Send Request
          </NeuButton>
        </>
      }
    >
      {/* Current → new schedule, updated live as the user picks */}
      <ScheduleChange from={currentLabel} to={newLabel} toPlaceholder="Choose a date and time below" />

      <div className="grid gap-8 lg:gap-10 lg:grid-cols-[1.1fr_1fr] items-start">
        {/* Calendar */}
        <section aria-label="Choose a date" className="neu-raised bg-[#E5D8CB] rounded-[26px] p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
            <div className="leading-none overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false} custom={monthDir}>
                <motion.div key={monthKey} custom={monthDir} variants={TITLE_SWAP} initial="enter" animate="center" exit="exit">
                  <p className="font-lora text-lg font-bold text-[#341512]">{MONTHS[view.month]}</p>
                  <p className="font-lora text-[11px] font-bold tracking-[0.2em] text-[#C58B3C] mt-1">{view.year}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                disabled={monthKey <= minMonth || submitting}
                aria-label="Previous month"
                className="neu-raised-sm size-9 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] active:scale-95 transition-all disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                disabled={monthKey >= maxMonth || submitting}
                aria-label="Next month"
                className="neu-raised-sm size-9 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] active:scale-95 transition-all disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="neu-recessed rounded-[20px] px-3 sm:px-4 py-4 sm:py-5 overflow-hidden">
            <div className="grid grid-cols-7 text-center font-inter text-[10.5px] font-semibold uppercase text-[#9E8E7D] pb-3">
              {WEEKDAY_INITIALS.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <AnimatePresence mode="popLayout" initial={false} custom={monthDir}>
            <motion.div
              key={monthKey}
              custom={monthDir}
              variants={GRID_SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              className="grid grid-cols-7 gap-y-2.5 text-center"
            >
              {cells.map((day, idx) => {
                if (!day) return <span key={`e-${idx}`} className="h-9" />;
                const iso = dayIso(view.year, view.month, day);
                const outOfRange = iso < (bounds?.min ?? today) || (!!bounds && iso > bounds.max);
                const blocked = blockedDays.key === monthKey && blockedDays.days.includes(day);
                const disabled = outOfRange || blocked || submitting;
                const selected = iso === selectedDate;
                const isToday = iso === today;
                return (
                  <motion.button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => loadDate(iso)}
                    whileHover={disabled || selected ? undefined : { scale: 1.12 }}
                    whileTap={disabled ? undefined : { scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    aria-pressed={selected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${longDate(iso)}${blocked ? ' (attorney unavailable)' : ''}`}
                    title={blocked ? 'Attorney unavailable' : undefined}
                    className={`relative mx-auto size-9 rounded-full flex items-center justify-center font-inter text-[12.5px] transition-colors select-none ${selected
                      ? 'font-bold text-[#341512]'
                      : disabled
                        ? 'text-[#B5A391] line-through decoration-[#C8B59E] cursor-not-allowed'
                        : 'text-[#341512] hover:bg-[#D39758]/18 cursor-pointer'
                      } ${isToday ? 'outline-[1.5px] outline-solid outline-[#C58B3C] outline-offset-2' : ''}`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="reschedule-selected-day"
                        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                        className="absolute inset-0 rounded-full neu-btn-caramel"
                      />
                    )}
                    <span className="relative">{day}</span>
                  </motion.button>
                );
              })}
            </motion.div>
            </AnimatePresence>
          </div>
          <p className="pt-4 font-inter text-[11px] text-[#7D6855] text-center">Crossed-out days are unavailable.</p>
        </section>

        {/* Time slots */}
        <section aria-label="Choose a time" className="flex flex-col gap-4 sm:gap-5 lg:pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className={labelClass}>{selectedDate ? longDate(selectedDate) : 'Choose a date'}</p>
            <span className="font-inter text-[10.5px] text-[#7D6855] shrink-0">PST (GMT+8)</span>
          </div>
          <div className="flex flex-col gap-3.5" aria-busy={loadingSlots}>
            {loadingSlots || !options ? (
              <PanelLoader srLabel="Loading open times" />
            ) : noOpenSlots ? (
              <div className="neu-recessed rounded-[20px]">
                <EmptyState
                  size="sm"
                  icon={<ClockIcon />}
                  title="No open times this day"
                  description="Every slot is booked or unavailable. Try another date on the calendar."
                />
              </div>
            ) : (
              <motion.div key={selectedDate ?? 'none'} variants={SLOT_LIST} initial="hidden" animate="show" className="flex flex-col gap-3.5">
              {options.slots.map((s) => {
                const selectable = s.state === 'available';
                const isChosen = slot === s.startMinutes;
                const tag =
                  s.state === 'current' ? 'Current' : s.state === 'booked' ? 'Booked' : s.state === 'unavailable' ? 'Unavailable' : s.state === 'past' ? 'Too soon' : null;
                return (
                  <motion.button
                    key={s.startMinutes}
                    type="button"
                    variants={SLOT_ITEM}
                    whileHover={selectable && !isChosen ? { x: 3 } : undefined}
                    whileTap={selectable ? { scale: 0.98 } : undefined}
                    disabled={!selectable || submitting}
                    onClick={() => setSlot(s.startMinutes)}
                    aria-pressed={isChosen}
                    className={`h-12 w-full rounded-2xl px-5 flex items-center justify-between gap-3 font-inter text-xs sm:text-[13px] transition-all select-none ${isChosen
                      ? 'neu-btn-caramel font-bold text-[#341512]'
                      : selectable
                        ? 'neu-raised-sm bg-[#E5D8CB] font-semibold text-[#3E2A1E] hover:text-[#A8742E] active:scale-[0.99] cursor-pointer'
                        : 'neu-recessed text-[#A08E7C] cursor-not-allowed'
                      }`}
                  >
                    <span className={`flex items-center gap-2.5 ${selectable ? '' : 'line-through decoration-[#C8B59E]'}`}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={isChosen ? 'check' : 'clock'}
                          initial={{ scale: 0.4, opacity: 0, rotate: isChosen ? -30 : 0 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                          className="flex"
                        >
                          {isChosen ? <CheckCircleIcon className="w-4 h-4" /> : <ClockIcon className="w-4 h-4 opacity-70" />}
                        </motion.span>
                      </AnimatePresence>
                      {s.label.replace(' • PST, GMT+8', '')}
                    </span>
                    {tag && <span className="text-[10px] font-bold uppercase tracking-wider">{tag}</span>}
                  </motion.button>
                );
              })}
              </motion.div>
            )}
          </div>
        </section>
      </div>

      {/* Reason */}
      <div className="space-y-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="reschedule-reason" className={labelClass}>
            Reason for rescheduling
          </label>
          <span className={`font-inter text-[10.5px] ${reasonLength > 0 && reasonLength < REASON_MIN ? 'text-[#B42318]' : 'text-[#7D6855]'}`}>
            {reasonLength > 0 && reasonLength < REASON_MIN ? `At least ${REASON_MIN} characters · ` : ''}
            {reason.length}/{REASON_MAX}
          </span>
        </div>
        <textarea
          id="reschedule-reason"
          rows={4}
          maxLength={REASON_MAX}
          value={reason}
          disabled={submitting}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`Let ${counterpartName} know why you need to move this consultation.`}
          className="neu-input w-full rounded-[20px] py-4 px-5 font-inter text-xs sm:text-sm text-[#23150F] leading-relaxed resize-y"
        />
      </div>

      {error && <NeuAlert tone="error">{error}</NeuAlert>}
    </SubmitModal>
  );
}

/** The new date and time, as a pill under the result. */
function SchedulePill({ label }: { label: string }) {
  return <span className="neu-raised-pill bg-[#E5D8CB] rounded-full px-4 py-1.5 font-lora text-[10.5px] font-bold text-[#5C4535]">{label}</span>;
}

// ─── Shared: "from → to" schedule card ──────────────────────────────────────

function ScheduleChange({ from, to, toPlaceholder }: { from?: string; to: string | null; toPlaceholder?: string }) {
  return (
    <div className="neu-raised bg-[#E5D8CB] rounded-[24px] px-5 py-5 sm:px-7 sm:py-6">
      {from && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
            <span className="w-28 shrink-0 font-lora text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#7D6855]">Current</span>
            <span className={`font-inter text-xs sm:text-[13px] text-[#5C4535] ${to ? 'line-through decoration-[#B5A391]' : ''}`}>{from}</span>
          </div>
          <div className="flex sm:pl-28 py-3 text-[#C58B3C]" aria-hidden="true">
            <motion.span
              className="sm:ml-4 flex"
              key={to ?? 'idle'}
              initial={{ y: -4, opacity: 0.4 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            >
              <ArrowDownIcon className="w-4 h-4" />
            </motion.span>
          </div>
        </>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
        <span className="w-28 shrink-0 font-lora text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#946525]">
          {from ? 'New' : 'Proposed'}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={to ?? 'placeholder'}
            initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className={`font-inter text-xs sm:text-[13px] ${to ? 'font-semibold text-[#341512]' : 'italic text-[#9E8E7D]'}`}
          >
            {to ?? toPlaceholder}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReasonQuote({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-3.5">
      <p className={labelClass}>{label}</p>
      <blockquote className="neu-recessed rounded-[20px] px-5 py-4 sm:px-6 sm:py-5 font-inter text-xs sm:text-[13px] leading-relaxed text-[#3E2A1E] whitespace-pre-line">
        {text}
      </blockquote>
    </div>
  );
}

// ─── Respond: accept / decline the other party's proposal ─────────────────

function RespondStep({
  consultationId,
  counterpartName,
  currentLabel,
  pending,
  submitting,
  submission,
  send,
  finish,
  error,
  setError,
}: StepProps & { pending: NonNullable<RescheduleInfo['pending']> }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [answered, setAnswered] = useState<'accept' | 'decline'>('accept');
  const proposed = `${pending.proposedDateLong} · ${pending.proposedTimeRange}`;

  const answer = (response: 'accept' | 'decline') => {
    setAnswered(response);
    void send(
      () => respondToRescheduleAction(consultationId, response, response === 'decline' ? note.trim() : undefined),
      'Your answer could not be saved. Please try again.',
      response === 'accept'
        ? `The consultation was moved to ${pending.proposedDateLong}, ${pending.proposedTimeRange}.`
        : 'The request was declined. The original schedule stays.'
    );
  };

  return (
    <SubmitModal
      submission={submission}
      onClose={finish}
      processing={
        answered === 'accept'
          ? { title: 'Moving the consultation', message: `Saving the new time with ${counterpartName}.` }
          : { title: 'Declining the request', message: `Letting ${counterpartName} know.` }
      }
      success={
        answered === 'accept'
          ? { title: 'Consultation moved', message: `The new time replaces the old one for you and ${counterpartName}.` }
          : { title: 'Request declined', message: `${counterpartName} will be notified. The original schedule stays.` }
      }
      failure={{ title: "We couldn't save your answer" }}
      details={answered === 'accept' ? <SchedulePill label={proposed} /> : undefined}
      size="lg"
      bodyClassName="space-y-7 sm:space-y-8"
      icon={<CalendarClockIcon className="w-5 h-5" />}
      title="Reschedule Request"
      subtitle={
        <>
          <strong className="font-semibold text-[#341512]">{counterpartName}</strong> asked to move your confirmed consultation. If you
          accept, the new time replaces the current one for both of you. The payment and Google Meet link stay the same.
        </>
      }
      footer={
        declining ? (
          <>
            <NeuButton variant="secondary" onClick={() => setDeclining(false)} disabled={submitting}>
              Back
            </NeuButton>
            <NeuButton variant="danger" onClick={() => answer('decline')} disabled={submitting}>
              Decline Request
            </NeuButton>
          </>
        ) : (
          <>
            <NeuButton
              variant="secondary"
              onClick={() => {
                setError(null);
                setDeclining(true);
              }}
              disabled={submitting}
            >
              Decline
            </NeuButton>
            <NeuButton variant="primary" onClick={() => answer('accept')} disabled={submitting} icon={<CheckCircleIcon className="w-4 h-4" />}>
              Accept New Time
            </NeuButton>
          </>
        )
      }
    >
      <ScheduleChange from={currentLabel} to={proposed} />
      <ReasonQuote label={`Reason from ${counterpartName}`} text={pending.reason} />

      {declining && (
        <div className="space-y-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="reschedule-decline-note" className={labelClass}>
              Reason for declining <span className="normal-case tracking-normal font-normal text-[#7D6855]">(optional)</span>
            </label>
            <span className="font-inter text-[10.5px] text-[#7D6855]">
              {note.length}/{REASON_MAX}
            </span>
          </div>
          <textarea
            id="reschedule-decline-note"
            rows={3}
            maxLength={REASON_MAX}
            autoFocus
            value={note}
            disabled={submitting}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I am not available then. Could we try another day?"
            className="neu-input w-full rounded-[20px] py-4 px-5 font-inter text-xs sm:text-sm text-[#23150F] leading-relaxed resize-y"
          />
        </div>
      )}

      {error && <NeuAlert tone="error">{error}</NeuAlert>}
    </SubmitModal>
  );
}

// ─── Withdraw your own request ─────────────────────────────────────────────

function WithdrawStep({
  consultationId,
  counterpartName,
  pending,
  submitting,
  submission,
  send,
  finish,
  error,
  onClose,
}: StepProps & { pending: NonNullable<RescheduleInfo['pending']> }) {
  const withdraw = () =>
    void send(
      () => withdrawRescheduleAction(consultationId),
      'The request could not be withdrawn. Please try again.',
      'Your reschedule request was withdrawn. The original schedule stays.'
    );

  return (
    <SubmitModal
      submission={submission}
      onClose={finish}
      processing={{ title: 'Withdrawing your request', message: `Letting ${counterpartName} know.` }}
      success={{ title: 'Request withdrawn', message: 'The original schedule stays.' }}
      failure={{ title: "We couldn't withdraw your request" }}
      size="md"
      bodyClassName="space-y-7 sm:space-y-8"
      icon={<CalendarClockIcon className="w-5 h-5" />}
      iconTone="danger"
      title="Withdraw Request?"
      subtitle={
        <>
          You asked <strong className="font-semibold text-[#341512]">{counterpartName}</strong> to move this consultation.
          Withdrawing keeps the original schedule.
        </>
      }
      footer={
        <>
          <NeuButton variant="secondary" onClick={onClose} disabled={submitting}>
            Keep Request
          </NeuButton>
          <NeuButton variant="danger" onClick={withdraw} disabled={submitting}>
            Withdraw Request
          </NeuButton>
        </>
      }
    >
      <ScheduleChange to={`${pending.proposedDateLong} · ${pending.proposedTimeRange}`} />
      <ReasonQuote label="Your reason" text={pending.reason} />
      {error && <NeuAlert tone="error">{error}</NeuAlert>}
    </SubmitModal>
  );
}

export default RescheduleModal;

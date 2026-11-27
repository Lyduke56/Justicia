'use client';

/**
 * Reschedule dialogs for confirmed appointments (client and lawyer portals), built on the shared
 * neumorphic modal frame so they match the rest of the consultation booking flow. Sending morphs
 * the dialog into the submission loader, which then writes a check or an X (SubmitModal).
 *  - request:  pick a new date + time slot (both calendars are checked server-side) and a reason
 *  - respond:  accept or decline the other party's proposal (optional reason when declining)
 *  - withdraw: cancel your own open request
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRescheduleOptionsAction,
  requestRescheduleAction,
  respondToRescheduleAction,
  withdrawRescheduleAction,
  type RescheduleInfo,
  type RescheduleOptions,
} from '@/app/actions/consultationActions';
import { AnimatePresence, motion } from 'motion/react';
import { PanelLoader } from '@/components/shared/loading';
import { ScheduleCalendar, ScheduleSlotList } from '@/components/shared/ScheduleCalendar';
import { SubmitModal, settle, useSubmission, type SubmissionResult, type SubmissionState } from '@/components/shared/feedback';
import {
  NeuButton,
  NeuAlert,
  EmptyState,
  CalendarClockIcon,
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
const REASON_MIN = 5;
const REASON_MAX = 500;
const pad = (n: number) => String(n).padStart(2, '0');

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

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

/**
 * The calendar and time slots look like the Consultation Booking calendar (ScheduleCalendar),
 * with the same day indicators: a dot on days that already have bookings (either calendar),
 * crossed out when no time is free (not a consultation day, fully booked, blocked or too soon).
 */
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
  const [dayDir, setDayDir] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialIso);
  const [options, setOptions] = useState<RescheduleOptions | null>(null);
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null);
  /** Day indicators of the last month loaded (from getRescheduleOptionsAction). */
  const [monthDays, setMonthDays] = useState<{ key: string; days: RescheduleOptions['days']; blocked: number[] }>({
    key: '',
    days: [],
    blocked: [],
  });
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slot, setSlot] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const requestSeq = useRef(0);

  const fetchOptions = useCallback(
    async function run(iso: string, seq: number, skipClosed = true): Promise<void> {
      try {
        const res = await getRescheduleOptionsAction(consultationId, iso);
        if (seq !== requestSeq.current) return;
        if (!('options' in res) || !res.options) {
          setOptions(null);
          setError(('error' in res && res.error) || 'Available times could not be loaded.');
          return;
        }
        // The chosen day has no free time (e.g. the 1st of the month is a Sunday): move on to the
        // next day of that month that has some.
        const o = res.options;
        const prefix = iso.slice(0, 8);
        const open = (d: number) => {
          const di = `${prefix}${pad(d)}`;
          if (di < o.minDate || di > o.maxDate || o.blockedDays.includes(d)) return false;
          const mark = o.days?.find((m) => m.day === d);
          return !mark || mark.state === 'open';
        };
        const day = Number(iso.slice(8, 10));
        if (skipClosed && !open(day)) {
          const last = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();
          for (let d = day + 1; d <= last; d++) {
            if (open(d)) {
              setSelectedDate(`${prefix}${pad(d)}`);
              setDayDir(1);
              return run(`${prefix}${pad(d)}`, seq, false);
            }
          }
        }
        setOptions(res.options);
        setBounds({ min: res.options.minDate, max: res.options.maxDate });
        setMonthDays({ key: iso.slice(0, 7), days: res.options.days ?? [], blocked: res.options.blockedDays });
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
    if (selectedDate) setDayDir(iso >= selectedDate ? 1 : -1);
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

  const monthKey = `${view.year}-${pad(view.month + 1)}`;
  const marks = monthDays.key === monthKey ? monthDays : null;
  const minIso = bounds?.min ?? today;
  const outOfRange = (iso: string) => iso < minIso || (!!bounds && iso > bounds.max);
  const markOf = (day: number) => marks?.days.find((m) => m.day === day) ?? null;
  const dayOpen = (day: number) => {
    const iso = dayIso(view.year, view.month, day);
    if (outOfRange(iso) || marks?.blocked.includes(day)) return false;
    const mark = markOf(day);
    return !mark || mark.state === 'open';
  };

  /** First selectable day of a month (respecting the earliest / latest allowed dates). */
  const firstSelectable = (year: number, month: number) => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let d = 1; d <= lastDay; d++) {
      const iso = dayIso(year, month, d);
      if (iso >= minIso && (!bounds || iso <= bounds.max)) return iso;
    }
    return null;
  };

  const minMonth = minIso.slice(0, 7);
  const maxMonth = bounds?.max.slice(0, 7) ?? '9999-12';
  const changeMonth = (delta: number) => {
    setMonthDir(delta > 0 ? 1 : -1);
    const d = new Date(Date.UTC(view.year, view.month + delta, 1));
    const next = { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    setView(next);
    const iso = firstSelectable(next.year, next.month);
    if (iso) loadDate(iso);
  };
  const jumpToToday = () => {
    const target = monthOf(today);
    const delta = target.year * 12 + target.month - (view.year * 12 + view.month);
    if (delta !== 0) setMonthDir(delta > 0 ? 1 : -1);
    setView(target);
    loadDate(firstSelectable(target.year, target.month) ?? today);
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
  const selectedInView = selectedDate && selectedDate.slice(0, 7) === monthKey ? Number(selectedDate.slice(8, 10)) : null;
  const slotTag = (state: RescheduleOptions['slots'][number]['state']) =>
    state === 'current' ? 'Current' : state === 'booked' ? 'Booked' : state === 'unavailable' ? 'Unavailable' : state === 'past' ? 'Too soon' : null;
  const dayTitle = (day: number): string | undefined => {
    const iso = dayIso(view.year, view.month, day);
    const mark = markOf(day);
    if (iso < minIso) return 'Too soon to move to';
    if (bounds && iso > bounds.max) return 'Too far ahead';
    if (marks?.blocked.includes(day)) return 'Attorney unavailable';
    if (mark && mark.state !== 'open') return mark.reason ?? 'Not available';
    if (mark && mark.bookings > 0) return `${mark.bookings} booking${mark.bookings === 1 ? '' : 's'} on this day`;
    return undefined;
  };

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
          accept it. Your payment stays the same, and the call moves to the new time.
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

      {/* Calendar & time slots, laid out like Consultation Booking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        <section aria-label="Choose a date" className="lg:col-span-8 flex">
          <ScheduleCalendar
            className="w-full"
            year={view.year}
            month={view.month}
            selectedDay={selectedInView}
            fallbackDay={1}
            todayIso={today}
            layoutId="reschedule-selected-day"
            monthDir={monthDir}
            dayDir={dayDir}
            disabled={submitting}
            canPrev={monthKey > minMonth}
            canNext={monthKey < maxMonth}
            onPrevMonth={() => changeMonth(-1)}
            onNextMonth={() => changeMonth(1)}
            onToday={jumpToToday}
            onSelectDay={(day) => loadDate(dayIso(view.year, view.month, day))}
            dayInfo={(day) => ({ disabled: !dayOpen(day), bookings: markOf(day)?.bookings ?? 0, title: dayTitle(day) })}
          />
        </section>

        <section aria-label="Choose a time" className="lg:col-span-4 flex flex-col gap-2">
          <ScheduleSlotList
            className="flex-1"
            layoutId="reschedule-slot-pill"
            loading={loadingSlots}
            disabled={submitting}
            selectedKey={slot}
            onSelect={(key) => setSlot(Number(key))}
            slots={(options?.slots ?? []).map((s) => ({
              key: s.startMinutes,
              label: s.label.replace(' • PST, GMT+8', ''),
              selectable: s.state === 'available',
              tag: slotTag(s.state),
            }))}
            empty={
              loadingSlots || !options ? (
                <PanelLoader srLabel="Loading open times" />
              ) : noOpenSlots ? (
                <EmptyState
                  size="sm"
                  icon={<ClockIcon />}
                  title="No open times this day"
                  description="Every slot is booked or unavailable. Try another date on the calendar."
                />
              ) : undefined
            }
          />
          <p className="text-center font-inter text-[10.5px] text-[#7D6855]">
            {selectedDate ? longDate(selectedDate) : 'Choose a date'} · PST (GMT+8)
          </p>
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
          accept, the new time replaces the current one for both of you. The payment stays the same, and the call moves to the new time.
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

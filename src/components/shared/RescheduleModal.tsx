'use client';

/**
 * Reschedule dialogs for confirmed appointments (client and lawyer portals), in the same
 * design2 style as ConsultationDecisionModal.
 *  - request:  pick a new date + time slot (both calendars are checked server-side) and a reason
 *  - respond:  accept or decline the other party's proposal (optional reason when declining)
 *  - withdraw: cancel your own open request
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getRescheduleOptionsAction,
  requestRescheduleAction,
  respondToRescheduleAction,
  withdrawRescheduleAction,
  type RescheduleInfo,
  type RescheduleOptions,
} from '@/app/actions/consultationActions';

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

const CARD_SHADOW = '16px 16px 40px rgba(0,0,0,0.22), -8px -8px 24px rgba(255,255,255,0.55)';
const TITLE_PLATE_SHADOW = '6px 8px 16px rgba(165, 135, 105, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.8)';
const PRIMARY_SHADOW = '0 6px 16px rgba(212, 158, 86, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)';
const INSET_SHADOW = 'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)';
const RAISED_SM = '3px 3px 7px rgba(165, 140, 115, 0.35), -3px -3px 7px rgba(255, 255, 255, 0.85)';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n: number) => String(n).padStart(2, '0');

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
  const { mode, consultationId, counterpartName, currentLabel, currentStart, pending, remaining, onClose, onDone } = props;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const title = mode === 'request' ? 'Reschedule Consultation' : mode === 'respond' ? 'Reschedule Request' : 'Withdraw Request?';

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 md:p-6 animate-in fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-modal-title"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="neu-modal outline-[#D39758] relative w-full max-w-[94vw] sm:max-w-2xl lg:max-w-3xl max-h-[88vh] flex flex-col rounded-[26px] sm:rounded-[30px] p-6 sm:p-8 lg:p-9 bg-[#E5D8CB] space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl my-auto overflow-y-auto neu-scrollbar-discrete"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <h3
            id="reschedule-modal-title"
            className="neu-raised-highlight px-6 sm:px-10 py-2 sm:py-2.5 rounded-2xl font-lora text-lg sm:text-xl font-bold text-[#341512] text-center"
            style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
          >
            {title}
          </h3>
        </div>

        {mode === 'request' && (
          <RequestStep
            consultationId={consultationId}
            counterpartName={counterpartName}
            currentLabel={currentLabel}
            currentStart={currentStart}
            remaining={remaining}
            submitting={submitting}
            setSubmitting={setSubmitting}
            error={error}
            setError={setError}
            onClose={onClose}
            onDone={onDone}
          />
        )}
        {mode === 'respond' && pending && (
          <RespondStep
            consultationId={consultationId}
            counterpartName={counterpartName}
            currentLabel={currentLabel}
            pending={pending}
            submitting={submitting}
            setSubmitting={setSubmitting}
            error={error}
            setError={setError}
            onClose={onClose}
            onDone={onDone}
          />
        )}
        {mode === 'withdraw' && pending && (
          <WithdrawStep
            consultationId={consultationId}
            counterpartName={counterpartName}
            pending={pending}
            submitting={submitting}
            setSubmitting={setSubmitting}
            error={error}
            setError={setError}
            onClose={onClose}
            onDone={onDone}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

interface StepProps {
  consultationId: string;
  counterpartName: string;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  onClose: () => void;
  onDone: (message: string) => void;
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-xs font-semibold text-red-800 bg-red-100 border border-red-300 rounded-xl px-3 py-2">
      {error}
    </p>
  );
}

function Buttons({
  cancelLabel = 'Cancel',
  primaryLabel,
  onCancel,
  onPrimary,
  disabled,
  submitting,
}: {
  cancelLabel?: string;
  primaryLabel: string;
  onCancel: () => void;
  onPrimary: () => void;
  disabled?: boolean;
  submitting: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="min-w-[130px] px-8 py-2.5 rounded-xl border border-[#341512]/60 bg-[#ECE1D2] text-xs sm:text-sm font-lora font-semibold text-[#341512] hover:bg-[#E2D4C3] active:scale-95 transition-all disabled:opacity-50 shadow-[2px_2px_5px_rgba(182,155,130,0.3),-2px_-2px_5px_#ffffff]"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={submitting || disabled}
        className="neu-btn-caramel min-w-[130px] px-8 py-2.5 rounded-xl bg-[#D49E56] text-xs sm:text-sm font-lora font-bold text-[#341512] transition-all hover:brightness-105 active:scale-95 disabled:opacity-50"
        style={{ boxShadow: PRIMARY_SHADOW }}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

// ─── Request: choose a new date & time ─────────────────────────────────────

function RequestStep({
  consultationId,
  counterpartName,
  currentLabel,
  currentStart,
  remaining,
  submitting,
  setSubmitting,
  error,
  setError,
  onClose,
  onDone,
}: StepProps & { currentLabel: string; currentStart: string | null; remaining: number }) {
  const today = manilaToday();
  // Open on the current appointment's month (or today, if that month has already begun).
  const [initialIso] = useState(() => {
    const currentIso = currentStart ? new Date(new Date(currentStart).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10) : today;
    const firstOfMonth = `${currentIso.slice(0, 7)}-01`;
    return firstOfMonth > today ? firstOfMonth : today;
  });
  const [view, setView] = useState(() => monthOf(initialIso));
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

  /** Selects a date and loads its slots. `keepError` keeps a submit error visible while refreshing. */
  const loadDate = (iso: string, { keepError = false } = {}) => {
    const seq = ++requestSeq.current;
    setSelectedDate(iso);
    setSlot(null);
    setLoadingSlots(true);
    if (!keepError) setError(null);
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
    const d = new Date(Date.UTC(view.year, view.month + delta, 1));
    const next = { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    setView(next);
    const iso = firstSelectable(next.year, next.month);
    if (iso) loadDate(iso);
  };

  const chosen = options?.slots.find((s) => s.startMinutes === slot) ?? null;
  const valid = !!selectedDate && !!chosen && chosen.state === 'available' && reason.trim().length >= 5;

  const submit = async () => {
    if (!valid || !selectedDate || slot === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await requestRescheduleAction(consultationId, { date: selectedDate, startMinutes: slot, reason: reason.trim() });
      if (!('success' in res) || !res.success) {
        setError(('error' in res && res.error) || 'Your request could not be sent.');
        if (selectedDate) loadDate(selectedDate, { keepError: true });
        return;
      }
      onDone(`Reschedule request sent to ${counterpartName}.`);
    } catch {
      setError('Your request could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-xs sm:text-[13px] text-[#4A3525] leading-relaxed text-center">
        Current schedule: <strong>{currentLabel}</strong>. Choose a new date and time below — <strong>{counterpartName}</strong> will
        be asked to accept it. Your payment and Google Meet link stay the same.
        {remaining < 2 && <> This booking can be rescheduled {remaining} more time{remaining === 1 ? '' : 's'}.</>}
      </p>

      <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
        {/* Calendar */}
        <div className="rounded-2xl bg-[#ECE1D2] p-4" style={{ boxShadow: RAISED_SM }}>
          <div className="flex items-center justify-between pb-3">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              disabled={monthKey <= minMonth || submitting}
              aria-label="Previous month"
              className="h-8 w-8 rounded-full text-[#5C4535] hover:bg-[#E0D2C0] disabled:opacity-30"
            >
              ‹
            </button>
            <span className="font-lora text-xs font-bold uppercase tracking-widest text-[#C58B3C]">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              disabled={monthKey >= maxMonth || submitting}
              aria-label="Next month"
              className="h-8 w-8 rounded-full text-[#5C4535] hover:bg-[#E0D2C0] disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center font-lora text-[11px] font-bold text-[#341512] pb-1">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center font-lora text-xs">
            {cells.map((day, idx) => {
              if (!day) return <span key={`e-${idx}`} className="h-8" />;
              const iso = dayIso(view.year, view.month, day);
              const outOfRange = iso < (bounds?.min ?? today) || (!!bounds && iso > bounds.max);
              const blocked = blockedDays.key === monthKey && blockedDays.days.includes(day);
              const disabled = outOfRange || blocked || submitting;
              const selected = iso === selectedDate;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => loadDate(iso)}
                  aria-pressed={selected}
                  aria-label={`${longDate(iso)}${blocked ? ' (attorney unavailable)' : ''}`}
                  title={blocked ? 'Attorney unavailable' : undefined}
                  className={`h-8 w-8 mx-auto rounded-full font-lora transition-all flex items-center justify-center ${
                    selected
                      ? 'bg-[#ECE1D2] text-[#C58B3C] font-bold shadow-[3px_3px_7px_rgba(182,155,130,0.45),-3px_-3px_7px_#ffffff]'
                      : disabled
                        ? 'text-[#B5A391] line-through decoration-[#C8B59E]'
                        : 'text-[#341512] hover:text-[#C58B3C] hover:bg-[#DECEB8]'
                  }`}
                >
                  {pad(day)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slots */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#946525]">
            {selectedDate ? longDate(selectedDate) : 'Choose a date'}
          </p>
          <div className="space-y-2" aria-busy={loadingSlots}>
            {loadingSlots || !options
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 rounded-xl neu-skeleton-inset" />)
              : options.slots.map((s) => {
                  const selectable = s.state === 'available';
                  const tag =
                    s.state === 'current' ? 'Current' : s.state === 'booked' ? 'Booked' : s.state === 'unavailable' ? 'Unavailable' : s.state === 'past' ? 'Too soon' : null;
                  return (
                    <button
                      key={s.startMinutes}
                      type="button"
                      disabled={!selectable || submitting}
                      onClick={() => setSlot(s.startMinutes)}
                      aria-pressed={slot === s.startMinutes}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all flex items-center justify-between gap-2 ${
                        slot === s.startMinutes
                          ? 'bg-[#D9A86C] text-[#34150F]'
                          : selectable
                            ? 'bg-[#ECE1D2] text-[#3E2A1E] hover:brightness-[1.03]'
                            : 'bg-[#E4D5C2] text-[#A08E7C] cursor-not-allowed'
                      }`}
                      style={{ boxShadow: slot === s.startMinutes ? PRIMARY_SHADOW : selectable ? RAISED_SM : INSET_SHADOW }}
                    >
                      <span className={selectable ? '' : 'line-through'}>{s.label.replace(' • PST, GMT+8', '')}</span>
                      {tag && <span className="text-[10px] font-bold uppercase tracking-wide">{tag}</span>}
                    </button>
                  );
                })}
          </div>
          <p className="text-[10.5px] text-[#7D6855]">Times are in PST (GMT+8).</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reschedule-reason" className="text-[11px] font-bold uppercase tracking-wider text-[#946525]">
          Reason for rescheduling
        </label>
        <textarea
          id="reschedule-reason"
          rows={3}
          maxLength={500}
          value={reason}
          disabled={submitting}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`Let ${counterpartName} know why you need to move this consultation.`}
          className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none resize-y"
          style={{ boxShadow: INSET_SHADOW }}
        />
      </div>

      <ErrorLine error={error} />
      <Buttons
        primaryLabel={submitting ? 'Sending...' : 'Send Request'}
        onCancel={onClose}
        onPrimary={submit}
        disabled={!valid}
        submitting={submitting}
      />
    </div>
  );
}

// ─── Respond: accept / decline the other party's proposal ─────────────────

function ProposalCard({ currentLabel, pending }: { currentLabel?: string; pending: NonNullable<RescheduleInfo['pending']> }) {
  return (
    <div className="rounded-2xl bg-[#ECE1D2] p-4 sm:p-5 space-y-3 text-xs sm:text-[13px] text-[#3E2A1E]" style={{ boxShadow: RAISED_SM }}>
      {currentLabel && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="w-24 shrink-0 text-[10.5px] font-bold uppercase tracking-wider text-[#7D6855]">From</span>
          <span className="line-through decoration-[#B5A391]">{currentLabel}</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        <span className="w-24 shrink-0 text-[10.5px] font-bold uppercase tracking-wider text-[#946525]">{currentLabel ? 'To' : 'Proposed'}</span>
        <strong>
          {pending.proposedDateLong} · {pending.proposedTimeRange}
        </strong>
      </div>
      <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
        <span className="w-24 shrink-0 text-[10.5px] font-bold uppercase tracking-wider text-[#7D6855]">Reason</span>
        <span className="whitespace-pre-line">{pending.reason}</span>
      </div>
    </div>
  );
}

function RespondStep({
  consultationId,
  counterpartName,
  currentLabel,
  pending,
  submitting,
  setSubmitting,
  error,
  setError,
  onDone,
}: StepProps & { currentLabel: string; pending: NonNullable<RescheduleInfo['pending']> }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');

  const answer = async (response: 'accept' | 'decline') => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await respondToRescheduleAction(consultationId, response, response === 'decline' ? note.trim() : undefined);
      if (!('success' in res) || !res.success) {
        setError(('error' in res && res.error) || 'Your answer could not be saved.');
        return;
      }
      onDone(
        response === 'accept'
          ? `The consultation was moved to ${pending.proposedDateLong}, ${pending.proposedTimeRange}.`
          : 'The request was declined. The original schedule stays.'
      );
    } catch {
      setError('Your answer could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-xs sm:text-[13px] text-[#4A3525] leading-relaxed text-center">
        <strong>{counterpartName}</strong> asked to move your confirmed consultation. If you accept, the new time replaces the
        current one for both of you; the payment and Google Meet link stay the same.
      </p>
      <ProposalCard currentLabel={currentLabel} pending={pending} />
      {declining && (
        <div className="space-y-1.5">
          <label htmlFor="reschedule-decline-note" className="text-[11px] font-bold uppercase tracking-wider text-[#946525]">
            Reason for declining (optional)
          </label>
          <textarea
            id="reschedule-decline-note"
            rows={3}
            maxLength={500}
            autoFocus
            value={note}
            disabled={submitting}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I am not available then — could we try another day?"
            className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none resize-y"
            style={{ boxShadow: INSET_SHADOW }}
          />
        </div>
      )}
      <ErrorLine error={error} />
      {declining ? (
        <Buttons
          cancelLabel="Back"
          primaryLabel={submitting ? 'Submitting...' : 'Decline Request'}
          onCancel={() => setDeclining(false)}
          onPrimary={() => answer('decline')}
          submitting={submitting}
        />
      ) : (
        <Buttons
          cancelLabel="Decline"
          primaryLabel={submitting ? 'Accepting...' : 'Accept New Time'}
          onCancel={() => {
            setError(null);
            setDeclining(true);
          }}
          onPrimary={() => answer('accept')}
          submitting={submitting}
        />
      )}
    </div>
  );
}

// ─── Withdraw your own request ─────────────────────────────────────────────

function WithdrawStep({
  consultationId,
  counterpartName,
  pending,
  submitting,
  setSubmitting,
  error,
  setError,
  onClose,
  onDone,
}: StepProps & { pending: NonNullable<RescheduleInfo['pending']> }) {
  const withdraw = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await withdrawRescheduleAction(consultationId);
      if (!('success' in res) || !res.success) {
        setError(('error' in res && res.error) || 'The request could not be withdrawn.');
        return;
      }
      onDone('Your reschedule request was withdrawn. The original schedule stays.');
    } catch {
      setError('The request could not be withdrawn. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="space-y-5">
      <p className="text-xs sm:text-[13px] text-[#4A3525] leading-relaxed text-center">
        You asked <strong>{counterpartName}</strong> to move this consultation. Withdrawing keeps the original schedule.
      </p>
      <ProposalCard pending={pending} />
      <ErrorLine error={error} />
      <Buttons
        cancelLabel="Keep Request"
        primaryLabel={submitting ? 'Withdrawing...' : 'Withdraw Request'}
        onCancel={onClose}
        onPrimary={withdraw}
        submitting={submitting}
      />
    </div>
  );
}

export default RescheduleModal;

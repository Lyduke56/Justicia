'use client';

/**
 * The Consultation Booking calendar's look (Lawyer Profile → Consultation Booking), packaged for
 * other dialogs (the reschedule request). Same pieces: month with chevrons, the giant day
 * number and weekday, the SUN–SAT grid with a raised pill on the selected day, and the
 * "Available Time Slots" well. Days carry the same indicators: a dot when the day already has
 * bookings, crossed out when it can't be booked.
 *
 * The booking screen keeps its own copy (LawyerDetailView); this mirrors its classes and motion.
 */
import React from 'react';
import { AnimatePresence, motion, type HTMLMotionProps, type Variants } from 'motion/react';

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SPRING_PILL = { type: 'spring', stiffness: 520, damping: 38 } as const;
const MONTH_SHORT_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const KEY_VARIANTS: Variants = {
  rest: { y: 0, scale: 1, filter: 'brightness(1)', transition: { type: 'spring', stiffness: 560, damping: 15, mass: 0.7 } },
  hover: { y: -1.5, scale: 1, filter: 'brightness(1.03)', transition: { type: 'spring', stiffness: 500, damping: 26 } },
  pressed: { y: 2.5, scale: 0.968, filter: 'brightness(0.95)', transition: { duration: 0.06, ease: 'easeOut' } },
};
const OVERLAY_VARIANTS: Variants = {
  rest: { opacity: 0, transition: { duration: 0.18 } },
  hover: { opacity: 0 },
  pressed: { opacity: 1, transition: { duration: 0.05 } },
};
const SLIDE_VARIANTS: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.34, ease: EASE_OUT } },
  exit: (d: number) => ({ opacity: 0, x: d * -28, transition: { duration: 0.16, ease: 'easeIn' } }),
};
const roll = (dist: number): Variants => ({
  enter: (d: number) => ({ y: d * dist, opacity: 0 }),
  center: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } },
  exit: (d: number) => ({ y: d * -dist, opacity: 0, transition: { duration: 0.18 } }),
});
const DAY_ROLL = roll(46);
const LABEL_ROLL = roll(16);

type KeyProps = Omit<HTMLMotionProps<'button'>, 'children' | 'variants' | 'initial' | 'animate' | 'whileHover' | 'whileTap'> & {
  children?: React.ReactNode;
};

/** Tactile button (hover lifts, press snaps down), as on the booking screen. */
function Key({ className = '', children, disabled, ...rest }: KeyProps) {
  const on = !disabled;
  return (
    <motion.button
      type="button"
      disabled={disabled}
      variants={KEY_VARIANTS}
      initial="rest"
      animate="rest"
      whileHover={on ? 'hover' : undefined}
      whileTap={on ? 'pressed' : undefined}
      className={`group relative touch-manipulation select-none ${className}`}
      {...rest}
    >
      {children}
      <motion.span
        aria-hidden
        variants={OVERLAY_VARIANTS}
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
        style={{
          boxShadow: 'inset 3px 3px 8px rgba(120,84,48,0.40), inset -2px -2px 5px rgba(255,244,232,0.5)',
          background: 'linear-gradient(145deg, rgba(120,84,48,0.12), rgba(255,255,255,0) 60%)',
        }}
      />
    </motion.button>
  );
}

function HighlightPill({ layoutId, variant = 'neu-raised-highlight-sm' }: { layoutId: string; variant?: string }) {
  return (
    <motion.span aria-hidden layoutId={layoutId} transition={SPRING_PILL} style={{ borderRadius: 9999 }} className="pointer-events-none absolute inset-0 z-0">
      <span className="absolute inset-0 rounded-[inherit] bg-[#E5D8CB]" />
      <span className={`absolute inset-0 rounded-[inherit] ${variant}`} />
    </motion.span>
  );
}

export interface ScheduleDayInfo {
  /** Can't be picked (crossed out). */
  disabled: boolean;
  /** Active bookings on that day (shows the dot). */
  bookings: number;
  /** Tooltip, e.g. "Fully booked". */
  title?: string;
}

export interface ScheduleCalendarProps {
  year: number;
  /** 0-based. */
  month: number;
  /** Selected day of the shown month (null when the selection is in another month). */
  selectedDay: number | null;
  /** Day shown in the giant number when nothing in this month is selected. */
  fallbackDay: number;
  todayIso: string;
  dayInfo: (day: number) => ScheduleDayInfo;
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** "Jump to today" (shown when today isn't the selected day). */
  onToday?: () => void;
  /** +1 forward, -1 back (drives the slide/roll direction). */
  monthDir: number;
  dayDir: number;
  disabled?: boolean;
  /** Unique per screen, so the selected-day pill only glides inside this calendar. */
  layoutId: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function ScheduleCalendar({
  year,
  month,
  selectedDay,
  fallbackDay,
  todayIso,
  dayInfo,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  canPrev,
  canNext,
  onToday,
  monthDir,
  dayDir,
  disabled = false,
  layoutId,
  className = '',
}: ScheduleCalendarProps) {
  const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const cells: Array<number | null> = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const shownDay = selectedDay ?? fallbackDay;
  const weekday = new Date(Date.UTC(year, month, Math.min(shownDay, total))).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toUpperCase();
  const isTodaySelected = selectedDay !== null && `${year}-${pad(month + 1)}-${pad(selectedDay)}` === todayIso;
  const navClass = 'w-6 h-6 rounded-full flex items-center justify-center text-[#341512]/70 hover:text-[#341512] hover:bg-[#DDCFC0]/50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className={`rounded-[24px] neu-raised bg-[#E5D8CB] flex flex-col justify-center px-5 py-3.5 sm:px-6 sm:py-3.5 ${className}`}>
      <div className="w-full flex flex-col sm:flex-row items-center gap-5 sm:gap-6 lg:gap-8">
        {/* Left column: month, giant day number, weekday */}
        <div className="flex flex-col items-center justify-center sm:min-w-[120px] lg:min-w-[140px] shrink-0 select-none pl-1 sm:pl-2">
          <div className="flex items-center justify-center gap-3">
            <Key onClick={onPrevMonth} disabled={!canPrev || disabled} className={navClass} title="Previous Month" aria-label="Previous Month">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Key>
            <div className="relative overflow-hidden h-7 lg:h-9 min-w-[4.5rem] flex items-center justify-center">
              <AnimatePresence mode="popLayout" custom={monthDir} initial={false}>
                <motion.span
                  key={`${year}-${month}`}
                  custom={monthDir}
                  variants={LABEL_ROLL}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="font-lora text-sm sm:text-base lg:text-[24px] font-semibold tracking-wide text-[#341512]/80 uppercase"
                >
                  {MONTH_SHORT_NAMES[month]}
                </motion.span>
              </AnimatePresence>
            </div>
            <Key onClick={onNextMonth} disabled={!canNext || disabled} className={navClass} title="Next Month" aria-label="Next Month">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Key>
          </div>

          <div className="relative overflow-hidden flex justify-center px-1 mb-2">
            <AnimatePresence mode="popLayout" custom={dayDir} initial={false}>
              <motion.span
                key={`${year}-${month}-${shownDay}`}
                custom={dayDir}
                variants={DAY_ROLL}
                initial="enter"
                animate="center"
                exit="exit"
                className="font-lora text-5xl sm:text-6xl lg:text-[110px] font-semibold text-[#D39758] leading-none select-none"
              >
                {pad(shownDay)}
              </motion.span>
            </AnimatePresence>
          </div>

          <span className="font-lora text-[11px] sm:text-sm lg:text-[18px] font-semibold tracking-wider text-[#341512]/80 uppercase pt-0.5">
            {weekday}
          </span>

          <div className="h-7 mt-1 flex items-center justify-center">
            <AnimatePresence>
              {onToday && !isTodaySelected && (
                <motion.div
                  key="today-btn"
                  initial={{ opacity: 0, y: -6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Key
                    onClick={onToday}
                    disabled={disabled}
                    className="neu-raised-sm bg-[#E5D8CB] rounded-full px-3 py-0.5 font-lora text-[11px] font-semibold text-[#341512]/80 hover:text-[#341512] cursor-pointer"
                  >
                    Jump to today
                  </Key>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right column: month grid slides when the month changes */}
        <div className="flex-1 w-full min-w-0 pr-1 sm:pr-2">
          <div className="grid grid-cols-7 justify-items-center mb-1.5">
            {WEEKDAYS.map((d) => (
              <span key={d} className="font-lora text-xs sm:text-[15px] font-semibold text-[#341512]/80 tracking-wide text-center">
                {d}
              </span>
            ))}
          </div>

          <AnimatePresence mode="wait" custom={monthDir} initial={false}>
            <motion.div
              key={`${year}-${month}`}
              custom={monthDir}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              className="grid grid-cols-7 justify-items-center gap-y-1"
            >
              {cells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="size-7 sm:size-8 lg:size-8.5" />;
                const info = dayInfo(day);
                const isSelected = day === selectedDay;
                const isToday = `${year}-${pad(month + 1)}-${pad(day)}` === todayIso;
                const off = info.disabled || disabled;
                return (
                  <Key
                    key={`day-${day}`}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${day}${info.title ? ` (${info.title})` : ''}`}
                    disabled={off}
                    title={info.title}
                    onClick={() => !off && onSelectDay(day)}
                    className={`size-7 sm:size-8 lg:size-9 flex items-center justify-center rounded-full font-lora text-xs sm:text-[15px] select-none transition-colors ${
                      info.disabled
                        ? 'text-[#341512]/30 line-through cursor-not-allowed'
                        : isSelected
                          ? 'text-[#D39758] font-bold cursor-pointer'
                          : 'text-[#341512]/80 hover:bg-[#DDCFC0]/60 cursor-pointer'
                    }`}
                  >
                    {isSelected && !info.disabled && <HighlightPill layoutId={layoutId} variant="neu-raised-sm" />}
                    <span className="relative z-10">{pad(day)}</span>
                    {isToday && <span className="absolute bottom-[3px] left-1/2 z-10 h-1 w-1 -translate-x-1/2 rounded-full bg-[#D39758]" />}
                    {info.bookings > 0 && (
                      <span aria-hidden="true" className="absolute top-[2px] left-[2px] z-10 h-1.5 w-1.5 rounded-full bg-[#946525]" />
                    )}
                  </Key>
                );
              })}
            </motion.div>
          </AnimatePresence>

          <ScheduleLegend />
        </div>
      </div>
    </div>
  );
}

/** "• Has bookings   00 Not available for booking" (same as the booking calendar). */
export function ScheduleLegend() {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-inter text-[10.5px] text-[#341512]/60 select-none">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#946525]" />
        Has bookings
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="font-lora text-[11px] text-[#341512]/30 line-through">00</span>
        Not available for booking
      </span>
    </div>
  );
}

export interface ScheduleSlot {
  key: string | number;
  label: string;
  selectable: boolean;
  /** e.g. "Booked", "Unavailable", "Current" (shown in brackets). */
  tag?: string | null;
}

/** "Available Time Slots": the badge and the recessed well of slot pills. */
export function ScheduleSlotList({
  slots,
  selectedKey,
  onSelect,
  loading = false,
  disabled = false,
  empty,
  layoutId,
  className = '',
}: {
  slots: ScheduleSlot[];
  selectedKey: string | number | null;
  onSelect: (key: string | number) => void;
  loading?: boolean;
  disabled?: boolean;
  /** Shown instead of the list when there are no slots (or none is free). */
  empty?: React.ReactNode;
  layoutId: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col h-full space-y-3 ${className}`}>
      <div className="neu-raised-sm !bg-[#D39758]/30 w-full py-2.5 rounded-[16px] text-center shrink-0">
        <span className="font-lora text-[11px] sm:text-xs font-bold tracking-wider text-[#341512] uppercase">Available Time Slots</span>
      </div>
      <motion.div
        aria-busy={loading}
        animate={{ opacity: loading ? 0.55 : 1 }}
        transition={{ duration: 0.2 }}
        className="neu-recessed rounded-[24px] px-5 sm:px-6 py-6 flex-1 min-h-[180px] max-h-[290px] overflow-y-auto neu-scrollbar-discrete"
      >
        {empty ?? (
          <motion.div
            key={slots.map((s) => s.key).join('|')}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            className="flex flex-col gap-4 justify-start"
          >
            {slots.map((slot) => {
              const isSelected = selectedKey === slot.key;
              const off = !slot.selectable || disabled;
              return (
                <motion.div
                  key={slot.key}
                  variants={{ hidden: { opacity: 0, x: 16 }, show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE_OUT } } }}
                  className="shrink-0"
                >
                  <Key
                    disabled={off}
                    aria-pressed={isSelected}
                    onClick={() => !off && onSelect(slot.key)}
                    className={`w-full py-2 px-3 rounded-full text-xs font-lora font-medium text-center transition-colors ${
                      !slot.selectable
                        ? 'opacity-40 cursor-not-allowed bg-stone-300 text-stone-500 line-through'
                        : isSelected
                          ? 'text-[#341512] font-bold cursor-pointer'
                          : 'neu-raised-sm bg-[#E5D8CB] text-[#341512]/80 hover:text-[#341512] cursor-pointer'
                    }`}
                  >
                    {isSelected && slot.selectable && <HighlightPill layoutId={layoutId} />}
                    <span className="relative z-10">{slot.label}</span>
                    {slot.tag && (
                      <span className="relative z-10 ml-2 inline-block text-[10px] font-bold uppercase tracking-wider text-rose-700 not-italic no-underline">
                        ({slot.tag})
                      </span>
                    )}
                  </Key>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/shared/neu';
import { addDays, daysInMonth, parseIsoDate, toIsoDate } from '@/lib/lawyer/dashboardSchedule';
import { GRID_SLIDE, POPOVER } from '../motion';
import { MONTHS, MONTHS_SHORT, filterLabel, sameFilter, type ScheduleFilter } from './filter';

/**
 * "Filter by date" control: a recessed pill that unfolds a parchment popover.
 *  - Day:   month calendar; days with consultations are raised caramel bubbles.
 *  - Month: the twelve months of a year with their consultation counts.
 * Picking a day or a month applies it and closes the popover. Quick picks: Today, Tomorrow,
 * This month. Esc or a click outside closes it.
 */

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DashboardDateFilterProps {
  value: ScheduleFilter;
  today: string;
  /** Consultations per ISO date. */
  activeDates: Record<string, number>;
  onChange: (next: ScheduleFilter) => void;
  busy?: boolean;
}

export function DashboardDateFilter({ value, today, activeDates, onChange, busy = false }: DashboardDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'day' | 'month'>(value.scope);
  const anchor = value.scope === 'day' ? parseIsoDate(value.date)! : { year: value.year, month: value.month, day: 1 };
  const [view, setView] = useState({ year: anchor.year, month: anchor.month });
  const [dir, setDir] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = filterLabel(value, today);
  const todayParts = parseIsoDate(today)!;

  // Re-centre on the active filter every time the popover opens.
  const openPopover = () => {
    setMode(value.scope);
    setView({ year: anchor.year, month: anchor.month });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const apply = (next: ScheduleFilter) => {
    if (!sameFilter(next, value)) onChange(next);
    setOpen(false);
  };

  const step = (delta: number) => {
    setDir(delta);
    setView((v) => {
      if (mode === 'month') return { year: v.year + delta, month: v.month };
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  const monthCounts = useMemo(() => {
    const counts = Array<number>(12).fill(0);
    const prefix = `${view.year}-`;
    for (const [iso, n] of Object.entries(activeDates)) {
      if (iso.startsWith(prefix)) counts[Number(iso.slice(5, 7)) - 1] += n;
    }
    return counts;
  }, [activeDates, view.year]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
    const list: Array<number | null> = Array(first).fill(null);
    for (let d = 1; d <= daysInMonth(view.year, view.month); d++) list.push(d);
    return list;
  }, [view]);

  const tomorrow = addDays(today, 1);
  const quickPicks: Array<{ label: string; filter: ScheduleFilter }> = [
    { label: 'Today', filter: { scope: 'day', date: today } },
    { label: 'Tomorrow', filter: { scope: 'day', date: tomorrow } },
    { label: 'This month', filter: { scope: 'month', year: todayParts.year, month: todayParts.month } },
  ];

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:flex-none">
      <motion.button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        whileTap={{ scale: 0.97 }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="lawyer-dash-filter group flex h-10 w-full items-center gap-2.5 rounded-[12px] pl-3.5 pr-3 text-left sm:w-auto sm:min-w-[260px]"
      >
        <CalendarIcon className="h-[17px] w-[17px] shrink-0 text-[#B07A34]" />
        <span className="min-w-0 flex-1 truncate font-inter text-[11.5px] text-[#341512]/70">
          {label.prefix}:{' '}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label.value}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="inline-block font-semibold text-[#341512]"
            >
              {label.value}
            </motion.span>
          </AnimatePresence>
        </span>
        {busy ? (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#B07A34]/25 border-t-[#B07A34]" aria-hidden />
        ) : (
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }} className="shrink-0 text-[#5C4535]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Filter consultations by date"
            variants={POPOVER}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'calc(100% - 28px) 0px', transformPerspective: 900 }}
            className="client-popover absolute right-0 top-full z-30 mt-3 w-[min(320px,calc(100vw-2rem))] p-4"
          >
            <span className="client-popover-caret [--caret:22px]" aria-hidden />

            {/* Day / Month: recessed track, the raised thumb slides */}
            <div className="client-neu-well flex rounded-full p-1" role="tablist" aria-label="Filter by">
              {(['day', 'month'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => {
                    setDir(key === 'month' ? 1 : -1);
                    setMode(key);
                  }}
                  className={`relative isolate flex-1 rounded-full py-1.5 font-inter text-[11.5px] font-semibold transition-colors ${
                    mode === key ? 'text-[#341512]' : 'text-[#341512]/50 hover:text-[#341512]/80'
                  }`}
                >
                  {mode === key && (
                    <motion.span
                      layoutId="dash-filter-mode"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="client-neu-thumb absolute inset-0 -z-10 rounded-full"
                    />
                  )}
                  {key === 'day' ? 'Day' : 'Month'}
                </button>
              ))}
            </div>

            {/* Header: title + browse */}
            <div className="mt-4 mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0 overflow-hidden leading-none">
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div
                    key={`${mode}-${view.year}-${mode === 'day' ? view.month : ''}`}
                    custom={dir}
                    variants={GRID_SLIDE}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    <p className="truncate font-lora text-lg font-bold text-[#341512]">
                      {mode === 'day' ? MONTHS[view.month] : view.year}
                    </p>
                    <p className="mt-1 font-lora text-[10.5px] font-bold tracking-[0.2em] text-[#C58B3C]">
                      {mode === 'day' ? view.year : 'SELECT A MONTH'}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <motion.button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={mode === 'day' ? 'Previous month' : 'Previous year'}
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.86 }}
                  className="neu-raised-sm grid size-7 place-items-center rounded-full text-[#5C4535] transition-colors hover:text-[#C58B3C]"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={mode === 'day' ? 'Next month' : 'Next year'}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.86 }}
                  className="neu-raised-sm grid size-7 place-items-center rounded-full text-[#5C4535] transition-colors hover:text-[#C58B3C]"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>

            {/* Recessed well with the grid */}
            <div className="neu-recessed overflow-hidden rounded-[18px] px-2 py-2.5">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                {mode === 'day' ? (
                  <motion.div key={`d-${view.year}-${view.month}`} custom={dir} variants={GRID_SLIDE} initial="enter" animate="center" exit="exit">
                    <div className="grid grid-cols-7 pb-1.5 text-center font-inter text-[10px] font-semibold uppercase text-[#9E8E7D]">
                      {WEEKDAY_INITIALS.map((d, i) => (
                        <span key={i}>{d}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1.5 text-center">
                      {cells.map((day, idx) => {
                        if (!day) return <span key={`e-${idx}`} className="h-7" />;
                        const iso = toIsoDate(view.year, view.month, day);
                        const count = activeDates[iso] ?? 0;
                        const selected = value.scope === 'day' && value.date === iso;
                        const isToday = iso === today;
                        return (
                          <motion.button
                            key={iso}
                            type="button"
                            onClick={() => apply({ scope: 'day', date: iso })}
                            whileHover={selected ? undefined : { scale: 1.12 }}
                            whileTap={{ scale: 0.88 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                            aria-pressed={selected}
                            aria-current={isToday ? 'date' : undefined}
                            aria-label={`${MONTHS[view.month]} ${day}${count ? `, ${count} consultation${count === 1 ? '' : 's'}` : ''}`}
                            title={count ? `${count} consultation${count === 1 ? '' : 's'}` : undefined}
                            className={`relative mx-auto flex size-7 items-center justify-center rounded-full font-inter text-[11.5px] transition-colors ${
                              selected
                                ? 'font-bold text-[#341512]'
                                : count
                                  ? 'neu-day-booked font-bold text-[#B07A34]'
                                  : 'text-[#5C4535] hover:bg-[#D39758]/15'
                            } ${isToday ? 'outline-[1.5px] outline-solid outline-[#C58B3C] outline-offset-2' : ''}`}
                          >
                            {selected && (
                              <motion.span
                                layoutId="dash-filter-day"
                                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                                className="neu-btn-caramel absolute inset-0 rounded-full"
                              />
                            )}
                            <span className="relative leading-none">{day}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={`m-${view.year}`} custom={dir} variants={GRID_SLIDE} initial="enter" animate="center" exit="exit" className="grid grid-cols-3 gap-2 p-1">
                    {MONTHS_SHORT.map((name, m) => {
                      const count = monthCounts[m];
                      const selected = value.scope === 'month' && value.year === view.year && value.month === m;
                      const current = todayParts.year === view.year && todayParts.month === m;
                      return (
                        <motion.button
                          key={name}
                          type="button"
                          onClick={() => apply({ scope: 'month', year: view.year, month: m })}
                          whileHover={selected ? undefined : { y: -1.5 }}
                          whileTap={{ scale: 0.92 }}
                          aria-pressed={selected}
                          aria-label={`${MONTHS[m]} ${view.year}${count ? `, ${count} consultation${count === 1 ? '' : 's'}` : ''}`}
                          className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[12px] font-lora text-[12.5px] transition-colors ${
                            selected ? 'font-bold text-[#341512]' : count ? 'neu-day-booked font-bold text-[#B07A34]' : 'text-[#5C4535] hover:bg-[#D39758]/15'
                          } ${current ? 'outline-[1.5px] outline-solid outline-[#C58B3C] outline-offset-1' : ''}`}
                        >
                          {selected && (
                            <motion.span
                              layoutId="dash-filter-month"
                              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                              className="neu-btn-caramel absolute inset-0 rounded-[12px]"
                            />
                          )}
                          <span className="relative leading-none">{name}</span>
                          <span className={`relative font-inter text-[9.5px] font-semibold leading-none ${count ? '' : 'opacity-0'}`}>
                            {count} booked
                          </span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick picks */}
            <div className="mt-3.5 flex items-center justify-between gap-2">
              {quickPicks.map((pick) => {
                const active = sameFilter(pick.filter, value);
                return (
                  <motion.button
                    key={pick.label}
                    type="button"
                    onClick={() => apply(pick.filter)}
                    whileHover={active ? undefined : { y: -1.5 }}
                    whileTap={{ scale: 0.94 }}
                    aria-pressed={active}
                    className={`flex-1 rounded-full py-1.5 font-lora text-[10.5px] font-bold uppercase tracking-wider transition-colors ${
                      active ? 'client-neu-well text-[#B07A34]' : 'neu-raised-sm text-[#5C4535] hover:text-[#C58B3C]'
                    }`}
                  >
                    {pick.label}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

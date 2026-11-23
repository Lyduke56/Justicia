'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/shared/neu';
import { daysInMonth, toIsoDate } from '@/lib/lawyer/dashboardSchedule';
import { MONTHS } from '../dashboard/filter';
import { EMBOSS, GRID_SLIDE, ROLL } from '../motion';

/**
 * Month calendar of the Consultations screen, the same design as the client's booking calendar:
 * days with consultations (in the current tab and search) are raised caramel bubbles, the chosen
 * day carries the caramel pill (it glides between days), today is outlined. The grid slides in
 * the direction you browse; on entrance the days arrive in a diagonal wave once the card has risen.
 */

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface ConsultationCalendarProps {
  year: number;
  month: number;
  dir: number;
  today: string;
  selected: string;
  /** Consultations per ISO date. */
  counts: Record<string, number>;
  /** Tooltip for a day with consultations. */
  dayTitle: (iso: string) => string;
  onSelect: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function ConsultationCalendar({ year, month, dir, today, selected, counts, dayTitle, onSelect, onPrev, onNext, onToday }: ConsultationCalendarProps) {
  const [introDone, setIntroDone] = useState(false);
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const list: Array<number | null> = Array(first).fill(null);
    for (let d = 1; d <= daysInMonth(year, month); d++) list.push(d);
    return list;
  }, [year, month]);

  return (
    <motion.div
      variants={EMBOSS}
      onAnimationComplete={() => setIntroDone(true)}
      className="rounded-[24px] bg-[#E5D8CB] p-4 sm:rounded-[26px] sm:p-5"
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div className="min-w-0 overflow-hidden leading-none">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={`${year}-${month}`} variants={ROLL} initial="enter" animate="center" exit="exit">
              <p className="truncate font-lora text-lg font-bold text-[#341512] sm:text-xl">{MONTHS[month]}</p>
              <p className="mt-1 font-lora text-[11px] font-bold tracking-[0.2em] text-[#C58B3C]">{year}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <motion.button
            type="button"
            onClick={onToday}
            whileHover={{ y: -1.5 }}
            whileTap={{ scale: 0.92 }}
            className="neu-raised-sm h-7 select-none rounded-full px-3 font-lora text-[10.5px] font-bold uppercase tracking-wider text-[#5C4535] transition-colors hover:text-[#C58B3C]"
          >
            Today
          </motion.button>
          <motion.button
            type="button"
            onClick={onPrev}
            aria-label="Previous month"
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.86 }}
            className="neu-raised-sm grid size-7 place-items-center rounded-full text-[#5C4535] transition-colors hover:text-[#C58B3C]"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            type="button"
            onClick={onNext}
            aria-label="Next month"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.86 }}
            className="neu-raised-sm grid size-7 place-items-center rounded-full text-[#5C4535] transition-colors hover:text-[#C58B3C]"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </div>

      <div className="neu-recessed overflow-hidden rounded-[18px] px-2 py-2.5 sm:px-2.5">
        <div className="grid grid-cols-7 pb-1.5 text-center font-inter text-[10px] font-semibold uppercase text-[#9E8E7D]">
          {WEEKDAY_INITIALS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={`${year}-${month}`}
            custom={dir}
            variants={GRID_SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid grid-cols-7 gap-y-1.5 text-center"
          >
            {cells.map((day, idx) => {
              if (!day) return <span key={`e-${idx}`} className="h-7" />;
              const iso = toIsoDate(year, month, day);
              const count = counts[iso] ?? 0;
              const isSelected = iso === selected;
              const isToday = iso === today;
              // Diagonal wave: cells further down-right arrive a touch later.
              const waveDelay = (introDone ? 0.02 : 0.45) + (Math.floor(idx / 7) + (idx % 7)) * 0.018;
              return (
                <motion.div
                  key={iso}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20, delay: waveDelay }}
                >
                  <motion.button
                    type="button"
                    onClick={() => onSelect(iso)}
                    whileHover={isSelected ? undefined : { scale: 1.12 }}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${MONTHS[month]} ${day}${count ? `, ${count} consultation${count === 1 ? '' : 's'}` : ''}`}
                    title={count ? dayTitle(iso) : undefined}
                    className={`relative mx-auto flex size-7 select-none items-center justify-center rounded-full font-inter text-[11.5px] transition-colors ${
                      isSelected
                        ? 'font-bold text-[#341512]'
                        : count
                          ? 'neu-day-booked font-bold text-[#B07A34]'
                          : 'text-[#5C4535] hover:bg-[#D39758]/15'
                    } ${isToday ? 'outline-[1.5px] outline-solid outline-[#C58B3C] outline-offset-2' : ''}`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="consult-calendar-day"
                        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                        className="neu-btn-caramel absolute inset-0 rounded-full"
                      />
                    )}
                    <span className="relative leading-none">{day}</span>
                  </motion.button>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex select-none items-center justify-center gap-4 pt-3 font-inter text-[10px] text-[#7D6855]">
        <span className="flex items-center gap-1.5">
          <span className="neu-day-booked h-3 w-3 rounded-full" /> Consultation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="neu-btn-caramel h-3 w-3 rounded-full bg-[#D49E56]" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full outline-[1.5px] outline-solid outline-[#C58B3C]" /> Today
        </span>
      </div>
    </motion.div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LawyerEarningsData } from '@/app/actions/consultationActions';
import { CalendarIcon } from '@/components/shared/neu';
import { POPOVER } from '../motion';
import { MONTHS_FULL, MONTHS_SHORT, compactNumber, monthValues, type ChartMetric } from './model';

/** Chart controls: earnings / sessions switch and the month picker (same parts as the Dashboard filter). */

const Chevron = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function MetricToggle({ value, onChange }: { value: ChartMetric; onChange: (m: ChartMetric) => void }) {
  const options: Array<{ key: ChartMetric; label: string }> = [
    { key: 'earnings', label: 'Earnings' },
    { key: 'sessions', label: 'Sessions' },
  ];
  return (
    <div role="radiogroup" aria-label="Chart shows" className="client-neu-well flex h-10 shrink-0 gap-1 rounded-[12px] p-1">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <motion.button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            whileTap={{ scale: 0.94 }}
            className={`relative isolate rounded-[9px] px-3.5 font-lora text-[12.5px] transition-colors ${
              active ? 'font-semibold text-[#341512]' : 'text-[#341512]/55 hover:text-[#341512]/80'
            }`}
          >
            {active && (
              <motion.span
                layoutId="earnings-metric-thumb"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="client-neu-thumb absolute inset-0 -z-10 rounded-[9px]"
              />
            )}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

export function MonthPicker({
  data,
  metric,
  value,
  onChange,
}: {
  data: LawyerEarningsData;
  metric: ChartMetric;
  value: number;
  onChange: (month: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const values = monthValues(data, metric);

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

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:w-[212px] sm:flex-none">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.97 }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="lawyer-dash-filter flex h-10 w-full items-center gap-2.5 rounded-[12px] pl-3.5 pr-3 text-left"
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-[#B07A34]" />
        <span className="min-w-0 flex-1 truncate font-inter text-[11.5px] text-[#341512]/70">
          Month: <span className="font-semibold text-[#341512] sm:hidden">{MONTHS_SHORT[value]}</span>
          <span className="hidden font-semibold text-[#341512] sm:inline">{MONTHS_FULL[value]}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }} className="shrink-0 text-[#5C4535]">
          <Chevron />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={`Choose a month of ${data.year}`}
            variants={POPOVER}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'calc(100% - 28px) 0px', transformPerspective: 900 }}
            className="client-popover absolute right-0 top-full z-30 mt-3 w-[min(300px,calc(100vw-2rem))] p-3"
          >
            <span className="client-popover-caret [--caret:22px]" aria-hidden />
            <p className="px-1 pb-2.5 pt-0.5 font-lora text-[13px] font-semibold text-[#341512]">{data.year}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS_SHORT.map((m, i) => {
                const active = i === value;
                const future = i > data.currentMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={future}
                    aria-pressed={active}
                    aria-label={MONTHS_FULL[i]}
                    onClick={() => {
                      onChange(i);
                      setOpen(false);
                    }}
                    className={`relative isolate flex flex-col items-center gap-0.5 rounded-[12px] py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      active ? 'text-[#341512]' : 'text-[#341512]/75 enabled:hover:bg-[#D39758]/12 enabled:hover:text-[#341512]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="earnings-month-active"
                        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                        className="client-neu-thumb absolute inset-0 -z-10 rounded-[12px]"
                      />
                    )}
                    <span className={`font-lora text-[12.5px] ${active ? 'font-bold' : 'font-medium'}`}>{m}</span>
                    <span className={`font-inter text-[9.5px] ${active ? 'font-semibold text-[#B07A34]' : 'text-[#7D6855]'}`}>
                      {future ? '—' : metric === 'earnings' ? `₱${compactNumber(values[i])}` : values[i]}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

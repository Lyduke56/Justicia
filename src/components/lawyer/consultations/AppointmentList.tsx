'use client';

import React from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import type { LawyerConsultation } from '@/app/actions/consultationActions';
import { detailStatusTone } from '../useLawyerConsultationActions';
import { EASE_OUT, EMBOSS } from '../motion';

/**
 * "List of Appointments": the consultations on the date chosen in the calendar, styled like the
 * client's Reminders card (caramel raised card, bell-style icon chip, count pill). The one shown
 * in the big card carries a raised highlight that glides between rows; picking a row shows it.
 */

const LIST: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};
const ITEM: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } },
};

const DOT: Record<ReturnType<typeof detailStatusTone>, string> = {
  caramel: 'bg-[#D49E56]',
  red: 'bg-[#E60000]',
  green: 'bg-[#1FAA00]',
  amber: 'bg-[#C9822B]',
  grey: 'bg-stone-500',
};

function compactRange(range: string): string {
  return range.replace(/:00(?=\s*[AP]M)/gi, '').replace(/\s*-\s*/, ' – ');
}

interface AppointmentListProps {
  dateKey: string;
  dateLabel: string;
  items: LawyerConsultation[];
  currentId: string | null;
  emptyText: string;
  onSelect: (c: LawyerConsultation) => void;
}

export function AppointmentList({ dateKey, dateLabel, items, currentId, emptyText, onSelect }: AppointmentListProps) {
  return (
    <motion.div
      variants={EMBOSS}
      className="flex min-h-[220px] flex-col gap-4 rounded-[24px] p-4 sm:rounded-[26px] sm:p-5 xl:min-h-[262px] xl:flex-1 xl:basis-0"
      style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
    >
      <div className="flex shrink-0 items-center gap-3">
        {/* The chip gives a small turn whenever the chosen date changes. */}
        <motion.div
          key={`chip-${dateKey}`}
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, -14, 10, -6, 0] }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          className="neu-btn-banner grid size-9 shrink-0 place-items-center rounded-full text-[#341512]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </motion.div>
        <div className="min-w-0 flex-1">
          {/* One line only, so the header never grows while the date or count swaps. */}
          <h3 className="truncate font-lora text-base font-bold leading-tight text-[#341512] sm:text-[17px]">List of Appointments</h3>
          <div className="relative h-4">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={dateKey}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="truncate font-inter text-[11px] leading-4 text-[#5C4535]"
              >
                {dateLabel}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        {/* Fixed slot for the count: the outgoing and incoming pills overlap here instead of
            sitting side by side and squeezing the title onto two lines. */}
        <span className="relative flex h-6 min-w-7 shrink-0 items-center justify-end">
          <AnimatePresence mode="popLayout">
            {items.length > 0 && (
              <motion.span
                key={`count-${dateKey}-${items.length}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                className="neu-inset-banner flex h-6 min-w-7 shrink-0 items-center justify-center rounded-full px-2.5 font-inter text-[11px] font-bold text-[#5C4535]"
              >
                {items.length}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {items.length === 0 ? (
          <motion.div
            key={`empty-${dateKey}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-4 text-center"
          >
            <p className="font-lora text-sm font-semibold text-[#5C4535]">Nothing scheduled</p>
            <p className="font-inter text-[11px] text-[#7D6855]">{emptyText}</p>
          </motion.div>
        ) : (
          <motion.ul
            key={`list-${dateKey}`}
            variants={LIST}
            initial="hidden"
            animate="show"
            exit="exit"
            className="neu-scrollbar-discrete -mr-2 flex max-h-[280px] min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto py-1 pl-1 pr-3 xl:max-h-none"
          >
            {items.map((c) => {
              const active = c.id === currentId;
              return (
                <motion.li key={c.id} variants={ITEM}>
                  <motion.button
                    type="button"
                    onClick={() => onSelect(c)}
                    whileTap={{ scale: 0.98 }}
                    aria-pressed={active}
                    aria-label={`${c.client.name}, ${c.timeRange}, ${c.statusLabel.toLowerCase()}`}
                    className={`group relative isolate flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
                      active ? 'text-[#341512]' : 'text-[#3E2A1E] hover:bg-[#E5D8CB]/35'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="consult-list-active"
                        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                        className="neu-btn-banner absolute inset-0 -z-10 rounded-[14px]"
                      />
                    )}
                    <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${DOT[detailStatusTone(c.status)]}`} />
                    <span className={`min-w-0 flex-1 truncate font-lora text-[13px] ${active ? 'font-semibold' : ''}`}>{c.client.name}</span>
                    <span className="shrink-0 font-inter text-[10.5px] text-[#5C4535]">{compactRange(c.timeRange)}</span>
                  </motion.button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

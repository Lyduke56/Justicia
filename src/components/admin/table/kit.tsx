'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { EmptyMedallion } from '@/components/shared/neu/EmptyMedallion';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useViewActive } from '@/components/live/LiveProvider';
import { EASE_OUT, RISE } from '@/components/lawyer/motion';

/**
 * Shared pieces of the admin list screens (Lawyer Directory, User Accounts, Reports, Audit Log),
 * so every table looks and moves the same:
 *  - PAGE_FRAME: the page margins of the client and lawyer screens.
 *  - useEntrance: replays the entrance each time a kept-alive tab is shown again.
 *  - TableBand / TableRows / TablePager / TableEmpty: the recessed header band, ruled and
 *    striped rows that rise in order, the "Showing 1–10 of N" footer with page chevrons, and
 *    the empty state.
 *  - ToolbarButton: a raised button sized to sit in the toolbar's search row.
 */

export const CAPS = 'font-inter font-semibold uppercase tracking-[0.14em]';
export const PAGE_FRAME = 'lawyer-page mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12';
export const PAGE_SIZE = 10;
export const ROW_HEIGHT = 60;
/** When rows start rising on the entrance (s); after it (page turns, filters) straight away. */
export const ROWS_AT_ENTRANCE = 0.56;
const ROW_STAGGER = 0.04;

/** Bumps a key each time the kept-alive tab is shown, and reports when the entrance is over. */
export function useEntrance(settleMs = 1300) {
  const viewActive = useViewActive();
  const [wasActive, setWasActive] = useState(viewActive);
  const [entranceKey, setEntranceKey] = useState(0);
  const [settled, setSettled] = useState(false);
  if (viewActive !== wasActive) {
    setWasActive(viewActive);
    if (viewActive) {
      setEntranceKey((k) => k + 1);
      setSettled(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), settleMs);
    return () => window.clearTimeout(timer);
  }, [entranceKey, settleMs]);
  return { entranceKey, settled, rowsAt: settled ? 0 : ROWS_AT_ENTRANCE };
}

/** Pages a list: the visible slice and the first row's index, clamped when the list shrinks. */
export function pageOf<T>(items: T[], pageStart: number, pageSize = PAGE_SIZE) {
  const lastStart = Math.max(0, Math.floor((items.length - 1) / pageSize) * pageSize);
  const start = Math.min(pageStart, lastStart);
  return { start, shown: items.slice(start, start + pageSize) };
}

function RisingRow({ at, mountedAt, children }: { at: number; mountedAt: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [delay] = useState(() => Math.max(0, at - (performance.now() - mountedAt) / 1000));
  return (
    <motion.li
      layout="position"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE_OUT, delay } }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
    >
      {children}
    </motion.li>
  );
}

/** Ruled, lightly striped rows that rise in order (remount it with a new key to replay). */
export function TableRows<T>({ items, itemKey, rowsAt, label, render }: {
  items: T[];
  itemKey: (item: T) => string;
  rowsAt: number;
  label: string;
  render: (item: T) => ReactNode;
}) {
  const [mountedAt] = useState(() => performance.now());
  return (
    <ul aria-label={label} className="admin-queue-list admin-directory-rows flex flex-col">
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <RisingRow key={itemKey(item)} at={rowsAt + i * ROW_STAGGER} mountedAt={mountedAt}>
            {render(item)}
          </RisingRow>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** Column header band, pressed into the panel. `cols` is the grid template shared with the rows. */
export function TableBand({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <motion.div variants={RISE} aria-hidden className={`admin-table-band grid items-center gap-x-4 rounded-[12px] px-4 py-3 @[40rem]:gap-x-6 text-[10px] text-[#7A5A3E] ${CAPS} ${cols}`}>
      {children}
    </motion.div>
  );
}

/** Row class: the shared hover, focus and stripe styles, laid out on the band's grid. */
export const rowClass = (cols: string) => `admin-overview-row admin-directory-row grid w-full items-center gap-x-4 px-4 text-left @[40rem]:gap-x-6 ${cols}`;

export function TablePager({ start, shownCount, total, pageSize = PAGE_SIZE, noun, onPage, extra }: {
  start: number;
  shownCount: number;
  total: number;
  pageSize?: number;
  noun: string;
  onPage: (start: number) => void;
  /** Optional note on the left, after the count. */
  extra?: ReactNode;
}) {
  return (
    <motion.div variants={RISE} className="admin-queue-more flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
      <p className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>
        Showing{' '}
        <span className="tabular-nums text-[#341512]">
          {start + 1}–{start + shownCount}
        </span>{' '}
        of <span className="tabular-nums text-[#341512]">{total}</span>
        {extra}
      </p>
      {total > pageSize && (
        <div className="flex items-center gap-2">
          {[
            { label: `Previous page of ${noun}`, d: 'm6 15 6-6 6 6', to: start - pageSize, disabled: start === 0 },
            { label: `Next page of ${noun}`, d: 'm6 9 6 6 6-6', to: start + pageSize, disabled: start + pageSize >= total },
          ].map((b) => (
            <motion.button
              key={b.label}
              type="button"
              aria-label={b.label}
              title={b.label}
              disabled={b.disabled}
              onClick={() => onPage(b.to)}
              whileHover={b.disabled ? undefined : { y: -1.5 }}
              whileTap={b.disabled ? undefined : { scale: 0.88 }}
              className="neu-raised-sm grid size-8 place-items-center rounded-full text-[#341512] transition-colors hover:text-[#C58B3C] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={b.d} />
              </svg>
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function TableEmpty({ icon, title, hint, actions, emptyKey }: { icon: ReactNode; title: string; hint: string; actions?: ReactNode; emptyKey: string }) {
  return (
    <motion.div key={emptyKey} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <EmptyMedallion size="md" icon={icon} className="mb-1" />
      <p className="font-lora text-[16px] font-semibold text-[#341512]">{title}</p>
      <p className="max-w-[360px] font-inter text-[12px] leading-relaxed text-[#7D6855]">{hint}</p>
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-2.5">{actions}</div>}
    </motion.div>
  );
}

/** Raised button sized to the toolbar's 40px search row. */
export function ToolbarButton({ icon, children, onClick, disabled, busy, label }: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={label}
      whileHover={disabled || busy ? undefined : { y: -1.5 }}
      whileTap={disabled || busy ? undefined : { scale: 0.95 }}
      className="neu-raised-sm flex h-10 shrink-0 items-center gap-2 rounded-[12px] bg-[#E5D8CB] px-4 font-lora text-[12.5px] font-bold text-[#341512] transition-colors hover:text-[#A8742E] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`grid place-items-center text-[#B07A34] ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`}>{icon}</span>
      {children}
    </motion.button>
  );
}

const strokeIcon = (d: string) =>
  function StrokeIcon({ className = 'h-4 w-4' }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    );
  };
export const RefreshGlyph = strokeIcon('M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7');
export const DownloadGlyph = strokeIcon('M12 4v11M7 10l5 5 5-5M5 20h14');

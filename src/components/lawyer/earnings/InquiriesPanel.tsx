'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { EarningsInquiry, EarningsInquiryStatus } from '@/app/actions/consultationActions';
import { CalendarIcon, EmptyState, SearchIcon } from '@/components/shared/neu';
import { PanelLoader } from '@/components/shared/loading';
import { EMBOSS, GROUP, POPOVER, RISE, ROLL, ROW, ROWS, SWAP } from '../motion';
import { ALL_AREAS, INQUIRY_TABS, MONTHS_SHORT, areasOf, inquiryCounts, visibleInquiries, type InquiryTab } from './model';

/**
 * Consultation inquiries: status tabs (the caramel highlight glides, counts pop), a client search
 * that filters as you type, a practice-area menu, and the table. The heading follows the tab.
 */

const PAGE_SIZE = 8;

const STATUS: Record<EarningsInquiryStatus, { label: string; bg: string }> = {
  pendingApproval: { label: 'Pending Approval', bg: 'bg-[#D49E56]' },
  pendingPayment: { label: 'Pending Payment', bg: 'bg-[#E60000]' },
  upcoming: { label: 'Confirmed', bg: 'bg-[#1FAA00]' },
  completed: { label: 'Completed', bg: 'bg-[#4A2E25]' },
  cancelled: { label: 'Cancelled', bg: 'bg-stone-500' },
};

/** "11/23/2026" → "Nov 23, 2026" */
function readableDate(us: string): string {
  const [m, d, y] = us.split('/').map(Number);
  return m && d && y ? `${MONTHS_SHORT[m - 1]} ${d}, ${y}` : us;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

function AreaMenu({ areas, value, onChange }: { areas: string[]; value: string; onChange: (a: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = [{ key: ALL_AREAS, label: 'All practice areas' }, ...areas.map((a) => ({ key: a, label: a }))];
  const current = options.find((o) => o.key === value) ?? options[0];

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
    <div ref={rootRef} className="relative w-full sm:w-[252px]">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.97 }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="lawyer-dash-filter flex h-10 w-full items-center gap-2.5 rounded-[12px] pl-3.5 pr-3 text-left"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#B07A34]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7ZM17 7l-3 7a3 3 0 0 0 6 0l-3-7ZM8 21h8" />
        </svg>
        <span className="min-w-0 flex-1 truncate font-inter text-[11.5px] text-[#341512]/70">
          Area: <span className="font-semibold text-[#341512]">{current.label}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }} className="shrink-0 text-[#5C4535]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Practice area"
            variants={POPOVER}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'calc(100% - 28px) 0px', transformPerspective: 900 }}
            className="client-popover client-popover-scroll absolute right-0 top-full z-30 mt-3 max-h-[300px] w-[min(272px,calc(100vw-2rem))] overflow-y-auto p-2"
          >
            <span className="client-popover-caret [--caret:22px]" aria-hidden />
            {options.map((o) => {
              const active = o.key === value;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`relative isolate flex w-full items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-left font-inter text-[12px] transition-colors ${
                    active ? 'font-semibold text-[#341512]' : 'text-[#341512]/70 hover:bg-[#D39758]/12 hover:text-[#341512]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="earnings-area-active"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="client-neu-thumb absolute inset-0 -z-10 rounded-[12px]"
                    />
                  )}
                  {o.label}
                  {active && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#B07A34]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function InquiriesPanel({ inquiries, loading }: { inquiries: EarningsInquiry[] | null; loading: boolean }) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<InquiryTab>('all');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState(ALL_AREAS);
  const [shown, setShown] = useState(PAGE_SIZE);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => inquiries ?? [], [inquiries]);
  const counts = useMemo(() => inquiryCounts(all), [all]);
  const areas = useMemo(() => areasOf(all), [all]);
  const list = useMemo(() => visibleInquiries(all, tab, query, area), [all, tab, query, area]);
  const meta = INQUIRY_TABS.find((t) => t.key === tab) ?? INQUIRY_TABS[0];
  const filtered = query.trim() !== '' || area !== ALL_AREAS;

  // Any filter change starts the list from the top again.
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    setShown(PAGE_SIZE);
    set(v);
  };
  const changeTab = resetPage(setTab);
  const changeQuery = resetPage(setQuery);
  const changeArea = resetPage(setArea);

  const contentKey = !inquiries ? 'loading' : list.length === 0 ? `empty-${tab}` : `list-${tab}-${area}`;

  return (
    <motion.section variants={GROUP} aria-labelledby="earnings-inquiries-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <motion.div
          variants={EMBOSS}
          layout="size"
          className="inline-flex h-11 max-w-full items-center gap-3 self-start rounded-[20px] pl-6 pr-2"
          style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
        >
          <span className="relative min-w-0 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.h2
                key={meta.heading}
                id="earnings-inquiries-heading"
                variants={ROLL}
                initial="enter"
                animate="center"
                exit="exit"
                className="truncate font-lora text-[15px] font-semibold tracking-[0.02em] text-[#341512]/85 sm:text-base"
              >
                {meta.heading}
              </motion.h2>
            </AnimatePresence>
          </span>
          <motion.span
            key={`${contentKey}-${list.length}`}
            initial={reduce ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="neu-inset-banner grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 font-inter text-[11px] font-bold text-[#341512]"
            aria-label={`${list.length} inquiries`}
          >
            {inquiries ? list.length : '·'}
          </motion.span>
        </motion.div>

        <motion.div variants={RISE} className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="lawyer-field flex h-10 w-full min-w-0 items-center gap-2.5 rounded-[12px] pl-3.5 pr-2 sm:w-[260px]">
            <SearchIcon className="h-4 w-4 shrink-0 text-[#B07A34]" />
            <span className="sr-only">Search client name</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              placeholder="Search client name"
              className="h-full min-w-0 flex-1 bg-transparent font-inter text-[12.5px] text-[#341512] placeholder:text-[#9E8E7D] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  type="button"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => {
                    changeQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="neu-raised-sm grid size-6 shrink-0 place-items-center rounded-full text-[#5C4535] hover:text-[#C58B3C]"
                >
                  <CloseGlyph />
                </motion.button>
              )}
            </AnimatePresence>
          </label>
          <AreaMenu areas={areas} value={area} onChange={changeArea} />
        </motion.div>
      </div>

      {/* Tabs: a row that scrolls sideways on phones, six equal columns from lg */}
      <motion.div
        variants={RISE}
        role="tablist"
        aria-label="Inquiry status"
        className="lawyer-consult-tabs -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 py-1.5 lg:grid lg:grid-cols-6 lg:overflow-visible"
      >
        {INQUIRY_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <motion.button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => changeTab(t.key)}
              whileHover={active ? undefined : { y: -1.5 }}
              whileTap={{ scale: 0.96 }}
              className={`neu-raised-sm relative isolate flex h-9 shrink-0 snap-start items-center justify-center gap-2 rounded-[11px] px-4 font-lora text-[12.5px] transition-colors lg:px-2 ${
                active ? 'font-semibold text-[#341512]' : 'text-[#341512]/75 hover:text-[#341512]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="earnings-tab-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 -z-10 rounded-[11px]"
                  style={{ backgroundColor: 'rgba(211, 151, 88, 0.42)' }}
                />
              )}
              <span className="whitespace-nowrap">{t.label}</span>
              <motion.span
                key={`${t.key}-${counts[t.key]}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-inter text-[10px] font-bold ${
                  active ? 'neu-inset-banner text-[#341512]' : 'bg-[#341512]/[0.07] text-[#5C4535]'
                }`}
              >
                {inquiries ? counts[t.key] : '·'}
              </motion.span>
            </motion.button>
          );
        })}
      </motion.div>

      <motion.div
        variants={EMBOSS}
        aria-busy={loading}
        className="lawyer-dash-surface overflow-hidden rounded-[28px] bg-[#E5D8CB] p-4 sm:p-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={contentKey} variants={SWAP} initial="enter" animate="center" exit="exit">
            {!inquiries ? (
              <PanelLoader srLabel="Loading inquiries" className="min-h-[14rem]" />
            ) : list.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon />}
                title={filtered ? 'No matching inquiries' : meta.empty}
                description={filtered ? 'Try another name or practice area.' : 'New consultation requests will show up here.'}
              />
            ) : (
              <div role="table" aria-label={meta.heading} className="flex flex-col">
                <div
                  role="row"
                  className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_150px] gap-4 px-4 pb-3 font-lora text-[10px] font-bold uppercase tracking-[0.14em] text-[#C58B3C] md:grid"
                >
                  <span role="columnheader">Client</span>
                  <span role="columnheader">Session date</span>
                  <span role="columnheader">Consultation area</span>
                  <span role="columnheader">Status</span>
                </div>
                <div className="lawyer-dash-groove mx-2 mb-2 hidden md:block" aria-hidden />

                <motion.div variants={ROWS} initial="enter" animate="center" role="rowgroup" className="flex flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {list.slice(0, shown).map((inquiry) => (
                      <motion.div
                        key={inquiry.id}
                        variants={ROW}
                        initial="enter"
                        animate="center"
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        layout={reduce ? false : 'position'}
                        role="row"
                        className="lawyer-dash-row is-static grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[16px] px-4 py-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_150px] md:gap-y-0"
                      >
                        <span role="cell" className="flex min-w-0 items-center gap-3">
                          <span className="neu-inset-banner grid size-9 shrink-0 place-items-center rounded-full font-lora text-[12px] font-bold text-[#341512]" aria-hidden>
                            {initials(inquiry.name) || '·'}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-lora text-[13.5px] font-semibold text-[#341512]">{inquiry.name}</span>
                            <span className="block truncate font-inter text-[10.5px] text-[#7D6855] md:hidden">
                              {readableDate(inquiry.date)} · {inquiry.area}
                            </span>
                          </span>
                        </span>
                        <span role="cell" className="hidden font-lora text-[12.5px] text-[#3E2A1E] md:block">
                          {readableDate(inquiry.date)}
                        </span>
                        <span role="cell" className="hidden truncate font-inter text-[12px] text-[#5C4535] md:block">
                          {inquiry.area}
                        </span>
                        <span role="cell">
                          <span
                            className={`neu-raised-pill inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 font-lora text-[9.5px] font-bold uppercase tracking-wider text-white ${STATUS[inquiry.status].bg}`}
                          >
                            {STATUS[inquiry.status].label}
                          </span>
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {list.length > PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-between gap-3 px-2">
                    <span className="font-inter text-[11px] text-[#7D6855]">
                      Showing {Math.min(shown, list.length)} of {list.length}
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShown((s) => (s >= list.length ? PAGE_SIZE : s + PAGE_SIZE))}
                      className="neu-raised-sm h-9 rounded-full px-4 font-lora text-[12px] font-semibold text-[#341512] hover:text-[#B07A34]"
                    >
                      {shown >= list.length ? 'Show less' : `Show ${Math.min(PAGE_SIZE, list.length - shown)} more`}
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}

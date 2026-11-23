'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SearchIcon } from '@/components/shared/neu';
import { POPOVER, RISE } from '../motion';
import { SORTS, TABS, type ConsultationTab, type SortKey } from './model';

/**
 * Top panel of the Consultations screen: status tabs (the caramel highlight glides to the active
 * one, counts pop when they change), client-name search (filters as you type) and sort order.
 */

interface ToolbarProps {
  tab: ConsultationTab;
  counts: Record<ConsultationTab, number | null>;
  onTab: (tab: ConsultationTab) => void;
  query: string;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
}

const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

function SortMenu({ value, onChange }: { value: SortKey; onChange: (s: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = SORTS.find((s) => s.key === value) ?? SORTS[0];

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
    <div ref={rootRef} className="relative sm:w-[232px]">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.97 }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="lawyer-dash-filter flex h-10 w-full items-center gap-2.5 rounded-[12px] pl-3.5 pr-3 text-left"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#B07A34]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 6h13M3 12h9M3 18h5M17 10V20M14 17l3 3 3-3" />
        </svg>
        <span className="min-w-0 flex-1 truncate font-inter text-[11.5px] text-[#341512]/70">
          Sort: <span className="font-semibold text-[#341512]">{current.label}</span>
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
            aria-label="Sort consultations"
            variants={POPOVER}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'calc(100% - 28px) 0px', transformPerspective: 900 }}
            className="client-popover absolute right-0 top-full z-30 mt-3 w-[min(260px,calc(100vw-2rem))] p-2"
          >
            <span className="client-popover-caret [--caret:22px]" aria-hidden />
            {SORTS.map((s) => {
              const active = s.key === value;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(s.key);
                    setOpen(false);
                  }}
                  className={`relative isolate flex w-full items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-left font-inter text-[12px] transition-colors ${
                    active ? 'font-semibold text-[#341512]' : 'text-[#341512]/70 hover:bg-[#D39758]/12 hover:text-[#341512]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="consult-sort-active"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="client-neu-thumb absolute inset-0 -z-10 rounded-[12px]"
                    />
                  )}
                  {s.label}
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

export function ConsultationsToolbar({ tab, counts, onTab, query, onQuery, sort, onSort }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Tabs: a row that scrolls sideways on phones, five equal columns from md */}
      <motion.div
        variants={RISE}
        role="tablist"
        aria-label="Consultation status"
        className="lawyer-consult-tabs -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 py-1.5 md:grid md:grid-cols-5 md:overflow-visible"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          const count = counts[t.key];
          return (
            <motion.button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTab(t.key)}
              whileHover={active ? undefined : { y: -1.5 }}
              whileTap={{ scale: 0.96 }}
              className={`neu-raised-sm relative isolate flex h-9 shrink-0 snap-start items-center justify-center gap-2 rounded-[11px] px-4 font-lora text-[12.5px] transition-colors md:px-2 ${
                active ? 'font-semibold text-[#341512]' : 'text-[#341512]/75 hover:text-[#341512]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="consult-tab-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 -z-10 rounded-[11px]"
                  style={{ backgroundColor: 'rgba(211, 151, 88, 0.42)' }}
                />
              )}
              <span className="whitespace-nowrap">{t.label}</span>
              <motion.span
                key={`${t.key}-${count}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-inter text-[10px] font-bold ${
                  active ? 'neu-inset-banner text-[#341512]' : 'bg-[#341512]/[0.07] text-[#5C4535]'
                }`}
              >
                {count ?? '·'}
              </motion.span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Search + sort */}
      <motion.form
        variants={RISE}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          inputRef.current?.blur();
        }}
        className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
      >
        <label className="lawyer-field flex h-10 w-full min-w-0 items-center gap-2.5 rounded-[12px] pl-3.5 pr-2 sm:w-auto sm:flex-1">
          <SearchIcon className="h-4 w-4 shrink-0 text-[#B07A34]" />
          <span className="sr-only">Search client name</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
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
                  onQuery('');
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
        <div className="flex gap-2.5">
          <motion.button
            type="submit"
            whileHover={{ y: -1.5 }}
            whileTap={{ scale: 0.95 }}
            className="neu-btn-caramel flex h-10 shrink-0 items-center gap-2 rounded-[12px] bg-[#D49E56] px-5 font-lora text-[12.5px] font-bold text-[#341512]"
          >
            <SearchIcon className="h-3.5 w-3.5" />
            Search
          </motion.button>
          <div className="min-w-0 flex-1 sm:flex-none">
            <SortMenu value={sort} onChange={onSort} />
          </div>
        </div>
      </motion.form>
    </div>
  );
}

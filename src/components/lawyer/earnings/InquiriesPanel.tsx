'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { EarningsInquiry, EarningsInquiryStatus } from '@/app/actions/consultationActions';
import { CalendarIcon, EmptyState } from '@/components/shared/neu';
import { PanelLoader } from '@/components/shared/loading';
import { EMBOSS, GROUP, RISE, ROW, ROWS, SWAP } from '../motion';
import { ALL_AREAS, INQUIRY_TABS, MONTHS_SHORT, inquiryCounts, visibleInquiries, type InquiryTab } from './model';

/**
 * Consultation inquiries at the bottom of Earnings & Payouts: status tabs (the caramel highlight
 * glides, counts pop) and the table for the chosen tab.
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

export function InquiriesPanel({ inquiries, loading }: { inquiries: EarningsInquiry[] | null; loading: boolean }) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<InquiryTab>('all');
  const [shown, setShown] = useState(PAGE_SIZE);

  const all = useMemo(() => inquiries ?? [], [inquiries]);
  const counts = useMemo(() => inquiryCounts(all), [all]);
  const list = useMemo(() => visibleInquiries(all, tab, '', ALL_AREAS), [all, tab]);
  const meta = INQUIRY_TABS.find((t) => t.key === tab) ?? INQUIRY_TABS[0];

  // Switching tabs starts the list from the top again.
  const changeTab = (next: InquiryTab) => {
    setShown(PAGE_SIZE);
    setTab(next);
  };

  const contentKey = !inquiries ? 'loading' : list.length === 0 ? `empty-${tab}` : `list-${tab}`;

  return (
    <motion.section variants={GROUP} aria-label="Consultation inquiries" className="flex flex-col gap-5">
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
                title={meta.empty}
                description="New consultation requests will show up here."
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

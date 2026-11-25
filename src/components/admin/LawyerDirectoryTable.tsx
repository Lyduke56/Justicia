'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { useViewActive } from '@/components/live/LiveProvider';
import { ChevronRightIcon, NeuButton } from '@/components/shared/neu';
import { DRAW, EASE_OUT, EMBOSS, PAGE, RISE } from '@/components/lawyer/motion';
import { QueueToolbar } from './verification/QueueToolbar';
import { CAPS } from './verification/ApplicationDossier';
import { peso } from './verification/model';
import { DIRECTORY_SORTS, DIRECTORY_TABS, listingOf, matchesTab, visibleLawyers, type DirectorySort, type DirectoryTab, type LawyerDirectoryItem } from './directory/model';

export type { LawyerDirectoryItem } from './directory/model';

/**
 * Lawyer Directory, built like the Verification Queue and the Overview:
 *  - Top: the lawyer Consultations toolbar design (status tabs, search, sort).
 *  - A carved divider, then a structured table of lawyers: a recessed header band, one value
 *    per cell (numbers right-aligned), ruled and lightly striped rows, flat status pills.
 *    10 per page (the chevrons turn the page). Columns drop away as the panel narrows
 *    (container queries), down to name and status on phones. Each row opens the dossier.
 *
 * Entrance (replayed each time the tab is opened): the toolbar embosses and its rows rise, the
 * divider draws out from its centre, the table embosses, then its rows rise in order.
 */

const PAGE_SIZE = 10;
const ROW_HEIGHT = 60;
/** When the rows start rising on the entrance (s); afterwards (page turns, filters) straight away. */
const ROWS_AT_ENTRANCE = 0.56;
const ROW_STAGGER = 0.04;

/*
 * Columns, shared by the header band and the rows so everything lines up:
 *   narrow:  Lawyer · Verification
 *   40rem:   + Roll No. · Listing
 *   52rem:   + IBP Chapter
 *   60rem:   + Experience · Rate
 */
const COLS = [
  'grid-cols-[minmax(0,1fr)_auto_14px]',
  '@[40rem]:grid-cols-[minmax(0,1fr)_92px_112px_92px_14px]',
  '@[52rem]:grid-cols-[minmax(0,1fr)_92px_minmax(0,0.7fr)_112px_92px_14px]',
  '@[60rem]:grid-cols-[minmax(0,1fr)_92px_minmax(0,0.7fr)_84px_96px_112px_92px_14px]',
].join(' ');
const ROLL = 'hidden @[40rem]:block';
const CHAPTER = 'hidden @[52rem]:block';
const NUMERIC = 'hidden @[60rem]:block text-right';
const LISTING = 'hidden @[40rem]:block';

const STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: 'Verified', tone: 'success' },
  pending: { label: 'Pending', tone: 'pending' },
  needs_resubmission: { label: 'Needs Info', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'danger' },
};
const statusOf = (s: string) => STATUS[s] ?? { label: 'Draft', tone: 'neutral' };

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

function LawyerRow({ lawyer }: { lawyer: LawyerDirectoryItem }) {
  const status = statusOf(lawyer.verification_status || 'draft');
  const listing = listingOf(lawyer);
  return (
    <Link
      href={`/admin/lawyers/${lawyer.user_id}?from=directory`}
      aria-label={`${lawyer.full_name || 'Unnamed lawyer'}, ${status.label}, ${listing.label}. Open dossier`}
      className={`admin-overview-row admin-directory-row grid items-center gap-x-4 px-4 @[40rem]:gap-x-6 ${COLS}`}
      style={{ height: ROW_HEIGHT }}
    >
      <span className="min-w-0">
        <span className="block truncate font-lora text-[14px] font-semibold text-[#341512]">{lawyer.full_name || 'Unnamed lawyer'}</span>
        <span className="block truncate font-inter text-[11px] text-[#7D6855]">
          <span className="tabular-nums @[40rem]:hidden">Roll {lawyer.roll_number || '—'}</span>
          <span className="hidden @[40rem]:inline">{lawyer.email || 'No email on file'}</span>
        </span>
      </span>
      <span className={`${ROLL} truncate font-inter text-[12px] tabular-nums text-[#3E2A1E]`}>{lawyer.roll_number || '—'}</span>
      <span className={`${CHAPTER} truncate font-inter text-[12px] text-[#3E2A1E]`} title={lawyer.ibp_chapter || undefined}>
        {lawyer.ibp_chapter || <span className="text-[#9E8E7D]">—</span>}
      </span>
      <span className={`${NUMERIC} font-inter text-[12px] tabular-nums text-[#3E2A1E]`}>
        {lawyer.experience_years != null ? `${lawyer.experience_years} yr${lawyer.experience_years === 1 ? '' : 's'}` : <span className="text-[#9E8E7D]">—</span>}
      </span>
      <span className={`${NUMERIC} font-inter text-[12px] tabular-nums text-[#3E2A1E]`}>
        {lawyer.fee_standard_60min != null ? peso(lawyer.fee_standard_60min) : <span className="text-[#9E8E7D]">—</span>}
      </span>
      <span>
        <span className={`admin-pill admin-pill-${status.tone}`}>{status.label}</span>
      </span>
      <span className={`${LISTING} min-w-0`} title={listing.detail}>
        <span className="flex items-center gap-2 font-inter text-[12px] text-[#3E2A1E]">
          <span className={`h-2 w-2 shrink-0 rounded-full ${listing.listed ? 'admin-listing-on' : 'admin-listing-off'}`} aria-hidden />
          {listing.label}
        </span>
      </span>
      <ChevronRightIcon className="admin-overview-go h-3.5 w-3.5 text-[#B07A34]" />
    </Link>
  );
}

function DirectoryRows({ lawyers, rowsAt }: { lawyers: LawyerDirectoryItem[]; rowsAt: number }) {
  const [mountedAt] = useState(() => performance.now());
  return (
    <ul aria-label="Lawyers" className="admin-queue-list admin-directory-rows flex flex-col">
      <AnimatePresence mode="popLayout">
        {lawyers.map((lawyer, i) => (
          <RisingRow key={lawyer.user_id} at={rowsAt + i * ROW_STAGGER} mountedAt={mountedAt}>
            <LawyerRow lawyer={lawyer} />
          </RisingRow>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export function LawyerDirectoryTable({ lawyers }: { lawyers: LawyerDirectoryItem[] }) {
  const reduceMotion = useReducedMotion();
  const viewActive = useViewActive();

  // Tabs stay mounted; replay the entrance each time this one is shown.
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
    const timer = window.setTimeout(() => setSettled(true), 1300);
    return () => window.clearTimeout(timer);
  }, [entranceKey]);

  const [tab, setTab] = useState<DirectoryTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DirectorySort>('newest');
  const [pageStart, setPageStart] = useState(0);

  const counts = useMemo(
    () => Object.fromEntries(DIRECTORY_TABS.map((t) => [t.key, lawyers.filter((l) => matchesTab(l, t.key)).length])) as Record<DirectoryTab, number>,
    [lawyers]
  );
  const items = useMemo(() => visibleLawyers(lawyers, tab, query, sort), [lawyers, tab, query, sort]);
  const lastStart = Math.max(0, Math.floor((items.length - 1) / PAGE_SIZE) * PAGE_SIZE);
  const start = Math.min(pageStart, lastStart);
  const shown = items.slice(start, start + PAGE_SIZE);
  const tabMeta = DIRECTORY_TABS.find((t) => t.key === tab)!;
  const emptyTitle = query.trim() ? `No lawyers match “${query.trim()}”` : tabMeta.empty;
  const changeTab = (next: DirectoryTab) => {
    setTab(next);
    setPageStart(0);
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={entranceKey}
        variants={PAGE}
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        className="lawyer-page admin-directory mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      >
        <h1 className="sr-only">Lawyer directory</h1>

        {/* ── Tabs, search, sort (the lawyer Consultations toolbar) ─────────── */}
        <motion.section variants={EMBOSS} aria-label="Filter lawyers" className="rounded-[24px] bg-[#E5D8CB] p-4 sm:p-5">
          <QueueToolbar
            tabs={DIRECTORY_TABS}
            tab={tab}
            counts={counts}
            onTab={changeTab}
            query={query}
            onQuery={(q) => {
              setQuery(q);
              setPageStart(0);
            }}
            searchLabel="Search name, roll no., chapter or practice"
            sorts={DIRECTORY_SORTS}
            sort={sort}
            onSort={(next) => {
              setSort(next);
              setPageStart(0);
            }}
            sortLabel="Sort lawyers"
            tabsLabel="Verification status"
            idPrefix="directory"
          />
        </motion.section>

        {/* Carved divider between the filters and the results (draws out from its centre). */}
        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto my-3 w-[78%] shrink-0" aria-hidden />

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <motion.section variants={EMBOSS} aria-label={tabMeta.heading} className="@container rounded-[24px] bg-[#E5D8CB] p-3 sm:p-4">
          {items.length ? (
            <>
              <motion.div variants={RISE} aria-hidden className={`admin-table-band grid items-center gap-x-4 rounded-[12px] px-4 py-3 @[40rem]:gap-x-6 text-[10px] text-[#7A5A3E] ${CAPS} ${COLS}`}>
                <span>Lawyer</span>
                <span className={ROLL}>Roll No.</span>
                <span className={CHAPTER}>IBP Chapter</span>
                <span className={NUMERIC}>Experience</span>
                <span className={NUMERIC}>Rate · 1 hr</span>
                <span>Verification</span>
                <span className={LISTING}>Listing</span>
                <span />
              </motion.div>
              <div className="mt-1.5">
                <DirectoryRows key={`${tab}|${sort}|${start}|${entranceKey}`} lawyers={shown} rowsAt={settled ? 0 : ROWS_AT_ENTRANCE} />
              </div>
              <motion.div variants={RISE} className="admin-queue-more flex items-center justify-between gap-3 px-4 pt-3">
                <p className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>
                  Showing{' '}
                  <span className="tabular-nums text-[#341512]">
                    {start + 1}–{start + shown.length}
                  </span>{' '}
                  of <span className="tabular-nums text-[#341512]">{items.length}</span>
                </p>
                {items.length > PAGE_SIZE && (
                  <div className="flex items-center gap-2">
                    {[
                      { label: 'Previous page of lawyers', d: 'm6 15 6-6 6 6', to: start - PAGE_SIZE, disabled: start === 0 },
                      { label: 'Next page of lawyers', d: 'm6 9 6 6 6-6', to: start + PAGE_SIZE, disabled: start + PAGE_SIZE >= items.length },
                    ].map((b) => (
                      <motion.button
                        key={b.label}
                        type="button"
                        aria-label={b.label}
                        title={b.label}
                        disabled={b.disabled}
                        onClick={() => setPageStart(b.to)}
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
            </>
          ) : (
            <motion.div
              key={`empty-${tab}-${query}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-10 text-center"
            >
              <span className="client-neu-well grid h-14 w-14 place-items-center rounded-full text-[#A8742E]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v17M8 20h8M4.5 7.5h15" />
                  <path d="M6.5 7.5 3.5 13.5a3 3 0 0 0 6 0l-3-6ZM17.5 7.5l-3 6a3 3 0 0 0 6 0l-3-6Z" />
                </svg>
              </span>
              <p className="font-lora text-[16px] font-semibold text-[#341512]">{emptyTitle}</p>
              <p className="max-w-[340px] font-inter text-[12px] leading-relaxed text-[#7D6855]">{query.trim() ? 'Check the spelling, or search in All Lawyers.' : tabMeta.hint}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2.5">
                {query.trim() && (
                  <NeuButton size="sm" onClick={() => setQuery('')}>
                    Clear search
                  </NeuButton>
                )}
                {tab !== 'all' && (
                  <NeuButton size="sm" variant="primary" onClick={() => changeTab('all')}>
                    Show all lawyers
                  </NeuButton>
                )}
              </div>
            </motion.div>
          )}
          <p className="sr-only" aria-live="polite">
            {items.length ? `${tabMeta.heading}: ${items.length} lawyers, showing ${start + 1} to ${start + shown.length}` : emptyTitle}
          </p>
        </motion.section>
      </motion.div>
    </MotionConfig>
  );
}

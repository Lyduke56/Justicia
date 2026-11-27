'use client';

import { useEntrance } from './table/kit';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { EmptyMedallion } from '@/components/shared/neu/EmptyMedallion';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { refreshAdminTabs } from '@/lib/live/adminRefresh';
import { reviewLawyerApplicationAction, type ReviewDecision } from '@/app/actions/adminLawyerReview';
import { ChevronLeftIcon, ChevronRightIcon, NeuAlert, NeuButton } from '@/components/shared/neu';
import { CARD_SLIDE, DRAW, EASE_OUT, EMBOSS, GROUP, PAGE, RISE, ROLL } from '@/components/lawyer/motion';
import { initials, waitedFor, LONG_WAIT_MS, stamp } from './overview/activity';
import { QueueToolbar } from './verification/QueueToolbar';
import { useFitRows } from './overview/useFitRows';
import { ApplicationDossier, CAPS } from './verification/ApplicationDossier';
import { ReviewDecisionModal } from './verification/ReviewDecisionModal';
import type { SubmissionResult } from '@/components/shared/feedback';
import { QUEUE_SORTS, QUEUE_TABS, matchesTab, statusMeta, visibleApplications, type LawyerQueueItem, type QueueSort, type QueueTab } from './verification/model';

export type { LawyerQueueItem } from './verification/model';

/**
 * Lawyer Verification Queue
 *  - Top: the lawyer Consultations toolbar design: status tabs, search and sort.
 *  - Left: the tab's heading and a ruled list of applications. On wide screens the column is
 *    exactly as tall as the dossier and shows the rows that fit; the chevrons below page through
 *    the rest (10 per page when the columns stack). The pressed-in selection glides to the row
 *    you pick (↑ / ↓ move it, turning the page when needed).
 *  - Right: the selected application as a formal dossier with the decision buttons; it slides
 *    the way you move through the list (‹ / › or ← / →).
 *
 * Entrance (replayed each time the tab is opened, like the lawyer screens): the toolbar embosses
 * and its rows rise, then the heading, list and dossier emboss and the list rows rise in order.
 */

const TONE_TEXT: Record<string, string> = {
  pending: 'text-[#A8742E]',
  info: 'text-[#34575E]',
  success: 'text-[#36522E]',
  danger: 'text-[#863B30]',
  neutral: 'text-[#645344]',
};

/** When the list rows start rising on the entrance (s); after it they rise straight away. */
const ROWS_AT_ENTRANCE = 0.62;
const ROW_STAGGER = 0.05;
/** Rows per page when the columns stack (below xl); side by side, the rows that fit. */
const PAGE_SIZE = 10;
/** Fixed row height (px) so the rows that fit can be counted; the gap is the 1px rule. */
const ROW_HEIGHT = 64;
const ROW_GAP = 1;

const XL = '(min-width: 1280px)';
const subscribeXl = (onChange: () => void) => {
  const media = window.matchMedia(XL);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

function RisingRow({ at, mountedAt, children }: { at: number; mountedAt: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [delay] = useState(() => Math.max(0, at - (performance.now() - mountedAt) / 1000));
  return (
    <motion.li
      layout="position"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE_OUT, delay } }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
    >
      {children}
    </motion.li>
  );
}

function ApplicationList({
  items,
  rowsAt,
  selectedId,
  now,
  onSelect,
  onKeyDown,
}: {
  items: LawyerQueueItem[];
  rowsAt: number;
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLUListElement>) => void;
}) {
  const [mountedAt] = useState(() => performance.now());
  return (
    <ul aria-label="Applications" onKeyDown={onKeyDown} className="admin-queue-list flex flex-col">
      <AnimatePresence mode="popLayout">
        {items.map((l, i) => {
          const selected = l.user_id === selectedId;
          const meta = statusMeta(l.verification_status);
          const pending = l.verification_status === 'pending' && l.submitted_at;
          const longWait = pending ? now - Date.parse(l.submitted_at!) >= LONG_WAIT_MS : false;
          const reviewed = !pending && l.reviewed_at ? stamp(l.reviewed_at, now) : null;
          return (
            <RisingRow key={l.user_id} at={rowsAt + Math.min(i, PAGE_SIZE) * ROW_STAGGER} mountedAt={mountedAt}>
              <button
                type="button"
                onClick={() => onSelect(l.user_id)}
                aria-current={selected ? 'true' : undefined}
                data-queue-row={l.user_id}
                style={{ height: ROW_HEIGHT }}
                className="admin-queue-row relative isolate grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] px-3 text-left"
              >
                {selected && (
                  <motion.span
                    layoutId="queue-row-selected"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    className="admin-queue-selected absolute inset-0 -z-10 rounded-[12px]"
                    aria-hidden
                  />
                )}
                <span className="admin-overview-badge grid h-9 w-9 place-items-center rounded-[10px] font-inter text-[11px] font-bold tracking-[0.06em] text-[#5C4535]" aria-hidden>
                  {initials(l.full_name || 'Applicant')}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate font-lora text-[14px] text-[#341512] ${selected ? 'font-bold' : 'font-semibold'}`}>{l.full_name || 'Attorney applicant'}</span>
                  <span className="mt-0.5 block truncate font-inter text-[11px] tabular-nums text-[#7D6855]">
                    Roll {l.roll_number || '—'}
                    {l.ibp_chapter ? ` · ${l.ibp_chapter}` : ''}
                  </span>
                </span>
                <span className="text-right font-inter tabular-nums">
                  {pending ? (
                    <>
                      <span className={`block text-[11.5px] font-semibold ${longWait ? 'text-[#A8742E]' : 'text-[#3E2A1E]'}`}>{waitedFor(l.submitted_at!, now)}</span>
                      <span className={`mt-0.5 block text-[9px] text-[#8A6A4C] ${CAPS}`}>Waiting</span>
                    </>
                  ) : (
                    <>
                      <span className={`block text-[9.5px] ${CAPS} ${TONE_TEXT[meta.tone]}`}>{meta.label}</span>
                      {reviewed && <span className="mt-1 block text-[10.5px] text-[#7D6855]">{reviewed.date}</span>}
                    </>
                  )}
                </span>
              </button>
            </RisingRow>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

export function LawyerVerificationQueue({ lawyers: initialLawyers }: { lawyers: LawyerQueueItem[] }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  // The entrance plays when the portal's loading screen lifts, and again on every visit.
  const { entranceKey, revealed, settled } = useEntrance(1200);

  // Server data (refreshed by the admin tab) with local, optimistic decisions on top.
  const [lawyers, setLawyers] = useState(initialLawyers);
  const [previousLawyers, setPreviousLawyers] = useState(initialLawyers);
  if (initialLawyers !== previousLawyers) {
    setPreviousLawyers(initialLawyers);
    setLawyers(initialLawyers);
  }
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const [tab, setTab] = useState<QueueTab>('pending');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<QueueSort>('action');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dir, setDir] = useState(1);
  const [pageStart, setPageStart] = useState(0);
  const resetLimit = () => setPageStart(0);
  const isXl = useSyncExternalStore(subscribeXl, () => window.matchMedia(XL).matches, () => false);
  const [listRef, fit] = useFitRows(ROW_HEIGHT, ROW_GAP, 220);
  const detailRef = useRef<HTMLElement>(null);

  const [review, setReview] = useState<{ lawyer: LawyerQueueItem; decision: ReviewDecision } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const counts = useMemo(
    () => Object.fromEntries(QUEUE_TABS.map((t) => [t.key, lawyers.filter((l) => matchesTab(l, t.key)).length])) as Record<QueueTab, number>,
    [lawyers]
  );
  const items = useMemo(() => visibleApplications(lawyers, tab, query, sort), [lawyers, tab, query, sort]);
  const picked = selectedId ? items.findIndex((l) => l.user_id === selectedId) : -1;
  const index = picked === -1 ? 0 : picked;
  const current = items[index] ?? null;
  const tabMeta = QUEUE_TABS.find((t) => t.key === tab)!;

  // The page of rows shown: as many as fit beside the dossier (xl), else PAGE_SIZE.
  const pageSize = isXl ? (fit ?? PAGE_SIZE) : PAGE_SIZE;
  const lastStart = Math.max(0, Math.floor((items.length - 1) / pageSize) * pageSize);
  const start = Math.min(Math.floor(pageStart / pageSize) * pageSize, lastStart);
  const shown = items.slice(start, start + pageSize);
  const pageOf = (i: number) => Math.floor(i / pageSize) * pageSize;

  const goTo = (next: number) => {
    if (next < 0 || next >= items.length || next === index) return;
    setDir(next > index ? 1 : -1);
    setSelectedId(items[next].user_id);
    // Moving past the shown rows (‹ / ›, ↓) turns the list to the selection's page.
    if (next < start || next >= start + pageSize) setPageStart(pageOf(next));
  };
  const select = (id: string) => {
    const next = items.findIndex((l) => l.user_id === id);
    if (next !== -1) goTo(next);
    if (!window.matchMedia('(min-width: 1280px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = index + (e.key === 'ArrowDown' ? 1 : -1);
    goTo(next);
    const target = items[Math.max(0, Math.min(items.length - 1, next))];
    // The row may only mount on the next render when the list turns to another page.
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-queue-row="${target.user_id}"]`)?.focus());
  };

  const changeTab = (next: QueueTab) => {
    setTab(next);
    setSelectedId(null);
    resetLimit();
  };

  /** Saves the decision; the dialog shows the loader, then the check or the X. */
  const confirmReview = async (note: string, exception?: string): Promise<SubmissionResult> => {
    if (!review) return { ok: false, error: 'Choose a decision first.' };
    const { lawyer, decision } = review;
    try {
      const res = await reviewLawyerApplicationAction(lawyer.user_id, decision, note, { exceptionReason: exception });
      if (res.error) return { ok: false, error: res.error };
      const trimmed = note.trim();
      setLawyers((prev) =>
        prev.map((item) =>
          item.user_id === lawyer.user_id
            ? {
                ...item,
                verification_status: decision,
                rejection_reason: decision === 'rejected' ? trimmed : null,
                admin_notes: decision === 'needs_resubmission' ? trimmed : null,
                reviewed_at: new Date().toISOString(),
              }
            : item
        )
      );
      setNotice(
        res.message ||
          (decision === 'approved'
            ? `${lawyer.full_name} is approved and now listed in Find a Lawyer.`
            : decision === 'rejected'
              ? `${lawyer.full_name}'s application was rejected.`
              : `Your request for more information was sent to ${lawyer.full_name}.`)
      );
      return { ok: true };
    } catch {
      return { ok: false, error: 'The decision could not be saved. Please try again.' };
    }
  };

  /** "Done" on the result card: close it and refresh the other admin tabs. */
  const finishReview = () => {
    setReview(null);
    refreshAdminTabs();
    router.refresh();
  };

  const rowsAt = settled ? 0 : ROWS_AT_ENTRANCE;
  const emptyTitle = query.trim() ? `No applications match “${query.trim()}”` : tabMeta.empty;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={entranceKey}
        variants={PAGE}
        initial={reduceMotion ? false : 'hidden'}
        animate={revealed ? 'show' : 'hidden'}
        className="lawyer-page admin-queue mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      >
        <h1 className="sr-only">Lawyer verification queue</h1>

        {/* ── Tabs, search, sort (the lawyer Consultations toolbar) ─────────── */}
        <motion.section variants={EMBOSS} aria-label="Filter applications" className="rounded-[24px] bg-[#E5D8CB] p-4 sm:p-5">
          <QueueToolbar
            tabs={QUEUE_TABS}
            tab={tab}
            counts={counts}
            onTab={changeTab}
            query={query}
            onQuery={(q) => {
              setQuery(q);
              setSelectedId(null);
              resetLimit();
            }}
            searchLabel="Search name, roll no., chapter or practice"
            sorts={QUEUE_SORTS}
            sort={sort}
            onSort={(next) => {
              setSort(next);
              resetLimit();
            }}
            sortLabel="Sort applications"
          />
        </motion.section>

        {/* Carved divider between the filters and the results (draws out from its centre). */}
        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto my-3 w-[78%] shrink-0" aria-hidden />

        <AnimatePresence initial={false}>
          {notice && (
            <NeuAlert key="notice" tone="success" onDismiss={() => setNotice(null)}>
              {notice}
            </NeuAlert>
          )}
        </AnimatePresence>

        <motion.div variants={GROUP} className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:gap-7">
          {/* ── Left: heading + application list ─────────────────────────────── */}
          {/* Side by side, the column's contents are positioned inside it so only the dossier sets
              the row's height; the list then shows the rows that fit. */}
          <motion.aside variants={GROUP} aria-label="Applications" className="relative xl:w-[380px] xl:shrink-0">
            <div className="flex flex-col gap-7 xl:absolute xl:inset-0">
            <motion.div
              variants={EMBOSS}
              className="flex h-11 shrink-0 items-center justify-between gap-3 rounded-[20px] pl-6 pr-2"
              style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
            >
              <span className="relative min-w-0 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.h2
                    key={tabMeta.heading}
                    variants={ROLL}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="truncate font-lora text-[15px] font-semibold tracking-[0.02em] text-[#341512]/85 sm:text-base"
                  >
                    {tabMeta.heading}
                  </motion.h2>
                </AnimatePresence>
              </span>
              <motion.span
                key={`${tab}-${items.length}`}
                initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                className="neu-inset-banner grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 font-inter text-[11px] font-bold tabular-nums text-[#341512]"
              >
                {items.length}
              </motion.span>
            </motion.div>

            <motion.div variants={EMBOSS} className="flex flex-col rounded-[24px] bg-[#E5D8CB] p-3 sm:p-4 xl:min-h-0 xl:flex-1">
              <motion.div variants={RISE} aria-hidden className={`flex shrink-0 items-end justify-between px-3 pb-3 text-[10px] text-[#B07A34] ${CAPS}`}>
                <span>Applicant</span>
                <span>{tab === 'pending' ? 'Waiting' : 'Status'}</span>
              </motion.div>
              <motion.div variants={RISE} className="lawyer-dash-groove mb-1 shrink-0" aria-hidden />
              {items.length ? (
                <>
                <div ref={listRef} className="xl:min-h-0 xl:flex-1 xl:overflow-hidden">
                  <ApplicationList
                    key={`${tab}|${sort}|${start}|${entranceKey}`}
                    items={shown}
                    rowsAt={rowsAt}
                    selectedId={current?.user_id ?? null}
                    now={now}
                    onSelect={select}
                    onKeyDown={onListKey}
                  />
                </div>
                {items.length > pageSize && (
                  <motion.div variants={RISE} className="admin-queue-more flex shrink-0 items-center justify-between gap-3 px-3 pt-3">
                    <p className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>
                      Showing{' '}
                      <span className="tabular-nums text-[#341512]">
                        {start + 1}–{start + shown.length}
                      </span>{' '}
                      of <span className="tabular-nums text-[#341512]">{items.length}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {[
                        { label: 'Previous page of applications', d: 'm6 15 6-6 6 6', to: start - pageSize, disabled: start === 0 },
                        { label: 'Next page of applications', d: 'm6 9 6 6 6-6', to: start + pageSize, disabled: start + pageSize >= items.length },
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
                  </motion.div>
                )}
                </>
              ) : (
                <motion.div
                  key={`empty-${tab}-${query}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-2 px-6 py-10 text-center"
                >
                  <p className="font-lora text-[14.5px] font-semibold text-[#341512]">{emptyTitle}</p>
                  <p className="max-w-[260px] font-inter text-[11.5px] leading-relaxed text-[#7D6855]">
                    {query.trim() ? 'Check the spelling, or search in All Applications.' : tabMeta.hint}
                  </p>
                </motion.div>
              )}
            </motion.div>
            </div>
          </motion.aside>

          {/* ── Right: the selected application ──────────────────────────────── */}
          <motion.section ref={detailRef} variants={GROUP} aria-label="Application dossier" className="flex min-w-0 flex-1 scroll-mt-6 flex-col gap-7 xl:min-h-[620px]">
            <motion.div variants={RISE} className="flex h-11 shrink-0 items-center justify-between gap-3 px-1">
              <p className={`text-[11px] text-[#5C4535] ${CAPS}`}>
                {current ? (
                  <>
                    Application <span className="tabular-nums text-[#341512]">{index + 1}</span> of <span className="tabular-nums text-[#341512]">{items.length}</span>
                  </>
                ) : (
                  'Application dossier'
                )}
              </p>
              <div className="flex items-center gap-2">
                {[
                  { label: 'Previous application', icon: <ChevronLeftIcon className="h-4 w-4" />, step: -1, disabled: !current || index === 0 },
                  { label: 'Next application', icon: <ChevronRightIcon className="h-4 w-4" />, step: 1, disabled: !current || index >= items.length - 1 },
                ].map((b) => (
                  <motion.button
                    key={b.label}
                    type="button"
                    aria-label={b.label}
                    title={b.label}
                    disabled={b.disabled}
                    onClick={() => goTo(index + b.step)}
                    whileHover={b.disabled ? undefined : { x: b.step * 2 }}
                    whileTap={b.disabled ? undefined : { scale: 0.86 }}
                    className="neu-raised-sm grid size-9 place-items-center rounded-full text-[#341512] transition-colors hover:text-[#C58B3C] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {b.icon}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={EMBOSS}
              tabIndex={current ? 0 : undefined}
              aria-label={current ? `${current.full_name}, application ${index + 1} of ${items.length}` : undefined}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'ArrowRight') goTo(index + 1);
                if (e.key === 'ArrowLeft') goTo(index - 1);
              }}
              className="lawyer-dash-surface overflow-hidden rounded-[28px] bg-[#E5D8CB] p-5 sm:p-6 lg:p-7 xl:flex-1"
            >
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                {current ? (
                  <motion.div key={current.user_id} custom={dir} variants={CARD_SLIDE} initial="enter" animate="center" exit="exit">
                    <ApplicationDossier lawyer={current} now={now} busy={false} onDecision={(decision) => setReview({ lawyer: current, decision })} />
                  </motion.div>
                ) : (
                  <motion.div
                    key={`empty-${tab}-${query}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center"
                  >
                    <EmptyMedallion
                      size="md"
                      className="mb-1"
                      icon={
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
                          <path d="m8.8 12 2.2 2.2 4.4-4.4" />
                        </svg>
                      }
                    />
                    <p className="font-lora text-[16px] font-semibold text-[#341512]">{emptyTitle}</p>
                    <p className="max-w-[320px] font-inter text-[12px] leading-relaxed text-[#7D6855]">{query.trim() ? 'Clear the search to see every application in this tab.' : tabMeta.hint}</p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2.5">
                      {query.trim() && (
                        <NeuButton size="sm" onClick={() => setQuery('')}>
                          Clear search
                        </NeuButton>
                      )}
                      {tab !== 'all' && (
                        <NeuButton size="sm" variant="primary" onClick={() => changeTab('all')}>
                          Show all applications
                        </NeuButton>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <p className="sr-only" aria-live="polite">
              {current ? `Showing ${current.full_name}, application ${index + 1} of ${items.length}` : emptyTitle}
            </p>
          </motion.section>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {review && (
          <ReviewDecisionModal
            key={`${review.lawyer.user_id}-${review.decision}`}
            lawyer={review.lawyer}
            decision={review.decision}
            onCancel={() => setReview(null)}
            onConfirm={confirmReview}
            onDone={finishReview}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

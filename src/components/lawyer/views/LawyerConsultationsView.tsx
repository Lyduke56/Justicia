'use client';

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type PanInfo } from 'motion/react';
import type { LawyerConsultation } from '@/app/actions/consultationActions';
import { fetchLive } from '@/lib/live/fetchLive';
import { useLiveRefresh, useViewActive } from '@/components/live/LiveProvider';
import { useScreenLoading, useScreenReveal } from '@/components/shared/loading';
import { CalendarIcon, EmptyState, NeuAlert, NeuButton } from '@/components/shared/neu';
import { parseIsoDate, startMsOf, todayInManila } from '@/lib/lawyer/dashboardSchedule';
import { isMissed, useLawyerConsultationActions } from '../useLawyerConsultationActions';
import { LawyerConsultationCard, type ConsultationCardHandlers } from '../LawyerConsultationCard';
import { CardPager, ConsultationCardLoader } from '../CardPager';
import { buildSampleConsultations } from '../sampleConsultations';
import { CARD_SLIDE, DRAW, EMBOSS, GROUP, PAGE, RISE, ROLL } from '../motion';
import { ConsultationsToolbar } from '../consultations/ConsultationsToolbar';
import { ConsultationCalendar } from '../consultations/ConsultationCalendar';
import { AppointmentList } from '../consultations/AppointmentList';
import {
  TABS,
  isoOfConsultation,
  matchesTab,
  visibleConsultations,
  type ConsultationTab,
  type SortKey,
} from '../consultations/model';

/**
 * Lawyer Consultations
 *  - Top: status tabs, client search and sort (filter everything below).
 *  - Below, the client Consultation Booking layout for the lawyer's side: on the left the tab's
 *    heading, a calendar of its consultations and the list for the chosen date; on the right one
 *    consultation at a time with its actions, paged with the dots, a swipe or ← / →.
 *    Picking a consultation moves the calendar to its date; picking a date shows its first one.
 *
 * Entrance (replayed each time the tab is opened, like the client's): the toolbar embosses and its
 * tabs rise, then the heading, calendar (its days wave in), list and card emboss in reading order.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// xl is where the two columns sit side by side and the card fills the column height.
const XL = '(min-width: 1280px)';
const subscribeXl = (cb: () => void) => {
  const mq = window.matchMedia(XL);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

function longDate(iso: string, today: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const label = `${WEEKDAYS[new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()]}, ${MONTHS_LONG[d.month]} ${d.day}`;
  return iso === today ? `Today · ${label}` : label;
}

export function LawyerConsultationsView({
  lawyerUserId,
}: {
  lawyerUserId?: string;
  lawyerName?: string;
} = {}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const isXl = useSyncExternalStore(subscribeXl, () => window.matchMedia(XL).matches, () => false);

  // The entrance plays when the portal's loading screen lifts (not underneath it), and again on
  // every visit: the reveal key remounts the animated layout; data and choices live above it.
  const { revealed, revealKey: entranceKey } = useScreenReveal();
  const viewActive = useViewActive();

  // ── Data ──
  const [records, setRecords] = useState<LawyerConsultation[]>([]);
  const [loaded, setLoaded] = useState(false);
  // The portal's loading screen stays up until the consultations are here.
  useScreenLoading(!loaded);
  const [error, setError] = useState<string | null>(null);
  const [samples] = useState(() => buildSampleConsultations());
  const [today] = useState(() => todayInManila());

  const load = useCallback(
    () =>
      fetchLive('lawyer-consultations')
        .then((data) => {
          setRecords(Array.isArray(data) ? data : []);
          setError(null);
        })
        .catch(() => setError('We could not load your consultations. They will refresh automatically.'))
        .finally(() => setLoaded(true)),
    []
  );
  useEffect(() => {
    void load();
  }, [load, lawyerUserId]);
  // New requests, payments and cancellations appear without reopening the tab.
  useLiveRefresh(['consultations', 'payments'], load, { fallbackMs: 30000 });

  const isDemo = !!lawyerUserId?.startsWith('demo-') && loaded && records.length === 0;
  const all = isDemo ? samples : records;

  // ── Filters & selection ──
  const [tab, setTab] = useState<ConsultationTab>('all');
  const [query, setQuery] = useState('');
  // Default: the soonest consultation first (the next one to happen).
  const [sort, setSort] = useState<SortKey>('upcoming');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Date chosen in the calendar; null follows the consultation shown. */
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  /** Month browsed in the calendar; null follows the chosen date. */
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [monthDir, setMonthDir] = useState(1);
  const [slideDir, setSlideDir] = useState(1);

  // ── Actions & modals (also loads attendance and cancellation requests) ──
  const actions = useLawyerConsultationActions({ consultations: all, reload: load });
  const { extrasFor } = actions;
  const missedOf = useCallback((c: LawyerConsultation) => isMissed(c, extrasFor(c.id)), [extrasFor]);
  const items = useMemo(() => visibleConsultations(all, tab, query, sort, today, missedOf), [all, tab, query, sort, today, missedOf]);
  const index = Math.max(0, selectedId ? items.findIndex((c) => c.id === selectedId) : 0);
  const current = items[index] ?? null;
  const selectedDate = pickedDate ?? (current ? isoOfConsultation(current) : today);
  const sel = parseIsoDate(selectedDate)!;
  const calendar = view ?? { year: sel.year, month: sel.month };

  const counts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = {} as Record<ConsultationTab, number | null>;
    for (const t of TABS) {
      result[t.key] = loaded ? all.filter((c) => matchesTab(c, t.key, missedOf(c)) && (!q || c.client.name.toLowerCase().includes(q))).length : null;
    }
    return result;
  }, [all, query, loaded, missedOf]);

  const dayCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of items) {
      const iso = isoOfConsultation(c);
      map[iso] = (map[iso] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const onDay = useCallback(
    (iso: string) =>
      items
        .filter((c) => isoOfConsultation(c) === iso)
        .map((c) => ({ c, start: startMsOf(c) }))
        .sort((a, b) => a.start - b.start)
        .map(({ c }) => c),
    [items]
  );
  const dayItems = useMemo(() => onDay(selectedDate), [onDay, selectedDate]);

  const moveCalendar = (year: number, month: number) => {
    const delta = year * 12 + month - (calendar.year * 12 + calendar.month);
    if (delta !== 0) setMonthDir(delta > 0 ? 1 : -1);
    setView({ year, month });
  };

  const show = (c: LawyerConsultation) => {
    const next = items.findIndex((x) => x.id === c.id);
    if (next !== index) setSlideDir(next > index ? 1 : -1);
    setSelectedId(c.id);
    setPickedDate(isoOfConsultation(c));
    moveCalendar(c.year, c.month);
  };

  const goTo = (i: number) => {
    if (i < 0 || i >= items.length || i === index) return;
    show(items[i]);
  };

  const selectDay = (iso: string) => {
    const d = parseIsoDate(iso)!;
    setPickedDate(iso);
    moveCalendar(d.year, d.month);
    const first = onDay(iso)[0];
    if (first && first.id !== current?.id) {
      const next = items.findIndex((x) => x.id === first.id);
      setSlideDir(next > index ? 1 : -1);
      setSelectedId(first.id);
    }
  };

  const stepMonth = (delta: number) => {
    setMonthDir(delta);
    const m = calendar.month + delta;
    setView({ year: calendar.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };

  const resetSelection = () => {
    setSelectedId(null);
    setPickedDate(null);
    setView(null);
  };

  const changeTab = (next: ConsultationTab) => {
    if (next === tab) return;
    setTab(next);
    resetSelection();
  };

  const changeQuery = (q: string) => {
    setQuery(q);
    const still = selectedId && visibleConsultations(all, tab, q, sort, today, missedOf).some((c) => c.id === selectedId);
    if (!still) resetSelection();
  };

  // ── Actions & modals ──
  // (created above, before the filters: the Missed tab needs its attendance data)
  const handlers: ConsultationCardHandlers = {
    onDetails: actions.openDetails,
    onMessage: actions.openMessages,
    onCancel: (c) => actions.openDecision('cancel', c.id),
    onJoin: actions.joinMeet,
    onDocuments: () => router.push('/lawyer/documents'),
    onApprove: (c) => actions.openDecision('approve', c.id),
    onDecline: (c) => actions.openDecision('decline', c.id),
    onReschedule: actions.openReschedule,
    onReviewCancellation: actions.openCancellationReview,
  };

  // ← / → page through consultations while this tab is shown, no dialog is open and focus isn't
  // in a text field.
  const { anyOpen } = actions;
  useEffect(() => {
    if (!viewActive || anyOpen || items.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onCardDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = info.offset.x + info.velocity.x * 0.2;
    if (swipe < -90) goTo(index + 1);
    else if (swipe > 90) goTo(index - 1);
  };

  const tabMeta = TABS.find((t) => t.key === tab)!;
  const dayTitle = (iso: string) =>
    onDay(iso)
      .map((c) => `${c.client.name} · ${c.timeRange}`)
      .join('\n');

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={entranceKey}
        variants={PAGE}
        initial={reduceMotion ? false : 'hidden'}
        animate={revealed ? 'show' : 'hidden'}
        className="lawyer-page mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      >
        {/* ── Tabs, search, sort ────────────────────────────────────────────── */}
        <motion.section variants={EMBOSS} aria-label="Filter consultations" className="rounded-[24px] bg-[#E5D8CB] p-4 sm:p-5">
          <ConsultationsToolbar
            tab={tab}
            counts={counts}
            onTab={changeTab}
            query={query}
            onQuery={changeQuery}
            sort={sort}
            onSort={setSort}
          />
        </motion.section>

        {isDemo && (
          <motion.p variants={RISE} className="-mt-4 font-inter text-[11px] text-[#7D6855]">
            Preview mode: these are sample consultations, so actions are read-only.
          </motion.p>
        )}

        <AnimatePresence initial={false}>
          {error && (
            <NeuAlert key="error" tone="error" onDismiss={() => setError(null)} action={<NeuButton size="sm" onClick={() => void load()}>Retry</NeuButton>}>
              {error}
            </NeuAlert>
          )}
        </AnimatePresence>

        {/* Same divider and spacing as the lawyer Dashboard (the page's 32px gap on each side). */}
        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto w-[78%]" aria-hidden />

        <motion.div variants={GROUP} className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:gap-7">
          {/* ── Left: heading, calendar, list for the chosen date ──────────── */}
          <motion.aside variants={GROUP} aria-label="Calendar" className="flex flex-col gap-5 xl:w-[320px] xl:shrink-0">
            <motion.div
              variants={EMBOSS}
              layout="size"
              className="flex h-11 items-center justify-between gap-3 rounded-[20px] pl-6 pr-2"
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
                className="neu-inset-banner grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 font-inter text-[11px] font-bold text-[#341512]"
              >
                {loaded ? items.length : '·'}
              </motion.span>
            </motion.div>

            <div className="grid gap-5 md:grid-cols-2 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
              <ConsultationCalendar
                year={calendar.year}
                month={calendar.month}
                dir={monthDir}
                today={today}
                selected={selectedDate}
                counts={dayCounts}
                dayTitle={dayTitle}
                onSelect={selectDay}
                onPrev={() => stepMonth(-1)}
                onNext={() => stepMonth(1)}
                onToday={() => selectDay(today)}
              />
              <AppointmentList
                dateKey={selectedDate}
                dateLabel={longDate(selectedDate, today)}
                items={dayItems}
                currentId={current?.id ?? null}
                emptyText={tab === 'all' ? 'No consultations on this date.' : `No ${tabMeta.label.toLowerCase()} consultations on this date.`}
                onSelect={show}
              />
            </div>
          </motion.aside>

          {/* ── Right: the consultation card + pager ─────────────────────────── */}
          <motion.section variants={GROUP} aria-label="Consultation" className="flex min-w-0 flex-1 flex-col gap-4">
            <AnimatePresence initial={false}>
              {actions.notice && (
                <NeuAlert key="notice" tone="success" onDismiss={actions.clearNotice}>
                  {actions.notice}
                </NeuAlert>
              )}
            </AnimatePresence>

            <motion.div
              variants={EMBOSS}
              className="flex flex-col overflow-hidden rounded-[28px] bg-[#E5D8CB] p-5 sm:p-6 lg:p-7 xl:min-h-0 xl:flex-1"
            >
              <AnimatePresence mode="wait" initial={false} custom={slideDir}>
                {!loaded ? (
                  <motion.div key="loading" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    <ConsultationCardLoader />
                  </motion.div>
                ) : !current ? (
                  <motion.div
                    key={`empty-${tab}-${query}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-1 items-center justify-center"
                  >
                    <EmptyState
                      icon={<CalendarIcon />}
                      title={query ? `No clients match “${query.trim()}”` : tabMeta.empty}
                      description={
                        query
                          ? 'Check the spelling, or search in All Inquiries.'
                          : tab === 'pending'
                            ? 'New consultation requests from clients will appear here for your approval.'
                            : 'Consultations will appear here as clients book with you.'
                      }
                      action={
                        <>
                          {query && (
                            <NeuButton size="sm" onClick={() => changeQuery('')}>
                              Clear search
                            </NeuButton>
                          )}
                          {tab !== 'all' && (
                            <NeuButton size="sm" variant="primary" onClick={() => changeTab('all')}>
                              Show all inquiries
                            </NeuButton>
                          )}
                        </>
                      }
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={current.id}
                    custom={slideDir}
                    variants={CARD_SLIDE}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    drag={items.length > 1 ? 'x' : false}
                    dragDirectionLock
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.22}
                    onDragEnd={onCardDragEnd}
                    className="flex touch-pan-y flex-col xl:min-h-0 xl:flex-1"
                  >
                    <LawyerConsultationCard c={current} fill={isXl} previewLines={6} extras={actions.extrasFor(current.id)} now={actions.now} {...handlers} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {items.length > 1 && (
              <motion.div variants={RISE}>
                <CardPager
                  layoutId="consult-pager-dot"
                  items={items.map((c) => ({ id: c.id, label: `${c.client.name}, ${c.dateLong}` }))}
                  index={index}
                  onGo={goTo}
                />
              </motion.div>
            )}
            <p className="sr-only" aria-live="polite">
              {current ? `Showing consultation ${index + 1} of ${items.length}: ${current.client.name}` : ''}
            </p>
          </motion.section>
        </motion.div>
      </motion.div>

      {actions.modals}
    </MotionConfig>
  );
}

export default LawyerConsultationsView;

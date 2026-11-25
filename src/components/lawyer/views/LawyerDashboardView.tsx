'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type PanInfo } from 'motion/react';
import type { LawyerConsultation } from '@/app/actions/consultationActions';
import { useLiveRefresh, useViewActive } from '@/components/live/LiveProvider';
import { CalendarIcon, EmptyState, NeuAlert, NeuButton } from '@/components/shared/neu';
import {
  buildSchedule,
  parseIsoDate,
  startMsOf,
  todayInManila,
  type LawyerDashboardStats,
  type LawyerScheduleData,
} from '@/lib/lawyer/dashboardSchedule';
import { fetchLawyerDashboardStats, fetchLawyerSchedule } from '@/lib/live/fetchLawyerDashboard';
import { useLawyerConsultationActions } from '../useLawyerConsultationActions';
import { DashboardDateFilter } from '../dashboard/DashboardDateFilter';
import { LawyerConsultationCard, type ConsultationCardHandlers } from '../LawyerConsultationCard';
import { CardPager, ConsultationCardSkeleton } from '../CardPager';
import { DashboardConsultationTable } from '../dashboard/DashboardConsultationTable';
import { buildSampleConsultations, buildSampleStats } from '../sampleConsultations';
import { MONTHS, emptyCopy, filterHeading, filterKey, filterRange, shortDate, type ScheduleFilter } from '../dashboard/filter';
import { CARD_SLIDE, DRAW, EMBOSS, GROUP, PAGE, RISE, ROLL, SWAP } from '../motion';
import { BarChartIcon, BriefcaseClockIcon, CalendarClockIcon, CountUp, KpiCard, StarCircleIcon, formatCount, formatPeso } from '../KpiCard';

/**
 * Lawyer Dashboard
 *  - KPI cards: today's sessions, pending requests, this month's earnings, rating (live data).
 *  - Schedule: the consultations of a chosen day or month (default: today), as compact cards
 *    (grid view, one at a time with a pager) or as a table (list view). Data comes from
 *    GET /api/live/lawyer-dashboard; the signed-out demo uses sample records.
 *
 * Entrance: the parchment "embosses" the page in reading order. KPI wells carve in and their
 * plates rise out of them while the figures count up, the divider draws from its centre, then
 * the heading, controls and the schedule card emboss and the card's contents settle in.
 */

type Layout = 'grid' | 'list';
const LAYOUT_KEY = 'justicia:lawyer:dashboard-layout';

// Grid / list is remembered per browser (a convenience only). Kept in memory as well, so the
// toggle still works when storage is blocked.
let memoryLayout: Layout | null = null;
const layoutListeners = new Set<() => void>();
function readLayout(): Layout {
  if (memoryLayout) return memoryLayout;
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}
function subscribeLayout(listener: () => void) {
  layoutListeners.add(listener);
  return () => {
    layoutListeners.delete(listener);
  };
}
function changeLayout(next: Layout) {
  memoryLayout = next;
  try {
    window.localStorage.setItem(LAYOUT_KEY, next);
  } catch {
    /* storage unavailable */
  }
  layoutListeners.forEach((l) => l());
}

// ─── Formatting ───────────────────────────────────────────────────────────────
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function earningsSubtitle(s: LawyerDashboardStats): string {
  if (s.monthEarnings == null || s.previousMonthEarnings == null) return 'Earnings are unavailable right now.';
  const prev = MONTHS[(s.month + 11) % 12];
  if (s.previousMonthEarnings === 0) {
    return s.monthEarnings > 0 ? `Nothing earned in ${prev} to compare.` : 'No paid sessions yet this month.';
  }
  const pct = Math.round(((s.monthEarnings - s.previousMonthEarnings) / s.previousMonthEarnings) * 100);
  if (pct > 0) return `Up ${pct}% from ${prev}.`;
  if (pct < 0) return `Down ${-pct}% from ${prev}.`;
  return `Same as ${prev}.`;
}

/** When the range includes today, the first consultation that hasn't finished (sessions are an hour). */
function firstUnfinished(data: LawyerScheduleData, f: ScheduleFilter): string | null {
  const range = filterRange(f);
  if (data.today < range.from || data.today > range.to) return null;
  const now = Date.now();
  return data.consultations.find((c) => c.status !== 'completed' && startMsOf(c) + 60 * 60_000 > now)?.id ?? null;
}

// ─── Grid / list toggle ───────────────────────────────────────────────────────
function LayoutToggle({ value, onChange }: { value: Layout; onChange: (next: Layout) => void }) {
  const options: Array<{ key: Layout; label: string; icon: React.ReactNode }> = [
    {
      key: 'list',
      label: 'List view',
      icon: (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      ),
    },
    {
      key: 'grid',
      label: 'Grid view',
      icon: (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <rect width="7" height="7" x="3" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="14" rx="1.5" />
          <rect width="7" height="7" x="3" y="14" rx="1.5" />
        </svg>
      ),
    },
  ];
  return (
    <div role="radiogroup" aria-label="Layout" className="client-neu-well flex h-10 shrink-0 gap-1 rounded-[12px] p-1">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <motion.button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.key)}
            whileTap={{ scale: 0.9 }}
            className={`relative isolate grid w-10 place-items-center rounded-[9px] transition-colors ${
              active ? 'text-[#341512]' : 'text-[#341512]/45 hover:text-[#341512]/75'
            }`}
          >
            {active && (
              <motion.span
                layoutId="dash-layout-thumb"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="client-neu-thumb absolute inset-0 -z-10 rounded-[9px]"
              />
            )}
            {o.icon}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── View ─────────────────────────────────────────────────────────────────────
export function LawyerDashboardView() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const viewActive = useViewActive();

  // The portal keeps tabs mounted (and preloads them hidden). Each time this tab becomes visible,
  // bump a key that remounts the animated layout so the entrance plays again; data, filter and
  // layout live in this component and are kept. (State adjusted during render.)
  const [wasActive, setWasActive] = useState(viewActive);
  const [entranceKey, setEntranceKey] = useState(0);
  if (viewActive !== wasActive) {
    setWasActive(viewActive);
    if (viewActive) setEntranceKey((k) => k + 1);
  }

  const [today, setToday] = useState(() => todayInManila());
  const [filter, setFilter] = useState<ScheduleFilter>(() => ({ scope: 'day', date: todayInManila() }));
  const layout = useSyncExternalStore(subscribeLayout, readLayout, () => 'grid' as Layout);
  const [schedule, setSchedule] = useState<LawyerScheduleData | null>(null);
  const [stats, setStats] = useState<LawyerDashboardStats | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  /** Filter key the shown schedule was loaded for; differs from the filter while loading. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== filterKey(filter);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Card grid view opens on when nothing was picked (set when a schedule loads). */
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [dir, setDir] = useState(1);
  const samples = useRef<LawyerConsultation[] | null>(null);
  const filterRef = useRef(filter);
  const requestId = useRef(0);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const loadSchedule = useCallback((f: ScheduleFilter = filterRef.current) => {
    const id = ++requestId.current;
    return fetchLawyerSchedule(filterRange(f))
      .then((fetched) => {
        if (id !== requestId.current) return;
        // No session: the demo preview filters its sample records with the same rules.
        const data = fetched ?? buildSchedule((samples.current ??= buildSampleConsultations()), filterRange(f));
        setIsDemo(!fetched);
        setSchedule(data);
        setToday(data.today);
        setDefaultId(firstUnfinished(data, f));
        setError(null);
      })
      .catch(() => {
        if (id === requestId.current) setError('We could not load your schedule. It will retry automatically.');
      })
      .finally(() => {
        if (id === requestId.current) setLoadedFor(filterKey(f));
      });
  }, []);

  const loadStats = useCallback(
    () =>
      fetchLawyerDashboardStats()
        .then((data) => setStats(data ?? buildSampleStats((samples.current ??= buildSampleConsultations()))))
        .catch(() => {
          // Keep the last figures; the next live refresh retries.
        }),
    []
  );

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    filterRef.current = filter;
    void loadSchedule(filter);
  }, [filter, loadSchedule]);

  const changeFilter = (next: ScheduleFilter) => {
    setSelectedId(null);
    setFilter(next);
  };

  const refreshAll = useCallback(() => {
    void loadSchedule();
    void loadStats();
  }, [loadSchedule, loadStats]);
  useLiveRefresh(['consultations', 'payments'], refreshAll, { fallbackMs: 60000 });

  const items = useMemo(() => schedule?.consultations ?? [], [schedule]);
  const actions = useLawyerConsultationActions({ consultations: items, reload: refreshAll });

  // Card shown in grid view: the one picked, else the default chosen on load, else the first.
  const pickedIndex = selectedId ? items.findIndex((c) => c.id === selectedId) : -1;
  const defaultIndex = defaultId ? items.findIndex((c) => c.id === defaultId) : -1;
  const index = pickedIndex !== -1 ? pickedIndex : Math.max(0, defaultIndex);
  const current = items[index] ?? null;

  const goTo = (next: number) => {
    if (next < 0 || next >= items.length || next === index) return;
    setDir(next > index ? 1 : -1);
    setSelectedId(items[next].id);
  };
  const onCardDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -400) goTo(index + 1);
    else if (info.offset.x > 70 || info.velocity.x > 400) goTo(index - 1);
  };

  const handlers: ConsultationCardHandlers = {
    onDetails: actions.openDetails,
    onMessage: actions.openMessages,
    onCancel: (c) => actions.openDecision('cancel', c.id),
    onJoin: actions.joinMeet,
    onDocuments: () => router.push('/lawyer/documents'),
    onReschedule: actions.openReschedule,
    onReviewCancellation: actions.openCancellationReview,
  };

  const range = filterRange(filter);
  const heading = filterHeading(filter, today);
  const empty = emptyCopy(filter, today);
  const activeDates = useMemo(() => schedule?.activeDates ?? {}, [schedule]);
  const nextDate = useMemo(
    () => Object.keys(activeDates).filter((d) => d > range.to && d >= today).sort()[0] ?? null,
    [activeDates, range.to, today]
  );
  const todayParts = parseIsoDate(today)!;

  const showTodaysSchedule = () => {
    changeFilter({ scope: 'day', date: today });
    scheduleRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const contentKey = !schedule ? 'skeleton' : items.length === 0 ? `empty-${filterKey(filter)}` : layout;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={entranceKey}
        variants={PAGE}
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        className="lawyer-dash mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      >
        {/* ── KPI cards ─────────────────────────────────────────────────────── */}
        <motion.section variants={GROUP} aria-label="Overview" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Today's Consultations"
            value={stats ? <CountUp value={stats.todayScheduled} format={formatCount} /> : null}
            subtitle={
              stats
                ? stats.todayScheduled === 0
                  ? 'Nothing scheduled for today.'
                  : stats.todayUpcoming === 0
                    ? 'No more sessions today.'
                    : `${stats.todayUpcoming} of ${stats.todayScheduled} still to come today.`
                : null
            }
            icon={<CalendarClockIcon className="h-10 w-10 shrink-0" />}
            onClick={showTodaysSchedule}
            actionLabel="View today's schedule"
          />
          <KpiCard
            label="Pending Requests"
            value={stats ? <CountUp value={stats.pendingRequests} format={formatCount} /> : null}
            subtitle={
              stats
                ? stats.pendingRequests === 0
                  ? 'You are all caught up.'
                  : `${plural(stats.pendingClients, 'client')} awaiting your approval.`
                : null
            }
            icon={<BriefcaseClockIcon className="h-10 w-10 shrink-0" />}
            onClick={() => router.push('/lawyer/consultations')}
            actionLabel="Review requests"
          />
          <KpiCard
            label={`${MONTHS[stats?.month ?? todayParts.month]}'s Earnings`}
            value={stats ? (stats.monthEarnings == null ? '—' : <CountUp value={stats.monthEarnings} format={formatPeso} />) : null}
            subtitle={stats ? earningsSubtitle(stats) : null}
            icon={<BarChartIcon className="h-10 w-10 shrink-0" />}
            onClick={() => router.push('/lawyer/earnings')}
            actionLabel="Open earnings"
          />
          <KpiCard
            label="Client Ratings"
            value={stats ? (stats.ratingAvg == null ? '—' : <CountUp value={stats.ratingAvg} format={(n) => n.toFixed(2)} />) : null}
            subtitle={
              stats
                ? stats.ratingAvg == null
                  ? 'No reviews yet.'
                  : `${plural(stats.ratingCount, 'review')}${stats.responseRate != null ? `, ${stats.responseRate}% response rate` : ''}.`
                : null
            }
            icon={<StarCircleIcon className="h-10 w-10 shrink-0" />}
            onClick={() => router.push('/lawyer/reviews')}
            actionLabel="Read reviews"
          />
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto w-[78%]" aria-hidden />

        {/* ── Schedule ──────────────────────────────────────────────────────── */}
        <motion.section variants={GROUP} ref={scheduleRef} aria-labelledby="dash-schedule-heading" className="flex scroll-mt-6 flex-col gap-6">
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
                    key={heading}
                    id="dash-schedule-heading"
                    variants={ROLL}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="truncate font-lora text-[15px] font-semibold tracking-[0.02em] text-[#341512]/85 sm:text-base"
                  >
                    {heading}
                  </motion.h2>
                </AnimatePresence>
              </span>
              <motion.span
                key={`${filterKey(filter)}-${items.length}`}
                initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                className="neu-inset-banner grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 font-inter text-[11px] font-bold text-[#341512]"
                aria-label={`${plural(items.length, 'consultation')}`}
              >
                {schedule ? items.length : '·'}
              </motion.span>
            </motion.div>

            <motion.div variants={RISE} className="flex items-center gap-3">
              <DashboardDateFilter value={filter} today={today} activeDates={activeDates} onChange={changeFilter} busy={loading && !!schedule} />
              <LayoutToggle value={layout} onChange={changeLayout} />
            </motion.div>
          </div>

          <AnimatePresence initial={false}>
            {error && (
              <NeuAlert key="error" tone="error" onDismiss={() => setError(null)} action={<NeuButton size="sm" onClick={refreshAll}>Retry</NeuButton>}>
                {error}
              </NeuAlert>
            )}
            {actions.notice && (
              <NeuAlert key="notice" tone="success" onDismiss={actions.clearNotice}>
                {actions.notice}
              </NeuAlert>
            )}
          </AnimatePresence>
          {isDemo && (
            <motion.p variants={RISE} className="-mt-2 font-inter text-[11px] text-[#7D6855]">
              Preview mode: these are sample consultations, so actions are read-only.
            </motion.p>
          )}

          {/* The embossed surface stays; its contents swap between card, table and empty. */}
          <motion.div
            variants={EMBOSS}
            aria-busy={loading}
            role={layout === 'grid' && items.length > 1 ? 'region' : undefined}
            aria-roledescription={layout === 'grid' && items.length > 1 ? 'carousel' : undefined}
            aria-label={layout === 'grid' && items.length > 1 ? heading : undefined}
            tabIndex={layout === 'grid' && items.length > 1 ? 0 : undefined}
            onKeyDown={(e) => {
              if (layout !== 'grid') return;
              if (e.key === 'ArrowRight') goTo(index + 1);
              if (e.key === 'ArrowLeft') goTo(index - 1);
            }}
            className={`lawyer-dash-surface overflow-hidden rounded-[28px] bg-[#E5D8CB] p-5 transition-opacity duration-200 sm:p-6 lg:p-7 ${
              loading && schedule ? 'opacity-70' : ''
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={contentKey} variants={SWAP} initial="enter" animate="center" exit="exit">
                {!schedule ? (
                  <ConsultationCardSkeleton />
                ) : items.length === 0 ? (
                  <EmptyState
                    icon={<CalendarIcon />}
                    title={empty.title}
                    description={empty.description}
                    action={
                      <>
                        {nextDate && (
                          <NeuButton size="sm" variant="primary" onClick={() => changeFilter({ scope: 'day', date: nextDate })}>
                            Next: {shortDate(nextDate, today)}
                          </NeuButton>
                        )}
                        {filter.scope === 'day' && (
                          <NeuButton
                            size="sm"
                            onClick={() => {
                              const d = parseIsoDate(filter.date)!;
                              changeFilter({ scope: 'month', year: d.year, month: d.month });
                            }}
                          >
                            See the whole month
                          </NeuButton>
                        )}
                      </>
                    }
                  />
                ) : layout === 'list' ? (
                  <DashboardConsultationTable
                    key={filterKey(filter)}
                    items={items}
                    showDate={range.from !== range.to}
                    today={today}
                    onDetails={handlers.onDetails}
                    onMessage={handlers.onMessage}
                    onJoin={handlers.onJoin}
                  />
                ) : (
                  current && (
                    <AnimatePresence mode="wait" initial={false} custom={dir}>
                      <motion.div
                        key={current.id}
                        custom={dir}
                        variants={CARD_SLIDE}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        drag={items.length > 1 ? 'x' : false}
                        dragDirectionLock
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.22}
                        onDragEnd={onCardDragEnd}
                        className="touch-pan-y"
                      >
                        <LawyerConsultationCard c={current} extras={actions.extrasFor(current.id)} now={actions.now} {...handlers} />
                      </motion.div>
                    </AnimatePresence>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Pager (grid view): the caramel dot glides to the card shown; swipe and ← / → work too. */}
          <AnimatePresence initial={false}>
            {layout === 'grid' && items.length > 1 && (
              <motion.div
                key="pager"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                className="-mt-1"
              >
                <CardPager
                  layoutId="dash-pager-dot"
                  items={items.map((c) => ({ id: c.id, label: `${c.client.name}, ${c.timeRange}` }))}
                  index={index}
                  onGo={goTo}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <p className="sr-only" aria-live="polite">
            {schedule && (items.length ? `${heading}: ${plural(items.length, 'consultation')}` : empty.title)}
          </p>
        </motion.section>
      </motion.div>

      {actions.modals}
    </MotionConfig>
  );
}

export default LawyerDashboardView;

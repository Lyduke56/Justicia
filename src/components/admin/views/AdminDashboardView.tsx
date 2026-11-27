'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { EmptyMedallion } from '@/components/shared/neu/EmptyMedallion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { useScreenLoading, useScreenReveal } from '@/components/shared/loading';
import { ChevronRightIcon } from '@/components/shared/neu';
import { getAdminOverviewData, type AdminOverviewData } from '@/app/actions/adminOverview';
import { CountUp, KpiCard, formatCount } from '@/components/lawyer/KpiCard';
import { DRAW, EASE_OUT, EMBOSS, GROUP, PAGE, RISE } from '@/components/lawyer/motion';
import { LONG_WAIT_MS, TONE_COLOR, describeActivity, initials, stamp, timeAgo, waitedFor, type ActivityEntry } from '../overview/activity';
import { ActivityIcon, PeopleIcon, QueueShieldIcon, ReportFlagIcon, ScalesIcon } from '../overview/OverviewIcons';
import { useFitLayout, useFitRows } from '../overview/useFitRows';

/**
 * Admin Overview, built like the lawyer Dashboard: four KPI wells (their plates emboss out
 * while the figures count up), a carved divider, then two embossed panels, the applications
 * waiting for review and the latest audit log activity.
 *
 * On desktop the page is exactly one screen tall: each panel shows as many rows as fit and
 * says how many more are waiting. Narrow or short windows flow and scroll instead.
 *
 * The tab's own data (getAdminDashboardData) paints first; getAdminOverviewData adds the KPI
 * notes, open reports and longer lists, and is re-read whenever the tab's data refreshes.
 */

type PendingLawyer = { user_id: string; full_name: string; roll_number: string; ibp_chapter: string | null };
type AuditEntry = { id: string; action: string; targetType?: string; timestamp: string };
type Props = {
  pendingLawyersCount: number;
  approvedLawyersCount: number;
  totalUsersCount: number;
  pendingLawyersPreview: PendingLawyer[];
  recentAuditEntries: AuditEntry[];
};

/** Tabs the admin shell switches between without a route load (same list as AdminTabs). */
const TAB_PATHS = new Set(['/admin/dashboard', '/admin/lawyers/verification-queue', '/admin/lawyers', '/admin/users', '/admin/settings/security-audit-log']);
const openTab = (href: string) => {
  if (href !== window.location.pathname) window.history.pushState(null, '', href);
};
const onTabNavigate = (href: string) => (event: { preventDefault: () => void }) => {
  if (!TAB_PATHS.has(href)) return;
  event.preventDefault();
  openTab(href);
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Row sizes for fitting the panels (px). Rows are fixed height so the count is exact; the
// gap is the 1px rule between rows.
const APP_ROW = 56;
const ACTIVITY_ROW = 56;
const ROW_GAP = 1;

// Table columns (fixed widths so every row and the header line up). The applications table
// adds a Roll No. column once its panel is wide enough (container query on the panel
// surface); below that the roll number joins the second line.
const APP_COLS = 'grid-cols-[minmax(0,1fr)_96px_14px] @[30rem]:grid-cols-[minmax(0,1fr)_92px_96px_14px]';
const ACTIVITY_COLS = 'grid-cols-[minmax(0,1fr)_92px_14px]';
/** Formal small-caps label used for the KPI titles, panel headings and column headers. */
const CAPS = 'font-inter font-semibold uppercase tracking-[0.14em]';
/** Rows shown when the page flows (phones, short windows) or before the list is measured. */
const FLOW_ROWS = 5;
/**
 * When each list's rows start rising (s after the page mounts): once its panel has embossed,
 * following the PAGE → GROUP → EMBOSS stagger. Rows time themselves from their list's mount
 * instead of joining the parent's stagger, so rows that arrive later (the longer lists, or a
 * re-measure) still land after the rows above them rather than popping in first.
 */
const APPS_ROWS_AT = 0.7;
const ACTIVITY_ROWS_AT = 0.84;
const ROW_STAGGER = 0.06;

// ─── Panel pieces ─────────────────────────────────────────────────────────────
function RowList<T>({ listRef, rowsAt, items, itemKey, render }: {
  listRef: (el: HTMLElement | null) => void;
  rowsAt: number;
  items: T[];
  itemKey: (item: T) => string;
  render: (item: T) => ReactNode;
}) {
  const [mountedAt] = useState(() => performance.now());
  return (
    <ul ref={listRef} className="admin-overview-list flex flex-col">
      {items.map((item, index) => (
        <RisingRow key={itemKey(item)} at={rowsAt + index * ROW_STAGGER} mountedAt={mountedAt}>
          {render(item)}
        </RisingRow>
      ))}
    </ul>
  );
}

function RisingRow({ at, mountedAt, children }: { at: number; mountedAt: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  // Seconds left until this row's slot; 0 for rows added after the entrance (a refresh).
  const [delay] = useState(() => Math.max(0, at - (performance.now() - mountedAt) / 1000));
  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.li>
  );
}

function PanelHeading({ id, title, count, action }: { id: string; title: string; count?: number; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <motion.div
        variants={EMBOSS}
        className={`inline-flex h-11 min-w-0 items-center gap-3 rounded-[20px] pl-6 ${count === undefined ? 'pr-6' : 'pr-2'}`}
        style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
      >
        <h2 id={id} className={`truncate text-[12px] text-[#341512]/85 sm:text-[12.5px] ${CAPS}`}>
          {title}
        </h2>
        {count !== undefined && (
          <motion.span
            key={count}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="neu-inset-banner grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 font-inter text-[11px] font-bold tabular-nums text-[#341512]"
          >
            {count}
          </motion.span>
        )}
      </motion.div>
      <motion.div variants={RISE} className="shrink-0">
        {action}
      </motion.div>
    </div>
  );
}

function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      onNavigate={onTabNavigate(href)}
      className="neu-raised-sm inline-flex h-9 items-center gap-1.5 rounded-xl px-4 font-inter text-[11.5px] font-semibold text-[#341512] transition-[translate,color] duration-200 hover:-translate-y-0.5 hover:text-[#A8742E] active:translate-y-0"
    >
      {children}
      <ChevronRightIcon className="h-3.5 w-3.5" />
    </Link>
  );
}

function PanelEmpty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <motion.div variants={RISE} className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 px-6 text-center">
      <EmptyMedallion size="sm" icon={icon} />
      <p className="font-lora text-[15px] font-semibold text-[#341512]">{title}</p>
      <p className="max-w-[260px] font-inter text-xs leading-relaxed text-[#7D6855]">{description}</p>
    </motion.div>
  );
}

/** Column labels over a panel's rows, ruled off with the carved groove (as the lawyer table). */
function TableHead({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <motion.div variants={RISE} aria-hidden className="shrink-0">
      <div className={`grid items-end gap-x-4 px-3 pb-3 text-[10px] text-[#B07A34] ${CAPS} ${cols}`}>{children}</div>
      <div className="lawyer-dash-groove" />
    </motion.div>
  );
}

/** "+3 more waiting": shown under a list when some rows did not fit. */
function MoreLine({ children }: { children: ReactNode }) {
  return (
    <motion.p variants={RISE} className="admin-overview-more shrink-0 px-3 pt-2.5 font-inter text-[11px] font-medium text-[#7D6855]">
      {children}
    </motion.p>
  );
}

// ─── View ─────────────────────────────────────────────────────────────────────
export function AdminDashboardView({ pendingLawyersCount, approvedLawyersCount, totalUsersCount, pendingLawyersPreview, recentAuditEntries }: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const fitLayout = useFitLayout();

  // The entrance plays when the portal's loading screen lifts (not underneath it), and again on
  // every visit: the reveal key remounts the animated layout.
  const { revealed, revealKey: entranceKey } = useScreenReveal();

  const [extra, setExtra] = useState<AdminOverviewData | null>(null);
  const [extraFailed, setExtraFailed] = useState(false);
  // The loading screen also waits for the overview figures (or their failure).
  useScreenLoading(!extra && !extraFailed);
  const [now, setNow] = useState(() => Date.now());

  // Re-read the extras whenever the tab's own data reloads (it polls and listens for admin edits).
  useEffect(() => {
    let cancelled = false;
    getAdminOverviewData()
      .then((data) => {
        if (cancelled) return;
        setExtra(data);
        setExtraFailed(false);
      })
      .catch(() => {
        if (!cancelled) setExtraFailed(true);
      })
      .finally(() => {
        if (!cancelled) setNow(Date.now());
      });
    return () => {
      cancelled = true;
    };
  }, [pendingLawyersPreview, recentAuditEntries]);

  const applications = extra?.applications ?? pendingLawyersPreview.map((p) => ({ ...p, submitted_at: null as string | null }));
  const activity: ActivityEntry[] =
    extra?.activity ??
    recentAuditEntries.map((e) => ({ id: e.id, action: e.action, targetType: e.targetType ?? null, targetId: null, details: {}, actorName: null, timestamp: e.timestamp }));

  const [appListRef, appFit] = useFitRows(APP_ROW, ROW_GAP);
  const [activityListRef, activityFit] = useFitRows(ACTIVITY_ROW, ROW_GAP);
  const appCount = fitLayout ? (appFit ?? FLOW_ROWS) : FLOW_ROWS;
  const activityCount = fitLayout ? (activityFit ?? FLOW_ROWS) : FLOW_ROWS + 1;
  const shownApps = applications.slice(0, appCount);
  const shownActivity = activity.slice(0, activityCount);
  const appsNotShown = Math.max(0, pendingLawyersCount - shownApps.length);

  // ── KPI notes (the inline loader until the extras load; a plain note if they fail) ──
  const waiting = (() => {
    if (pendingLawyersCount === 0) return 'The queue is clear.';
    if (extra?.oldestPendingAt) return `Oldest has waited ${waitedFor(extra.oldestPendingAt, now)}.`;
    return extra || extraFailed ? `${plural(pendingLawyersCount, 'application')} to check.` : null;
  })();
  const approved = extra
    ? extra.approvedLast30Days === 0
      ? 'None approved in 30 days.'
      : `${extra.approvedLast30Days} approved in 30 days.`
    : extraFailed
      ? 'Listed in the directory.'
      : null;
  const users = extra
    ? `${plural(extra.users.client, 'client')} · ${plural(extra.users.lawyer, 'lawyer')}`
    : extraFailed
      ? 'Across all roles.'
      : null;
  const reports = extra?.reports;
  const openReports = reports ? reports.open + reports.underReview : null;
  const reportsNote = reports
    ? openReports === 0
      ? 'Nothing needs a decision.'
      : reports.underReview > 0
        ? `${reports.underReview} in review, ${reports.open} not started.`
        : `${plural(reports.open, 'report')} not yet reviewed.`
    : extra || extraFailed
      ? 'Unavailable right now.'
      : null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={entranceKey}
        variants={PAGE}
        initial={reduceMotion ? false : 'hidden'}
        animate={revealed ? 'show' : 'hidden'}
        className="lawyer-dash admin-overview mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      >
        <h1 className="sr-only">Platform overview</h1>

        {/* ── KPI cards ─────────────────────────────────────────────────────── */}
        <motion.section variants={GROUP} aria-label="Platform figures" className="grid shrink-0 grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Awaiting Review"
            singleLine
            value={<CountUp value={pendingLawyersCount} format={formatCount} />}
            subtitle={waiting}
            icon={<QueueShieldIcon className="h-10 w-10 shrink-0" />}
            onClick={() => openTab('/admin/lawyers/verification-queue')}
            actionLabel="Open verification queue"
          />
          <KpiCard
            label="Approved Lawyers"
            singleLine
            value={<CountUp value={approvedLawyersCount} format={formatCount} />}
            subtitle={approved}
            icon={<ScalesIcon className="h-10 w-10 shrink-0" />}
            onClick={() => openTab('/admin/lawyers')}
            actionLabel="Open lawyer directory"
          />
          <KpiCard
            label="Registered Users"
            singleLine
            value={<CountUp value={totalUsersCount} format={formatCount} />}
            subtitle={users}
            icon={<PeopleIcon className="h-10 w-10 shrink-0" />}
            onClick={() => openTab('/admin/users')}
            actionLabel="Open user accounts"
          />
          <KpiCard
            label="Open Reports"
            singleLine
            value={extra ? (openReports === null ? '—' : <CountUp value={openReports} format={formatCount} />) : extraFailed ? '—' : null}
            subtitle={reportsNote}
            icon={<ReportFlagIcon className="h-10 w-10 shrink-0" />}
            onClick={() => router.push('/admin/reports')}
            actionLabel="Open reports"
          />
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto w-[78%] shrink-0" aria-hidden />

        {/* ── Panels ────────────────────────────────────────────────────────── */}
        <div className="admin-overview-panels grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-7">
          <motion.section variants={GROUP} aria-labelledby="overview-applications-heading" className="admin-overview-section flex min-h-0 min-w-0 flex-col gap-7">
            <PanelHeading
              id="overview-applications-heading"
              title="Applications to Review"
              count={pendingLawyersCount}
              action={<HeaderLink href="/admin/lawyers/verification-queue">View queue</HeaderLink>}
            />
            <motion.div variants={EMBOSS} className="admin-overview-surface @container flex min-h-0 flex-1 flex-col rounded-[24px] bg-[#E5D8CB] px-4 pb-3 pt-5 sm:px-5">
              {shownApps.length === 0 ? (
                <PanelEmpty
                  icon={<QueueShieldIcon className="h-6 w-6" />}
                  title="The queue is clear"
                  description="New lawyer applications will appear here as soon as they are submitted."
                />
              ) : (
                <>
                  <TableHead cols={APP_COLS}>
                    <span>Applicant</span>
                    <span className="hidden @[30rem]:block">Roll No.</span>
                    <span className="text-right">Waiting</span>
                    <span />
                  </TableHead>
                  <RowList
                    listRef={appListRef}
                    rowsAt={APPS_ROWS_AT}
                    items={shownApps}
                    itemKey={(lawyer) => lawyer.user_id}
                    render={(lawyer) => {
                      const submitted = lawyer.submitted_at ? stamp(lawyer.submitted_at, now) : null;
                      const waited = lawyer.submitted_at ? waitedFor(lawyer.submitted_at, now) : null;
                      const longWait = lawyer.submitted_at ? now - Date.parse(lawyer.submitted_at) >= LONG_WAIT_MS : false;
                      return (
                        <Link
                          href={`/admin/lawyers/${lawyer.user_id}?from=overview`}
                          aria-label={`Review ${lawyer.full_name}, roll ${lawyer.roll_number}${waited ? `, waiting ${waited}` : ''}`}
                          className={`admin-overview-row grid items-center gap-x-4 px-3 ${APP_COLS}`}
                          style={{ height: APP_ROW }}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="admin-overview-badge grid h-9 w-9 shrink-0 place-items-center rounded-[10px] font-inter text-[11px] font-bold tracking-[0.06em] text-[#5C4535]" aria-hidden>
                              {initials(lawyer.full_name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-lora text-[14.5px] font-semibold text-[#341512]">{lawyer.full_name}</span>
                              <span className="mt-0.5 block truncate font-inter text-[11px] text-[#7D6855]">
                                <span className="tabular-nums @[30rem]:hidden">
                                  Roll {lawyer.roll_number}
                                  {lawyer.ibp_chapter ? ' · ' : ''}
                                </span>
                                {lawyer.ibp_chapter ?? <span className="hidden @[30rem]:inline">No IBP chapter given</span>}
                              </span>
                            </span>
                          </span>
                          <span className="hidden truncate font-inter text-[12px] tabular-nums text-[#3E2A1E] @[30rem]:block">{lawyer.roll_number}</span>
                          <span className="text-right font-inter tabular-nums">
                            {submitted && waited ? (
                              <>
                                <span className={`block text-[12px] font-semibold ${longWait ? 'text-[#A8742E]' : 'text-[#3E2A1E]'}`}>{waited}</span>
                                <span className="mt-0.5 block text-[10.5px] text-[#7D6855]" title={submitted.full}>
                                  since {submitted.date}
                                </span>
                              </>
                            ) : (
                              <span className="text-[12px] text-[#7D6855]">—</span>
                            )}
                          </span>
                          <ChevronRightIcon className="admin-overview-go h-3.5 w-3.5 text-[#B07A34]" />
                        </Link>
                      );
                    }}
                  />
                  {appsNotShown > 0 && <MoreLine>+{plural(appsNotShown, 'more application')} in the queue.</MoreLine>}
                </>
              )}
            </motion.div>
          </motion.section>

          <motion.section variants={GROUP} aria-labelledby="overview-activity-heading" className="admin-overview-section flex min-h-0 min-w-0 flex-col gap-7">
            <PanelHeading
              id="overview-activity-heading"
              title="Recent Activity"
              action={<HeaderLink href="/admin/settings/security-audit-log">View audit log</HeaderLink>}
            />
            <motion.div variants={EMBOSS} className="admin-overview-surface flex min-h-0 flex-1 flex-col rounded-[24px] bg-[#E5D8CB] px-4 pb-3 pt-5 sm:px-5">
              {shownActivity.length === 0 ? (
                <PanelEmpty
                  icon={<ActivityIcon name="pulse" className="h-6 w-6" />}
                  title="No activity yet"
                  description="Reviews, reports and account changes will be listed here."
                />
              ) : (
                <>
                  <TableHead cols={ACTIVITY_COLS}>
                    <span>Event</span>
                    <span className="text-right">Date &amp; time</span>
                    <span />
                  </TableHead>
                  <RowList
                    listRef={activityListRef}
                    rowsAt={ACTIVITY_ROWS_AT}
                    items={shownActivity}
                    itemKey={(entry) => entry.id}
                    render={(entry) => {
                      const line = describeActivity(entry);
                      const at = stamp(entry.timestamp, now);
                      const body = (
                        <>
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="admin-overview-badge grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ color: TONE_COLOR[line.tone] }} aria-hidden>
                              <ActivityIcon name={line.icon} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-lora text-[14.5px] font-semibold text-[#341512]">{line.title}</span>
                              <span className="mt-0.5 block truncate font-inter text-[11px] text-[#7D6855]">
                                <span className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{line.category}</span>
                                {entry.actorName ? ` · ${entry.actorName}` : ''}
                              </span>
                            </span>
                          </span>
                          <time dateTime={entry.timestamp} title={`${at.full} (${timeAgo(entry.timestamp, now)})`} className="text-right font-inter tabular-nums">
                            <span className="block text-[12px] font-semibold text-[#3E2A1E]">{at.date}</span>
                            <span className="mt-0.5 block text-[10.5px] text-[#7D6855]">{at.time}</span>
                          </time>
                        </>
                      );
                      return line.href ? (
                        <Link
                          href={line.href}
                          onNavigate={onTabNavigate(line.href)}
                          className={`admin-overview-row grid items-center gap-x-4 px-3 ${ACTIVITY_COLS}`}
                          style={{ height: ACTIVITY_ROW }}
                        >
                          {body}
                          <ChevronRightIcon className="admin-overview-go h-3.5 w-3.5 text-[#B07A34]" />
                        </Link>
                      ) : (
                        <div className={`grid items-center gap-x-4 px-3 ${ACTIVITY_COLS}`} style={{ height: ACTIVITY_ROW }}>
                          {body}
                          <span />
                        </div>
                      );
                    }}
                  />
                </>
              )}
            </motion.div>
          </motion.section>
        </div>
      </motion.div>
    </MotionConfig>
  );
}

export default AdminDashboardView;

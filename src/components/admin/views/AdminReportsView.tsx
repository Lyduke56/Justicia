'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { getAdminReportsData } from '@/app/actions/reportActions';
import { MAX_SUSPENSIONS } from '@/lib/moderation/constants';
import type { AdminReportItem } from '@/types/admin';
import { ChevronRightIcon, InfoIcon, NeuAlert, NeuButton } from '@/components/shared/neu';
import { DRAW, EMBOSS, PAGE, RISE } from '@/components/lawyer/motion';
import { stamp } from '@/components/admin/overview/activity';
import { QueueToolbar } from '@/components/admin/verification/QueueToolbar';
import { PAGE_FRAME, ROW_HEIGHT, RefreshGlyph, TableBand, TableEmpty, TablePager, TableRows, ToolbarButton, pageOf, rowClass, useEntrance } from '@/components/admin/table/kit';
import { ACCOUNT_STATUS, REPORT_SORTS, REPORT_STATUS, REPORT_TABS, isOpenReport, matchesReportTab, visibleReports, type ReportSort, type ReportTab } from '@/components/admin/reports/model';
import { OffenseMeter } from '@/components/admin/reports/OffenseMeter';
import { ReportReviewModal } from '@/components/admin/reports/ReportReviewModal';

/**
 * Reports, in the same design as the Lawyer Directory: the Consultations-style toolbar (status
 * tabs, search, sort, refresh), a carved divider, then a structured table of reports. A row
 * opens the report in the shared modal to review the proof and decide.
 */

/*
 * Columns, shared by the header band and the rows:
 *   narrow:  Reported account · Status
 *   44rem:   + Reason
 *   60rem:   + Reported by · Offenses · Submitted
 */
const COLS = [
  'grid-cols-[minmax(0,1fr)_auto_14px]',
  '@[44rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_108px_14px]',
  '@[60rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_92px_92px_108px_14px]',
].join(' ');
const REASON = 'hidden @[44rem]:block';
const WIDE = 'hidden @[60rem]:block';

type StatusFilter = ReportTab;

export function AdminReportsView({
  initialReports = [],
  initialSelectedId = null,
  initialFilter = 'open',
}: {
  initialReports?: AdminReportItem[];
  initialSelectedId?: string | null;
  initialFilter?: StatusFilter;
}) {
  const reduceMotion = useReducedMotion();
  const { entranceKey, revealed, rowsAt } = useEntrance();
  const [now] = useState(() => Date.now());

  const [reports, setReports] = useState(initialReports);
  const [tab, setTab] = useState<ReportTab>(initialFilter);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ReportSort>('newest');
  const [pageStart, setPageStart] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const counts = useMemo(() => Object.fromEntries(REPORT_TABS.map((t) => [t.key, reports.filter((r) => matchesReportTab(r, t.key)).length])) as Record<ReportTab, number>, [reports]);
  const items = useMemo(() => visibleReports(reports, tab, query, sort), [reports, tab, query, sort]);
  const { start, shown } = pageOf(items, pageStart);
  const tabMeta = REPORT_TABS.find((t) => t.key === tab)!;
  const emptyTitle = query.trim() ? `No reports match “${query.trim()}”` : tabMeta.empty;
  const changeTab = (next: ReportTab) => {
    setTab(next);
    setPageStart(0);
  };

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      setReports(await getAdminReportsData());
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div key={entranceKey} variants={PAGE} initial={reduceMotion ? false : 'hidden'} animate={revealed ? 'show' : 'hidden'} className={`${PAGE_FRAME} admin-reports`}>
        <h1 className="sr-only">Reports</h1>

        <motion.section variants={EMBOSS} aria-label="Filter reports" className="rounded-[24px] bg-[#E5D8CB] p-4 sm:p-5">
          <QueueToolbar
            tabs={REPORT_TABS}
            tab={tab}
            counts={counts}
            onTab={changeTab}
            query={query}
            onQuery={(q) => {
              setQuery(q);
              setPageStart(0);
            }}
            searchLabel="Search account, reporter or reason"
            sorts={REPORT_SORTS}
            sort={sort}
            onSort={(next) => {
              setSort(next);
              setPageStart(0);
            }}
            sortLabel="Sort reports"
            tabsLabel="Report status"
            idPrefix="reports"
            extra={
              <ToolbarButton icon={<RefreshGlyph />} onClick={refresh} busy={refreshing} label="Refresh reports">
                {refreshing ? 'Refreshing' : 'Refresh'}
              </ToolbarButton>
            }
          />
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto my-3 w-[78%] shrink-0" aria-hidden />

        <AnimatePresence initial={false}>
          {refreshError && (
            <NeuAlert key="refresh-error" tone="error" onDismiss={() => setRefreshError(false)} action={<NeuButton size="sm" onClick={refresh}>Retry</NeuButton>}>
              The reports could not be refreshed. The records below are from the previous load.
            </NeuAlert>
          )}
        </AnimatePresence>

        <motion.section variants={EMBOSS} aria-label={tabMeta.heading} className="@container rounded-[24px] bg-[#E5D8CB] p-3 sm:p-4">
          {items.length ? (
            <>
              <TableBand cols={COLS}>
                <span>Reported account</span>
                <span className={REASON}>Reason</span>
                <span className={WIDE}>Reported by</span>
                <span className={WIDE}>Offenses</span>
                <span className={WIDE}>Submitted</span>
                <span>Status</span>
                <span />
              </TableBand>
              <div className="mt-1.5">
                <TableRows
                  key={`${tab}|${sort}|${start}|${entranceKey}`}
                  label="Reports"
                  items={shown}
                  itemKey={(r) => r.id}
                  rowsAt={rowsAt}
                  render={(r) => {
                    const status = REPORT_STATUS[r.status];
                    const account = ACCOUNT_STATUS[r.target.accountStatus];
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        aria-label={`Report about ${r.target.name}: ${r.reasonLabel}, ${status.label}. ${isOpenReport(r) ? 'Review' : 'View details'}`}
                        className={rowClass(COLS)}
                        style={{ height: ROW_HEIGHT }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-lora text-[14px] font-semibold text-[#341512]">{r.target.name}</span>
                          <span className="block truncate font-inter text-[11px] text-[#7D6855]">
                            <span className="capitalize">{r.target.role}</span>
                            {r.target.accountStatus !== 'active' && <span className={`font-semibold ${account.text}`}> · {account.label}</span>}
                          </span>
                        </span>
                        <span className={`${REASON} min-w-0`}>
                          <span className="block truncate font-inter text-[12px] font-semibold text-[#3E2A1E]">{r.reasonLabel}</span>
                          <span className="block truncate font-inter text-[11px] text-[#7D6855]">{r.details || 'No details'}</span>
                        </span>
                        <span className={`${WIDE} min-w-0`}>
                          <span className="block truncate font-inter text-[12px] text-[#3E2A1E]">{r.reporter.name}</span>
                          <span className="block truncate font-inter text-[11px] capitalize text-[#7D6855]">{r.reporter.role}</span>
                        </span>
                        <span className={WIDE}>
                          <OffenseMeter count={r.target.suspensionCount} terminated={r.target.accountStatus === 'terminated'} showLabel={false} />
                        </span>
                        <span className={`${WIDE} font-inter text-[12px] tabular-nums text-[#3E2A1E]`} title={stamp(r.createdAt, now).full}>
                          {stamp(r.createdAt, now).date}
                        </span>
                        <span>
                          <span className={`admin-pill ${status.pill}`}>{status.label}</span>
                        </span>
                        <ChevronRightIcon className="admin-overview-go h-3.5 w-3.5 text-[#B07A34]" />
                      </button>
                    );
                  }}
                />
              </div>
              <TablePager start={start} shownCount={shown.length} total={items.length} noun="reports" onPage={setPageStart} />
            </>
          ) : (
            <TableEmpty
              emptyKey={`empty-${tab}-${query}`}
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
                </svg>
              }
              title={emptyTitle}
              hint={query.trim() ? 'Check the spelling, or search in All Reports.' : tabMeta.hint}
              actions={
                <>
                  {query.trim() && (
                    <NeuButton size="sm" onClick={() => setQuery('')}>
                      Clear search
                    </NeuButton>
                  )}
                  {tab !== 'all' && (
                    <NeuButton size="sm" variant="primary" onClick={() => changeTab('all')}>
                      Show all reports
                    </NeuButton>
                  )}
                </>
              }
            />
          )}
          <p className="sr-only" aria-live="polite">
            {items.length ? `${tabMeta.heading}: ${items.length} reports, showing ${start + 1} to ${start + shown.length}` : emptyTitle}
          </p>
        </motion.section>

        <motion.p variants={RISE} className="-mt-3 flex items-start gap-2 px-1 font-inter text-[11.5px] leading-relaxed text-[#7D6855]">
          <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0 text-[#C58B3C]" />
          Each account can be suspended {MAX_SUSPENSIONS} times; the next upheld report terminates it. Suspended and terminated accounts are signed out and their consultations in that time are cancelled.
        </motion.p>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <ReportReviewModal
            key={selected.id}
            report={selected}
            onClose={() => setSelectedId(null)}
            onDecided={async (updated) => {
              if (updated) setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
              // The account's standing and its other reports may have changed too.
              await refresh();
            }}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

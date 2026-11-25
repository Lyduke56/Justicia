'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { getAdminAuditLogsData } from '@/app/actions/adminData';
import type { AdminAuditEntry } from '@/types/admin';
import { ChevronRightIcon, NeuAlert, NeuButton } from '@/components/shared/neu';
import { DRAW, EMBOSS, PAGE } from '@/components/lawyer/motion';
import { TONE_COLOR, stamp } from '@/components/admin/overview/activity';
import { ActivityIcon } from '@/components/admin/overview/OverviewIcons';
import { QueueToolbar } from '@/components/admin/verification/QueueToolbar';
import { CAPS, DownloadGlyph, PAGE_FRAME, ROW_HEIGHT, RefreshGlyph, TableBand, TableEmpty, TablePager, TableRows, ToolbarButton, pageOf, rowClass, useEntrance } from '@/components/admin/table/kit';
import { AUDIT_SORTS, AUDIT_TABS, describeAudit, humanize, visibleAudit, type AuditSort, type AuditTab } from '@/components/admin/audit/model';
import { AuditEventModal } from '@/components/admin/audit/AuditEventModal';

/**
 * Audit Log, in the same design as the Lawyer Directory: the Consultations-style toolbar
 * (category tabs, search, sort, refresh, CSV export), a carved divider, then a structured
 * table of events in plain words. A row opens the event in the shared modal.
 */

/*
 * Columns, shared by the header band and the rows:
 *   narrow:  Event · When
 *   44rem:   + Done by
 *   60rem:   + Target
 */
const COLS = [
  'grid-cols-[minmax(0,1fr)_auto_14px]',
  '@[44rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_112px_14px]',
  '@[60rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_112px_14px]',
].join(' ');
const ACTOR = 'hidden @[44rem]:block';
const TARGET = 'hidden @[60rem]:block';

export function AdminSecurityAuditView({ initialLogs = [] }: { initialLogs?: AdminAuditEntry[] }) {
  const reduceMotion = useReducedMotion();
  const { entranceKey, rowsAt } = useEntrance();
  const [now] = useState(() => Date.now());

  const [logs, setLogs] = useState(initialLogs);
  const [previousData, setPreviousData] = useState(initialLogs);
  if (previousData !== initialLogs) {
    setPreviousData(initialLogs);
    setLogs(initialLogs);
  }
  const [tab, setTab] = useState<AuditTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<AuditSort>('newest');
  const [pageStart, setPageStart] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const rows = useMemo(() => logs.map(describeAudit), [logs]);
  const counts = useMemo(
    () => Object.fromEntries(AUDIT_TABS.map((t) => [t.key, t.key === 'all' ? rows.length : rows.filter((r) => r.line.category === t.key).length])) as Record<AuditTab, number>,
    [rows]
  );
  const items = useMemo(() => visibleAudit(rows, tab, query, sort), [rows, tab, query, sort]);
  const { start, shown } = pageOf(items, pageStart);
  const selected = rows.find((r) => r.entry.id === selectedId) ?? null;
  const tabMeta = AUDIT_TABS.find((t) => t.key === tab)!;
  const emptyTitle = query.trim() ? `No events match “${query.trim()}”` : tabMeta.empty;
  const changeTab = (next: AuditTab) => {
    setTab(next);
    setPageStart(0);
  };

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      setLogs(await getAdminAuditLogsData());
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  // Exports the events in the current tab and search, oldest or newest first as sorted.
  const exportCsv = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const table = [
      ['Timestamp', 'Event', 'Category', 'Action', 'Actor', 'Email', 'Target type', 'Target ID'],
      ...items.map(({ entry, line }) => [entry.timestamp, line.title, line.category, entry.action, entry.actor.name, entry.actor.email, entry.targetType, entry.targetId]),
    ];
    const csv = table.map((row) => row.map((v) => quote(String(v ?? ''))).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'justicia-admin-audit.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div key={entranceKey} variants={PAGE} initial={reduceMotion ? false : 'hidden'} animate="show" className={`${PAGE_FRAME} admin-audit`}>
        <h1 className="sr-only">Audit log</h1>

        <motion.section variants={EMBOSS} aria-label="Filter events" className="rounded-[24px] bg-[#E5D8CB] p-4 sm:p-5">
          <QueueToolbar
            tabs={AUDIT_TABS}
            tab={tab}
            counts={counts}
            onTab={changeTab}
            query={query}
            onQuery={(q) => {
              setQuery(q);
              setPageStart(0);
            }}
            searchLabel="Search event, person or record"
            sorts={AUDIT_SORTS}
            sort={sort}
            onSort={(next) => {
              setSort(next);
              setPageStart(0);
            }}
            sortLabel="Sort events"
            tabsLabel="Event category"
            idPrefix="audit"
            extra={
              <>
                <ToolbarButton icon={<RefreshGlyph />} onClick={refresh} busy={refreshing} label="Refresh the audit log">
                  {refreshing ? 'Refreshing' : 'Refresh'}
                </ToolbarButton>
                <ToolbarButton icon={<DownloadGlyph />} onClick={exportCsv} disabled={!items.length} label="Export these events as CSV">
                  Export CSV
                </ToolbarButton>
              </>
            }
          />
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto my-3 w-[78%] shrink-0" aria-hidden />

        <AnimatePresence initial={false}>
          {refreshError && (
            <NeuAlert key="refresh-error" tone="error" onDismiss={() => setRefreshError(false)} action={<NeuButton size="sm" onClick={refresh}>Retry</NeuButton>}>
              The audit log could not be refreshed. The events below are from the previous load.
            </NeuAlert>
          )}
        </AnimatePresence>

        <motion.section variants={EMBOSS} aria-label={tabMeta.heading} className="@container rounded-[24px] bg-[#E5D8CB] p-3 sm:p-4">
          {items.length ? (
            <>
              <TableBand cols={COLS}>
                <span>Event</span>
                <span className={ACTOR}>Done by</span>
                <span className={TARGET}>Target</span>
                <span className="text-right">When</span>
                <span />
              </TableBand>
              <div className="mt-1.5">
                <TableRows
                  key={`${tab}|${sort}|${start}|${entranceKey}`}
                  label="Events"
                  items={shown}
                  itemKey={(r) => r.entry.id}
                  rowsAt={rowsAt}
                  render={({ entry, line }) => {
                    const at = stamp(entry.timestamp, now);
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedId(entry.id)}
                        aria-label={`${line.title}, ${at.date} ${at.time}. View details`}
                        className={rowClass(COLS)}
                        style={{ height: ROW_HEIGHT }}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="admin-overview-badge grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ color: TONE_COLOR[line.tone] }} aria-hidden>
                            <ActivityIcon name={line.icon} className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-lora text-[14px] font-semibold text-[#341512]">{line.title}</span>
                            <span className={`block truncate text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{line.category}</span>
                          </span>
                        </span>
                        <span className={`${ACTOR} min-w-0`}>
                          <span className="block truncate font-inter text-[12px] text-[#3E2A1E]">{entry.actor.name}</span>
                          <span className="block truncate font-inter text-[11px] text-[#7D6855]">{entry.actor.email || '—'}</span>
                        </span>
                        <span className={`${TARGET} min-w-0`}>
                          <span className="block truncate font-inter text-[12px] text-[#3E2A1E]">{entry.targetType ? humanize(entry.targetType) : '—'}</span>
                          <span className="block truncate font-inter text-[11px] tabular-nums text-[#7D6855]" title={entry.targetId}>
                            {entry.targetId ? `#${entry.targetId.split('-')[0]}` : '—'}
                          </span>
                        </span>
                        <span className="text-right font-inter tabular-nums">
                          <span className="block text-[12px] text-[#3E2A1E]">{at.date}</span>
                          <span className="block text-[11px] text-[#7D6855]">{at.time}</span>
                        </span>
                        <ChevronRightIcon className="admin-overview-go h-3.5 w-3.5 text-[#B07A34]" />
                      </button>
                    );
                  }}
                />
              </div>
              <TablePager start={start} shownCount={shown.length} total={items.length} noun="events" onPage={setPageStart} extra={logs.length >= 100 ? <> · latest 100 loaded</> : null} />
            </>
          ) : (
            <TableEmpty
              emptyKey={`empty-${tab}-${query}`}
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
                  <path d="M14 3v5h5M9 13h6M9 17h4" />
                </svg>
              }
              title={emptyTitle}
              hint={query.trim() ? 'Check the spelling, or search in All Events.' : tabMeta.hint}
              actions={
                <>
                  {query.trim() && (
                    <NeuButton size="sm" onClick={() => setQuery('')}>
                      Clear search
                    </NeuButton>
                  )}
                  {tab !== 'all' && (
                    <NeuButton size="sm" variant="primary" onClick={() => changeTab('all')}>
                      Show all events
                    </NeuButton>
                  )}
                </>
              }
            />
          )}
          <p className="sr-only" aria-live="polite">
            {items.length ? `${tabMeta.heading}: ${items.length} events, showing ${start + 1} to ${start + shown.length}` : emptyTitle}
          </p>
        </motion.section>
      </motion.div>

      <AnimatePresence>{selected && <AuditEventModal key={selected.entry.id} row={selected} onClose={() => setSelectedId(null)} />}</AnimatePresence>
    </MotionConfig>
  );
}

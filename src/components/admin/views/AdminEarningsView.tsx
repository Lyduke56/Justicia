'use client';

import { useMemo, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { getAdminEarningsData } from '@/app/actions/adminEarningsActions';
import { NeuAlert, NeuButton } from '@/components/shared/neu';
import { DRAW, EMBOSS, GROUP, PAGE, RISE } from '@/components/lawyer/motion';
import { BarChartIcon, BriefcaseClockIcon, CalendarClockIcon, ChecklistIcon, CountUp, KpiCard, formatCount, formatPeso } from '@/components/lawyer/KpiCard';
import { EarningsChart } from '@/components/lawyer/earnings/EarningsChart';
import { MetricToggle, MonthPicker } from '@/components/lawyer/earnings/EarningsControls';
import { MONTHS_FULL, MONTHS_SHORT, earningsNote, metricChange, monthValues, pesoExact, pesoWhole, sum, type ChartMetric } from '@/components/lawyer/earnings/model';
import { QueueToolbar } from '@/components/admin/verification/QueueToolbar';
import { InlineLoader, PanelLoader } from '@/components/shared/loading';
import { CAPS, ROW_HEIGHT, RefreshGlyph, TableBand, TableEmpty, TablePager, TableRows, ToolbarButton, pageOf, rowClass, useEntrance } from '@/components/admin/table/kit';
import {
  EARNINGS_SORTS,
  EARNINGS_TABS,
  STATUS_LABEL,
  buildAdminEarningsCsv,
  buildAdminEarningsHtml,
  chartData,
  matchesEarningsTab,
  visibleTransactions,
  type AdminEarningsData,
  type EarningsSort,
  type EarningsTab,
} from '@/lib/admin/earnings';

/**
 * Admin Earnings, built like the lawyer's Earnings & Payouts tab (same KPI wells, chart, month
 * picker and export strip) with the admin list design for the transactions:
 *  - KPI cards for the chosen month and the year: platform fees, paid consultations, refunds.
 *  - Overview: platform fees (or paid consultations) per month, with the chosen month's figure,
 *    its change from the month before, the year total and the best month.
 *  - Export: the year's report as a printable PDF or CSV.
 *  - Transactions: every consultation payment this year with its platform fee.
 * The platform fee is the convenience fee added to each consultation a lawyer confirms.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/*
 * Columns, shared by the header band and the rows:
 *   narrow:  Client & attorney · Fee
 *   44rem:   + Amount paid · Status
 *   60rem:   + Date paid · Attorney (own column) · Session
 */
const COLS = [
  'grid-cols-[minmax(0,1fr)_auto]',
  '@[44rem]:grid-cols-[minmax(0,1fr)_112px_96px_88px]',
  '@[60rem]:grid-cols-[92px_minmax(0,1fr)_minmax(0,1fr)_92px_112px_96px_88px]',
].join(' ');
const MID = 'hidden @[44rem]:block';
const WIDE = 'hidden @[60rem]:block';

const DownloadGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

function ChangeChip({ pct, previousMonth }: { pct: number | null; previousMonth: number }) {
  const reduce = useReducedMotion();
  const tone =
    pct === null ? 'bg-[#341512]/[0.06] text-[#7D6855]' : pct >= 0 ? 'bg-[#D39758]/30 text-[#7A4A16]' : 'bg-[#E60000]/[0.09] text-[#A3301F]';
  return (
    <motion.span
      key={`${pct}-${previousMonth}`}
      initial={reduce ? false : { scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 480, damping: 24 }}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-inter text-[11px] font-semibold ${tone}`}
    >
      {pct === null ? (
        'No earlier figure'
      ) : (
        <>
          <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 ${pct < 0 ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden>
            <path d="M6 2 11 9H1z" />
          </svg>
          {Math.abs(pct)}% vs {MONTHS_SHORT[previousMonth]}
        </>
      )}
    </motion.span>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Prints the report from a hidden frame so "Save as PDF" captures only the report. */
function printReport(data: AdminEarningsData) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(buildAdminEarningsHtml(data, new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })));
  doc.close();
  win.focus();
  win.print();
  setTimeout(() => frame.remove(), 60_000);
}

export function AdminEarningsView({ initialData, initialError = null }: { initialData: AdminEarningsData | null; initialError?: string | null }) {
  const reduceMotion = useReducedMotion();
  const { entranceKey, revealed, rowsAt } = useEntrance();

  const [data, setData] = useState<AdminEarningsData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [metric, setMetric] = useState<ChartMetric>('earnings');
  const [tab, setTab] = useState<EarningsTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<EarningsSort>('newest');
  const [pageStart, setPageStart] = useState(0);
  const chartRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLElement>(null);

  const chart = useMemo(() => (data ? chartData(data) : null), [data]);
  const month = picked ?? data?.currentMonth ?? 0;
  const monthName = MONTHS_FULL[month];
  const values = chart ? monthValues(chart, metric) : null;
  const bestMonth = chart && values ? values.slice(0, chart.currentMonth + 1).reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0) : 0;
  const formatMetric = (v: number) => (metric === 'earnings' ? pesoWhole(v) : formatCount(v));

  const transactions = useMemo(() => data?.transactions ?? [], [data]);
  const counts = useMemo(
    () => Object.fromEntries(EARNINGS_TABS.map((t) => [t.key, transactions.filter((x) => matchesEarningsTab(x, t.key)).length])) as Record<EarningsTab, number>,
    [transactions]
  );
  const items = useMemo(() => visibleTransactions(transactions, tab, query, sort), [transactions, tab, query, sort]);
  const { start, shown } = pageOf(items, pageStart);
  const tabMeta = EARNINGS_TABS.find((t) => t.key === tab)!;
  const emptyTitle = query.trim() ? `No transactions match “${query.trim()}”` : tabMeta.empty;

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await getAdminEarningsData();
      if (res.success) {
        setData(res.data);
        setError(null);
      } else setError(res.error);
    } catch {
      setError('The earnings could not be refreshed. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const scrollTo = (ref: RefObject<HTMLElement | null>) =>
    ref.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  const showTab = (next: EarningsTab) => {
    setTab(next);
    setPageStart(0);
    scrollTo(tableRef);
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={entranceKey}
        variants={PAGE}
        initial={reduceMotion ? false : 'hidden'}
        animate={revealed ? 'show' : 'hidden'}
        className="lawyer-dash admin-earnings mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      >
        <h1 className="sr-only">Platform earnings</h1>

        {/* ── KPI cards ─────────────────────────────────────────────────────── */}
        <motion.section variants={GROUP} aria-label="Platform earnings summary" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={`${monthName}'s Fees`}
            singleLine
            value={data ? <CountUp value={data.monthlyFees[month]} format={formatPeso} /> : error ? '—' : null}
            valueTitle={data ? pesoExact(data.monthlyFees[month]) : undefined}
            subtitle={chart ? earningsNote(chart, month).replace('No paid sessions yet.', 'No fees earned yet.') : error ? 'Unavailable right now.' : null}
            icon={<BarChartIcon className="h-10 w-10 shrink-0" />}
            onClick={() => scrollTo(chartRef)}
            actionLabel="View the chart"
          />
          <KpiCard
            label={`${monthName}'s Sessions`}
            singleLine
            value={data ? <CountUp value={data.monthlyTransactions[month]} format={formatCount} /> : error ? '—' : null}
            subtitle={data ? `${pesoWhole(data.monthlyGross[month])} paid by clients.` : error ? 'Unavailable right now.' : null}
            icon={<CalendarClockIcon className="h-10 w-10 shrink-0" />}
            onClick={() => showTab('paid')}
            actionLabel="Open paid transactions"
          />
          <KpiCard
            label={`${data?.year ?? ''} Platform Fees`.trim()}
            singleLine
            value={data ? <CountUp value={sum(data.monthlyFees)} format={formatPeso} /> : error ? '—' : null}
            valueTitle={data ? pesoExact(sum(data.monthlyFees)) : undefined}
            subtitle={
              data
                ? `${plural(sum(data.monthlyTransactions), 'session')} at ${pesoWhole(data.platformFeeSetting)} each.`
                : error
                  ? 'Unavailable right now.'
                  : null
            }
            icon={<ChecklistIcon className="h-10 w-10 shrink-0" />}
            onClick={() => scrollTo(chartRef)}
            actionLabel="View the chart"
          />
          <KpiCard
            label="Refunded"
            singleLine
            value={data ? <CountUp value={data.refundedCount} format={formatCount} /> : error ? '—' : null}
            subtitle={
              data
                ? data.refundedCount === 0
                  ? 'No paid sessions cancelled.'
                  : `${pesoWhole(data.refundedFees)} in fees not earned.`
                : error
                  ? 'Unavailable right now.'
                  : null
            }
            icon={<BriefcaseClockIcon className="h-10 w-10 shrink-0" />}
            onClick={() => showTab('refunded')}
            actionLabel="Open refunded transactions"
          />
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto w-[78%]" aria-hidden />

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        <motion.section variants={GROUP} ref={chartRef} aria-labelledby="admin-earnings-chart-heading" className="flex scroll-mt-6 flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <motion.div
              variants={EMBOSS}
              className="inline-flex h-11 max-w-full items-center gap-3 self-start rounded-[20px] pl-6 pr-2"
              style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
            >
              <h2 id="admin-earnings-chart-heading" className={`truncate text-[12px] text-[#341512]/85 sm:text-[12.5px] ${CAPS}`}>
                Platform Earnings Overview
              </h2>
              <span className="neu-inset-banner grid h-7 shrink-0 place-items-center rounded-full px-2.5 font-inter text-[11px] font-bold text-[#341512]">
                {data?.year ?? '·'}
              </span>
            </motion.div>

            <motion.div variants={RISE} className="flex items-center gap-3">
              <MetricToggle value={metric} onChange={setMetric} />
              {chart && <MonthPicker data={chart} metric={metric} value={month} onChange={setPicked} />}
            </motion.div>
          </div>

          <AnimatePresence initial={false}>
            {error && (
              <NeuAlert key="error" tone="error" onDismiss={() => setError(null)} action={<NeuButton size="sm" onClick={refresh}>Retry</NeuButton>}>
                {error}
              </NeuAlert>
            )}
          </AnimatePresence>

          <motion.div variants={EMBOSS} aria-busy={!data} className="lawyer-dash-surface rounded-[28px] bg-[#E5D8CB] p-5 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <motion.div variants={RISE} className="min-w-0">
                <p className="font-lora text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#C58B3C]">
                  {monthName} {data?.year} · {metric === 'earnings' ? 'Platform fees' : 'Paid consultations'}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-lora text-[34px] font-semibold leading-none text-[#341512] sm:text-[40px]">
                    {chart && values ? (
                      <CountUp key={metric} value={values[month]} format={formatMetric} delay={0.7} />
                    ) : (
                      <InlineLoader className="text-[20px]" label="Loading figure" />
                    )}
                  </span>
                  {chart && <ChangeChip pct={metricChange(chart, metric, month)} previousMonth={(month + 11) % 12} />}
                </div>
              </motion.div>

              <motion.dl variants={RISE} className="client-neu-well grid grid-cols-2 gap-x-6 rounded-[16px] px-4 py-3 sm:px-5">
                <div>
                  <dt className="font-inter text-[10px] uppercase tracking-wider text-[#7D6855]">{data?.year ?? ''} total</dt>
                  <dd className="mt-0.5 font-lora text-[16px] font-semibold text-[#341512]">
                    {values ? (metric === 'earnings' ? formatPeso(sum(values)) : plural(sum(values), 'consultation')) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-inter text-[10px] uppercase tracking-wider text-[#7D6855]">Best month</dt>
                  <dd className="mt-0.5 font-lora text-[16px] font-semibold text-[#341512]">
                    {values && values[bestMonth] > 0 ? (
                      <button type="button" onClick={() => setPicked(bestMonth)} className="underline decoration-[#C58B3C]/50 decoration-dotted underline-offset-4 hover:text-[#B07A34]">
                        {MONTHS_SHORT[bestMonth]} · {metric === 'earnings' ? formatPeso(values[bestMonth]) : values[bestMonth]}
                      </button>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </motion.dl>
            </div>

            <motion.div variants={RISE} className="mt-5">
              {chart ? (
                <EarningsChart data={chart} metric={metric} selected={month} onSelect={setPicked} />
              ) : (
                <PanelLoader srLabel="Loading chart" className="h-[272px]" />
              )}
            </motion.div>
            <motion.p variants={RISE} className="mt-3 font-inter text-[10.5px] text-[#7D6855]">
              {metric === 'earnings'
                ? 'Platform fees are the convenience fee on each consultation payment a lawyer confirmed, by the month it was confirmed. Refunds earn no fee.'
                : 'Paid consultations by the month their payment was confirmed.'}{' '}
              Pick a month to update the cards above.
            </motion.p>
          </motion.div>

          {/* Export */}
          <motion.div variants={EMBOSS} className="flex flex-col gap-4 rounded-[22px] bg-[#E5D8CB] p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="neu-recessed grid size-12 shrink-0 place-items-center rounded-full text-[#B07A34]">
                <DownloadGlyph className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-lora text-[15px] font-semibold text-[#341512]">Export Platform Earnings</span>
                <span className="block font-inter text-[11.5px] text-[#5C4535]">
                  Monthly summary and every consultation payment for {data?.year ?? 'this year'}.
                </span>
              </span>
            </div>
            <div className="flex gap-2.5">
              <motion.button
                type="button"
                disabled={!data}
                onClick={() => data && printReport(data)}
                title="Opens a printable report. Choose “Save as PDF”."
                whileHover={data ? { y: -1.5 } : undefined}
                whileTap={data ? { scale: 0.95 } : undefined}
                className="neu-btn-espresso flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#4A2E25] px-5 font-lora text-[12.5px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                <DownloadGlyph className="h-4 w-4" />
                PDF
              </motion.button>
              <motion.button
                type="button"
                disabled={!data}
                onClick={() => data && download(`justicia-platform-earnings-${data.year}.csv`, buildAdminEarningsCsv(data), 'text/csv;charset=utf-8')}
                title="Download this year’s platform earnings as CSV"
                whileHover={data ? { y: -1.5 } : undefined}
                whileTap={data ? { scale: 0.95 } : undefined}
                className="neu-btn-caramel flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#D49E56] px-5 font-lora text-[12.5px] font-bold text-[#341512] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                <DownloadGlyph className="h-4 w-4" />
                CSV
              </motion.button>
            </div>
          </motion.div>
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto w-[78%]" aria-hidden />

        {/* ── Transactions ──────────────────────────────────────────────────── */}
        <motion.section variants={GROUP} ref={tableRef} aria-label="Transactions" className="flex scroll-mt-6 flex-col gap-6">
          <motion.div variants={EMBOSS} className="rounded-[24px] bg-[#E5D8CB] p-4 sm:p-5">
            <QueueToolbar
              tabs={EARNINGS_TABS}
              tab={tab}
              counts={counts}
              onTab={(next) => {
                setTab(next);
                setPageStart(0);
              }}
              query={query}
              onQuery={(q) => {
                setQuery(q);
                setPageStart(0);
              }}
              searchLabel="Search client or attorney"
              sorts={EARNINGS_SORTS}
              sort={sort}
              onSort={(next) => {
                setSort(next);
                setPageStart(0);
              }}
              sortLabel="Sort transactions"
              tabsLabel="Transaction status"
              idPrefix="earnings"
              extra={
                <ToolbarButton icon={<RefreshGlyph />} onClick={refresh} busy={refreshing} label="Refresh earnings">
                  {refreshing ? 'Refreshing' : 'Refresh'}
                </ToolbarButton>
              }
            />
          </motion.div>

          <motion.div variants={EMBOSS} aria-label={tabMeta.heading} className="@container rounded-[24px] bg-[#E5D8CB] p-3 sm:p-4">
            {items.length ? (
              <>
                <TableBand cols={COLS}>
                  <span className={WIDE}>Date paid</span>
                  <span>Client</span>
                  <span className={WIDE}>Attorney</span>
                  <span className={WIDE}>Session</span>
                  <span className={MID}>Amount paid</span>
                  <span className="text-right @[44rem]:text-left">Platform fee</span>
                  <span className={MID}>Status</span>
                </TableBand>
                <div className="mt-1.5">
                  <TableRows
                    key={`${tab}|${sort}|${start}|${entranceKey}`}
                    label="Transactions"
                    items={shown}
                    itemKey={(t) => t.id}
                    rowsAt={rowsAt}
                    render={(t) => (
                      <div className={rowClass(COLS)} style={{ height: ROW_HEIGHT }}>
                        <span className={`${WIDE} font-inter text-[12px] tabular-nums text-[#3E2A1E]`}>{t.paidDate}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-lora text-[14px] font-semibold text-[#341512]">{t.clientName}</span>
                          <span className="block truncate font-inter text-[11px] text-[#7D6855] @[60rem]:hidden">
                            {t.lawyerName} · {t.paidDate}
                          </span>
                        </span>
                        <span className={`${WIDE} min-w-0 truncate font-inter text-[12px] text-[#3E2A1E]`}>{t.lawyerName}</span>
                        <span className={`${WIDE} font-inter text-[12px] tabular-nums text-[#3E2A1E]`}>{t.sessionDate}</span>
                        <span className={`${MID} font-inter text-[12px] tabular-nums text-[#3E2A1E]`} title={pesoExact(t.gross)}>
                          {pesoWhole(t.gross)}
                        </span>
                        <span
                          className={`text-right font-lora text-[14px] font-semibold tabular-nums @[44rem]:text-left ${t.status === 'refunded' ? 'text-[#9E8E7D] line-through' : 'text-[#341512]'}`}
                          title={pesoExact(t.platformFee)}
                        >
                          {pesoWhole(t.platformFee)}
                        </span>
                        <span className={MID}>
                          <span className={`admin-pill ${t.status === 'paid' ? 'admin-pill-success' : 'admin-pill-neutral'}`}>{STATUS_LABEL[t.status]}</span>
                        </span>
                      </div>
                    )}
                  />
                </div>
                <TablePager start={start} shownCount={shown.length} total={items.length} noun="transactions" onPage={setPageStart} />
              </>
            ) : (
              <TableEmpty
                emptyKey={`empty-${tab}-${query}`}
                icon={<BarChartIcon className="h-6 w-6" />}
                title={emptyTitle}
                hint={query.trim() ? 'Check the spelling, or search in All Transactions.' : tabMeta.hint}
                actions={
                  <>
                    {query.trim() && (
                      <NeuButton size="sm" onClick={() => setQuery('')}>
                        Clear search
                      </NeuButton>
                    )}
                    {tab !== 'all' && (
                      <NeuButton size="sm" variant="primary" onClick={() => setTab('all')}>
                        Show all transactions
                      </NeuButton>
                    )}
                  </>
                }
              />
            )}
            <p className="sr-only" aria-live="polite">
              {items.length ? `${tabMeta.heading}: ${items.length} transactions, showing ${start + 1} to ${start + shown.length}` : emptyTitle}
            </p>
          </motion.div>

          {data && data.owedToLawyers > 0 && (
            <motion.p variants={RISE} className="-mt-3 px-1 font-inter text-[11.5px] leading-relaxed text-[#7D6855]">
              Lawyers&apos; share still to be paid out this year: <strong className="font-semibold text-[#341512]">{pesoExact(data.owedToLawyers)}</strong>.
            </motion.p>
          )}
        </motion.section>
      </motion.div>
    </MotionConfig>
  );
}

export default AdminEarningsView;

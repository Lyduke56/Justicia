'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import type { LawyerEarningsData } from '@/app/actions/consultationActions';
import { fetchLive } from '@/lib/live/fetchLive';
import { useLiveRefresh, useViewActive } from '@/components/live/LiveProvider';
import { NeuAlert, NeuButton } from '@/components/shared/neu';
import { DRAW, EMBOSS, GROUP, PAGE, RISE } from '../motion';
import {
  BarChartIcon,
  BriefcaseClockIcon,
  CalendarClockIcon,
  ChecklistIcon,
  CountUp,
  KpiCard,
  formatCount,
  formatPeso,
} from '../KpiCard';
import { EarningsChart } from '../earnings/EarningsChart';
import { MetricToggle, MonthPicker } from '../earnings/EarningsControls';
import { InquiriesPanel } from '../earnings/InquiriesPanel';
import { buildSampleEarnings } from '../earnings/sampleEarnings';
import { InlineLoader, PanelLoader } from '@/components/shared/loading';
import { printEarningsReport, downloadEarningsCsv } from '../earnings/report';
import {
  MONTHS_FULL,
  MONTHS_SHORT,
  earningsNote,
  metricChange,
  monthValues,
  pesoExact,
  pesoWhole,
  sum,
  type ChartMetric,
} from '../earnings/model';

/**
 * Earnings & Payouts (same frame and parts as the Dashboard)
 *  - KPI cards for the chosen month: paid consultations, pending requests, completed sessions
 *    and net earnings. Picking another month (chart or month menu) counts them to the new figures.
 *  - Overview: the year's earnings (or paid sessions) per month as a line chart, with the chosen
 *    month's figure, its change from the month before, the year total and the best month.
 *  - Export: the year's report as a printable PDF or CSV.
 *  - Consultation inquiries: status tabs, client search, practice area, table.
 * Data: GET /api/live?resource=lawyer-earnings; the signed-out demo uses sample figures.
 *
 * Entrance (replays whenever the tab is opened): the KPI wells carve in and their plates emboss
 * while the figures count up, the divider draws, then the overview card embosses and its line
 * draws itself month by month, the export strip and the inquiries follow.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const DownloadGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

function ChangeChip({ pct, previousMonth }: { pct: number | null; previousMonth: number }) {
  const reduce = useReducedMotion();
  const tone =
    pct === null
      ? 'bg-[#341512]/[0.06] text-[#7D6855]'
      : pct >= 0
        ? 'bg-[#D39758]/30 text-[#7A4A16]'
        : 'bg-[#E60000]/[0.09] text-[#A3301F]';
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

export function LawyerEarningsView({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const viewActive = useViewActive();

  // The portal keeps tabs mounted (and preloads them hidden). Each time this tab becomes visible,
  // bump a key that remounts the animated layout so the entrance plays again; the data and the
  // chosen month live in this component and are kept. (State adjusted during render.)
  const [wasActive, setWasActive] = useState(viewActive);
  const [entranceKey, setEntranceKey] = useState(0);
  if (viewActive !== wasActive) {
    setWasActive(viewActive);
    if (viewActive) setEntranceKey((k) => k + 1);
  }

  const [data, setData] = useState<LawyerEarningsData | null>(() => (isDemo ? buildSampleEarnings() : null));
  const [error, setError] = useState<string | null>(null);
  /** Month picked by the lawyer; until then the current month. */
  const [picked, setPicked] = useState<number | null>(null);
  const [metric, setMetric] = useState<ChartMetric>('earnings');
  const chartRef = useRef<HTMLElement>(null);
  const hasData = useRef(isDemo);

  const load = useCallback(() => {
    if (isDemo) return;
    fetchLive('lawyer-earnings')
      .then((res) => {
        if (res?.success) {
          setData(res.data);
          hasData.current = true;
          setError(null);
        } else if (!hasData.current) {
          setError(res?.error ?? 'Your session has ended. Please sign in again.');
        }
      })
      .catch(() => {
        // A failed background refresh keeps the figures already on screen.
        if (!hasData.current) setError('We could not load your earnings right now. It will retry automatically.');
      });
  }, [isDemo]);

  useEffect(() => {
    load();
  }, [load]);

  // Confirmed payments, refunds and new requests update the figures live.
  useLiveRefresh(['payments', 'consultations', 'reviews'], load, { fallbackMs: 60000 });

  const month = picked ?? data?.currentMonth ?? 0;
  const monthName = MONTHS_FULL[month];
  const values = data ? monthValues(data, metric) : null;
  const bestMonth = data && values ? values.slice(0, data.currentMonth + 1).reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0) : 0;
  const isCurrentMonth = data ? month === data.currentMonth : true;

  const scrollToChart = () => chartRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

  const formatMetric = (v: number) => (metric === 'earnings' ? pesoWhole(v) : formatCount(v));

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={entranceKey}
        variants={PAGE}
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        className="lawyer-dash mx-auto flex max-w-[1196px] flex-col gap-8 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12"
      >
        {/* ── KPI cards (the chosen month) ──────────────────────────────────── */}
        <motion.section variants={GROUP} aria-label="Earnings summary" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={`${monthName}'s Sessions`}
            value={data ? <CountUp value={data.monthlyConsultations[month]} format={formatCount} /> : null}
            subtitle={
              data
                ? isCurrentMonth
                  ? data.todayScheduled === 0
                    ? 'Nothing scheduled for today.'
                    : `${plural(data.todayScheduled, 'session')} scheduled today.`
                  : `Paid sessions in ${monthName}.`
                : null
            }
            icon={<CalendarClockIcon className="h-10 w-10 shrink-0" />}
            onClick={() => router.push('/lawyer/consultations')}
            actionLabel="Open consultations"
          />
          <KpiCard
            label="Pending Requests"
            value={data ? <CountUp value={data.pendingRequests} format={formatCount} /> : null}
            subtitle={
              data
                ? data.pendingRequests === 0
                  ? 'You are all caught up.'
                  : `${plural(data.pendingClients, 'client')} awaiting approval.`
                : null
            }
            icon={<BriefcaseClockIcon className="h-10 w-10 shrink-0" />}
            onClick={() => router.push('/lawyer/consultations')}
            actionLabel="Review requests"
          />
          <KpiCard
            label="Completed Sessions"
            value={data ? <CountUp value={data.completedSessions} format={formatCount} /> : null}
            subtitle={
              data
                ? `${plural(data.reviewCount, 'review')}${data.responseRate != null ? ` · ${data.responseRate}% response rate` : ''}`
                : null
            }
            icon={<ChecklistIcon className="h-10 w-10 shrink-0" />}
            onClick={() => router.push('/lawyer/reviews')}
            actionLabel="Read reviews"
          />
          <KpiCard
            label={`${monthName}'s Earnings`}
            value={data ? <CountUp value={data.monthlyEarnings[month]} format={formatPeso} /> : null}
            valueTitle={data ? pesoExact(data.monthlyEarnings[month]) : undefined}
            subtitle={data ? earningsNote(data, month) : null}
            icon={<BarChartIcon className="h-10 w-10 shrink-0" />}
            onClick={scrollToChart}
            actionLabel="View the chart"
          />
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto w-[78%]" aria-hidden />

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        <motion.section variants={GROUP} ref={chartRef} aria-labelledby="earnings-chart-heading" className="flex scroll-mt-6 flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <motion.div
              variants={EMBOSS}
              className="inline-flex h-11 max-w-full items-center gap-3 self-start rounded-[20px] pl-6 pr-2"
              style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
            >
              <h2 id="earnings-chart-heading" className="truncate font-lora text-[15px] font-semibold tracking-[0.02em] text-[#341512]/85 sm:text-base">
                Earnings Overview
              </h2>
              <span className="neu-inset-banner grid h-7 shrink-0 place-items-center rounded-full px-2.5 font-inter text-[11px] font-bold text-[#341512]">
                {data?.year ?? '·'}
              </span>
            </motion.div>

            <motion.div variants={RISE} className="flex items-center gap-3">
              <MetricToggle value={metric} onChange={setMetric} />
              {data && <MonthPicker data={data} metric={metric} value={month} onChange={setPicked} />}
            </motion.div>
          </div>

          <AnimatePresence initial={false}>
            {error && (
              <NeuAlert key="error" tone="error" onDismiss={() => setError(null)} action={<NeuButton size="sm" onClick={load}>Retry</NeuButton>}>
                {error}
              </NeuAlert>
            )}
          </AnimatePresence>
          {isDemo && (
            <motion.p variants={RISE} className="-mt-2 font-inter text-[11px] text-[#7D6855]">
              Preview mode: these are sample figures.
            </motion.p>
          )}

          <motion.div variants={EMBOSS} aria-busy={!data} className="lawyer-dash-surface rounded-[28px] bg-[#E5D8CB] p-5 sm:p-6 lg:p-7">
            {/* Chosen month: figure, change, and the year at a glance */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <motion.div variants={RISE} className="min-w-0">
                <p className="font-lora text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#C58B3C]">
                  {monthName} {data?.year} · {metric === 'earnings' ? 'Net earnings' : 'Paid sessions'}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-lora text-[34px] font-semibold leading-none text-[#341512] sm:text-[40px]">
                    {data && values ? (
                      <CountUp key={metric} value={values[month]} format={formatMetric} delay={0.7} />
                    ) : (
                      <InlineLoader className="text-[20px]" label="Loading figure" />
                    )}
                  </span>
                  {data && <ChangeChip pct={metricChange(data, metric, month)} previousMonth={(month + 11) % 12} />}
                </div>
              </motion.div>

              <motion.dl variants={RISE} className="client-neu-well grid grid-cols-2 gap-x-6 rounded-[16px] px-4 py-3 sm:px-5">
                <div>
                  <dt className="font-inter text-[10px] uppercase tracking-wider text-[#7D6855]">{data?.year ?? ''} total</dt>
                  <dd className="mt-0.5 font-lora text-[16px] font-semibold text-[#341512]">
                    {data && values ? (metric === 'earnings' ? formatPeso(sum(values)) : plural(sum(values), 'session')) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-inter text-[10px] uppercase tracking-wider text-[#7D6855]">Best month</dt>
                  <dd className="mt-0.5 font-lora text-[16px] font-semibold text-[#341512]">
                    {data && values && values[bestMonth] > 0 ? (
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
              {data ? (
                <EarningsChart data={data} metric={metric} selected={month} onSelect={setPicked} />
              ) : (
                <PanelLoader srLabel="Loading chart" className="h-[272px]" />
              )}
            </motion.div>
            <motion.p variants={RISE} className="mt-3 font-inter text-[10.5px] text-[#7D6855]">
              {metric === 'earnings'
                ? 'Net earnings are payments you confirmed, less the platform fee, by the month they were confirmed.'
                : 'Paid consultations (confirmed or completed) by the month of the session.'}{' '}
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
                <span className="block font-lora text-[15px] font-semibold text-[#341512]">Export Earnings Report</span>
                <span className="block font-inter text-[11.5px] text-[#5C4535]">
                  Monthly summary and every confirmed payment for {data?.year ?? 'this year'}.
                </span>
              </span>
            </div>
            <div className="flex gap-2.5">
              <motion.button
                type="button"
                disabled={!data}
                onClick={() => data && printEarningsReport(data)}
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
                onClick={() => data && downloadEarningsCsv(data)}
                title="Download this year’s earnings as CSV"
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

        {/* ── Consultation inquiries ────────────────────────────────────────── */}
        <InquiriesPanel inquiries={data?.inquiries ?? null} loading={!data && !error} />
      </motion.div>
    </MotionConfig>
  );
}

export default LawyerEarningsView;

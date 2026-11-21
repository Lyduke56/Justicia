"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useReducedMotionPreference } from "@/components/lawyer/useReducedMotionPreference";
import type { LawyerEarningsData } from "@/app/actions/consultationActions";
import { fetchLive } from "@/lib/live/fetchLive";
import { useLiveRefresh } from "@/components/live/LiveProvider";
import styles from "./LawyerEarningsView.module.css";

const EASE = [0.16, 1, 0.3, 1] as const;
const earningsEntrance: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.16, delayChildren: 0.06 } },
};
const earningsItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const CHART_MARKERS = [
  [33, 130],
  [118, 61],
  [203, 100],
  [288, 195],
  [373, 117],
  [458, 114],
  [543, 134],
  [628, 194],
  [713, 135],
  [798, 127],
  [883, 168],
  [968, 122],
] as const;

const METRICS = [
  {
    title: "October’s Consultations",
    value: "10",
    detail: "There are 3 scheduled consultations today.",
    icon: "/figma-earnings-calendar.svg",
  },
  {
    title: "Pending Requests",
    value: "13",
    detail: "13 people are still waiting for your approval.",
    icon: "/figma-earnings-requests.svg",
  },
  {
    title: "Completed Sessions",
    value: "49",
    detail: "124 reviews, 99% response rate as of Oct. 2026.",
    icon: "/figma-earnings-completed.svg",
  },
  {
    title: "October’s Earnings",
    value: "84.9k",
    detail: "A raise of 18% vs the month of September.",
    icon: "/figma-earnings-earnings.svg",
  },
] as const;

type InquiryTab =
  "all" | "pendingApproval" | "pendingPayment" | "upcoming" | "cancelled";
type InquiryStatus =
  | "pendingApproval"
  | "pendingPayment"
  | "upcoming"
  | "completed"
  | "cancelled";

const INQUIRY_TABS: { key: InquiryTab; label: string; demoCount: number }[] = [
  { key: "all", label: "All Inquires", demoCount: 50 },
  { key: "pendingApproval", label: "Pending Approval", demoCount: 17 },
  { key: "pendingPayment", label: "Pending Payment", demoCount: 33 },
  { key: "upcoming", label: "Upcoming", demoCount: 39 },
  { key: "cancelled", label: "Cancelled", demoCount: 3 },
];

const DEMO_INQUIRIES: {
  name: string;
  date: string;
  area: string;
  status: InquiryStatus;
}[] = [
  {
    name: "Clyde Justine Rosal",
    date: "10/01/2026",
    area: "Labor & Employment",
    status: "pendingApproval",
  },
  {
    name: "Axziel Jay Bartolabac",
    date: "09/26/2026",
    area: "Criminal Law",
    status: "upcoming",
  },
  {
    name: "Benideck Longakit",
    date: "09/20/2026",
    area: "Civil Law",
    status: "pendingPayment",
  },
  {
    name: "Christopher John Rubio",
    date: "09/16/2026",
    area: "Criminal Law",
    status: "pendingPayment",
  },
];

const STATUS_LABELS: Record<InquiryStatus, string> = {
  pendingApproval: "PENDING CONFIRMATION",
  pendingPayment: "PENDING PAYMENT",
  upcoming: "CONFIRMED APPOINTMENT",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

const DEFAULT_AREAS = ["Labor & Employment", "Criminal Law", "Civil Law"];
const MONTH_ABBR = [
  "Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.",
  "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec.",
] as const;

/* Live chart geometry — matches the Figma canvas (0 at y=240, top tick at y=8). */
const CHART_BASE_Y = 240;
const CHART_TOP_Y = 8;
const chartX = (index: number) => 36.6 + index * 85;

/** 84900 → "84.9k", 250 → "250", 1250000 → "1.3M" */
function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  // Thresholds account for rounding, so 999.99 → "1k" (not "1000") and 999,960 → "1M".
  if (abs >= 999_950) return `${trim(value / 1_000_000)}M`;
  if (abs >= 999.5) return `${trim(value / 1_000)}k`;
  return String(Math.round(value));
}

/** Smallest "round" step (1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8 × 10^n) whose four grid lines cover the max. */
function niceStep(rawMax: number): number {
  if (rawMax <= 0) return 100;
  const raw = rawMax / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10].find((m) => m * power >= raw) ?? 10;
  return step * power;
}

const peso = (n: number) =>
  `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const PAYOUT_LABELS: Record<string, string> = {
  pending: "Pending payout",
  released: "Released",
  failed: "Payout failed",
  not_applicable: "—",
};

export function LawyerEarningsView({ isDemo }: { isDemo: boolean }) {
  const reduceMotion = useReducedMotionPreference();
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [activeInquiryTab, setActiveInquiryTab] = useState<InquiryTab>("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [draftArea, setDraftArea] = useState(isDemo ? "Labor & Employment" : "all");
  const [appliedArea, setAppliedArea] = useState("all");
  const [earnings, setEarnings] = useState<LawyerEarningsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const loadEarnings = useCallback(() => {
    if (isDemo) return;
    fetchLive("lawyer-earnings")
      .then((res) => {
        if (!mountedRef.current) return;
        if (res.success) {
          setEarnings(res.data);
          // Jump to the current month only on the first load, never on live refreshes.
          if (!hasLoadedRef.current) setSelectedMonth(res.data.currentMonth);
          hasLoadedRef.current = true;
          setLoadError(null);
        } else if (!hasLoadedRef.current) {
          setLoadError(res.error);
        }
      })
      .catch(() => {
        // A failed background refresh keeps the figures already on screen.
        if (mountedRef.current && !hasLoadedRef.current) {
          setLoadError("We could not load your earnings right now. Please try again.");
        }
      });
  }, [isDemo]);

  useEffect(() => {
    mountedRef.current = true;
    loadEarnings();
    return () => {
      mountedRef.current = false;
    };
  }, [loadEarnings]);

  // Confirmed payments, refunds and new requests update the figures live.
  useLiveRefresh(["payments", "consultations", "reviews"], loadEarnings, { fallbackMs: 60000 });

  const live = !isDemo && earnings !== null;

  const liveMetrics = useMemo(() => {
    if (!earnings) return null;
    const month = FULL_MONTHS[selectedMonth];
    const prevIndex = (selectedMonth + 11) % 12;
    const current = earnings.monthlyEarnings[selectedMonth];
    const previous =
      selectedMonth === 0
        ? earnings.previousDecemberEarnings
        : earnings.monthlyEarnings[prevIndex];
    let earningsDetail: string;
    if (previous > 0) {
      const change = Math.round(((current - previous) / previous) * 100);
      earningsDetail =
        change >= 0
          ? `A raise of ${change}% vs the month of ${FULL_MONTHS[prevIndex]}.`
          : `A drop of ${Math.abs(change)}% vs the month of ${FULL_MONTHS[prevIndex]}.`;
    } else {
      earningsDetail = `No earnings recorded in ${FULL_MONTHS[prevIndex]} to compare.`;
    }
    const today = earnings.todayScheduled;
    const asOf = `${MONTH_ABBR[earnings.currentMonth]} ${earnings.year}`;
    const reviews = `${earnings.reviewCount} review${earnings.reviewCount === 1 ? "" : "s"}`;
    return [
      {
        title: `${month}’s Consultations`,
        value: String(earnings.monthlyConsultations[selectedMonth]),
        detail: `There ${today === 1 ? "is" : "are"} ${today} scheduled consultation${today === 1 ? "" : "s"} today.`,
        exact: undefined as string | undefined,
      },
      {
        title: "Pending Requests",
        value: String(earnings.pendingRequests),
        detail: `${earnings.pendingClients} ${earnings.pendingClients === 1 ? "person is" : "people are"} still waiting for your approval.`,
        exact: undefined,
      },
      {
        title: "Completed Sessions",
        value: String(earnings.completedSessions),
        detail:
          earnings.responseRate === null
            ? `${reviews}, no requests yet as of ${asOf}.`
            : `${reviews}, ${earnings.responseRate}% response rate as of ${asOf}.`,
        exact: undefined,
      },
      {
        title: `${month}’s Earnings`,
        value: compactNumber(current),
        detail: earningsDetail,
        exact: peso(current),
      },
    ];
  }, [earnings, selectedMonth]);

  const liveChart = useMemo(() => {
    if (!earnings) return null;
    const step = niceStep(Math.max(...earnings.monthlyEarnings));
    const max = step * 4;
    const points = earnings.monthlyEarnings.map((value, index) => ({
      x: chartX(index),
      y: CHART_BASE_Y - (value / max) * (CHART_BASE_Y - CHART_TOP_Y),
      value,
    }));
    return { ticks: [4, 3, 2, 1, 0].map((n) => n * step), points };
  }, [earnings]);

  const inquirySource = useMemo(
    () => (isDemo ? DEMO_INQUIRIES : (earnings?.inquiries ?? [])),
    [isDemo, earnings],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<InquiryTab, number> = {
      all: inquirySource.length,
      pendingApproval: 0,
      pendingPayment: 0,
      upcoming: 0,
      cancelled: 0,
    };
    for (const inquiry of inquirySource) {
      if (inquiry.status !== "completed") counts[inquiry.status] += 1;
    }
    return counts;
  }, [inquirySource]);

  const areaOptions = useMemo(() => {
    const areas = new Set(DEFAULT_AREAS);
    if (!isDemo) earnings?.inquiries.forEach((inquiry) => areas.add(inquiry.area));
    return [...areas];
  }, [isDemo, earnings]);

  const exportFileBase = earnings ? `justicia-earnings-${earnings.year}` : "justicia-earnings";

  const downloadCsv = useCallback(() => {
    if (!earnings) return;
    const totalSessions = earnings.monthlyConsultations.reduce((sum, n) => sum + n, 0);
    const yearTotal = earnings.monthlyEarnings.reduce((sum, n) => sum + n, 0);
    const lines: string[] = [
      `Justicia Earnings Report,${earnings.year}`,
      "",
      "Monthly Summary",
      "Month,Paid Consultations,Net Earnings (PHP)",
      ...FULL_MONTHS.map((month, index) =>
        [month, earnings.monthlyConsultations[index], earnings.monthlyEarnings[index].toFixed(2)]
          .map(csvCell)
          .join(","),
      ),
      ["Total", totalSessions, yearTotal.toFixed(2)].map(csvCell).join(","),
      "",
      "Payments",
      "Date Paid,Client Name,Session Date,Consultation Area,Amount Paid (PHP),Platform Fee (PHP),Net Earnings (PHP),Payout Status",
      ...earnings.transactions.map((t) =>
        [
          t.paidDate,
          t.clientName,
          t.sessionDate,
          t.area,
          t.gross.toFixed(2),
          t.platformFee.toFixed(2),
          t.net.toFixed(2),
          PAYOUT_LABELS[t.payoutStatus] ?? t.payoutStatus,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFileBase}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [earnings, exportFileBase]);

  const downloadPdf = useCallback(() => {
    if (!earnings) return;
    const totalSessions = earnings.monthlyConsultations.reduce((sum, n) => sum + n, 0);
    const yearTotal = earnings.monthlyEarnings.reduce((sum, n) => sum + n, 0);
    const monthRows = FULL_MONTHS.map(
      (month, index) =>
        `<tr><td>${month}</td><td class="num">${earnings.monthlyConsultations[index]}</td><td class="num">${escapeHtml(peso(earnings.monthlyEarnings[index]))}</td></tr>`,
    ).join("");
    const paymentRows = earnings.transactions.length
      ? earnings.transactions
          .map(
            (t) =>
              `<tr><td>${escapeHtml(t.paidDate)}</td><td>${escapeHtml(t.clientName)}</td><td>${escapeHtml(t.sessionDate)}</td><td>${escapeHtml(t.area)}</td><td class="num">${escapeHtml(peso(t.gross))}</td><td class="num">${escapeHtml(peso(t.platformFee))}</td><td class="num">${escapeHtml(peso(t.net))}</td><td>${escapeHtml(PAYOUT_LABELS[t.payoutStatus] ?? t.payoutStatus)}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="8" class="empty">No confirmed payments yet this year.</td></tr>`;
    const generated = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${exportFileBase}</title>
<style>
  body{font-family:Georgia,serif;color:#341512;margin:32px;}
  h1{font-size:22px;margin:0 0 4px;} p{margin:0 0 20px;font-size:12px;color:#5b3b36;}
  h2{font-size:15px;margin:24px 0 8px;}
  table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;}
  th,td{border-bottom:1px solid #d9c8b8;padding:6px 8px;text-align:left;}
  th{background:#e5d8cb;} .num{text-align:right;} .empty{text-align:center;color:#8c7a6b;}
  tfoot td{font-weight:700;}
  @media print{body{margin:12mm;}}
</style></head><body>
<h1>Earnings Report — ${earnings.year}</h1>
<p>Generated ${escapeHtml(generated)}. Net earnings are payments you confirmed, less the platform fee.</p>
<h2>Monthly Summary</h2>
<table><thead><tr><th>Month</th><th class="num">Paid Consultations</th><th class="num">Net Earnings</th></tr></thead>
<tbody>${monthRows}</tbody>
<tfoot><tr><td>Total</td><td class="num">${totalSessions}</td><td class="num">${escapeHtml(peso(yearTotal))}</td></tr></tfoot></table>
<h2>Payments</h2>
<table><thead><tr><th>Date Paid</th><th>Client</th><th>Session</th><th>Area</th><th class="num">Amount Paid</th><th class="num">Platform Fee</th><th class="num">Net</th><th>Payout</th></tr></thead>
<tbody>${paymentRows}</tbody></table>
</body></html>`;
    // Print from a hidden iframe so the browser's "Save as PDF" captures only the report.
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    const frameWindow = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!doc || !frameWindow) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    frameWindow.focus();
    frameWindow.print();
    setTimeout(() => frame.remove(), 60_000);
  }, [earnings, exportFileBase]);

  const visibleInquiries = inquirySource.filter((inquiry) => {
    if (activeInquiryTab !== "all" && inquiry.status !== activeInquiryTab)
      return false;
    if (appliedArea !== "all" && inquiry.area !== appliedArea) return false;
    return inquiry.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <motion.div variants={earningsEntrance} initial={reduceMotion ? false : "hidden"} animate="show" className={styles.page}>
      <motion.section variants={earningsEntrance} className={styles.metrics} aria-label="Earnings summary">
        {METRICS.map((metric, metricIndex) => {
          const liveMetric = liveMetrics?.[metricIndex];
          return (
          <motion.article data-lawyer-motion variants={earningsItem} className={styles.metricCard} key={metric.icon}>
            <h2>
              {isDemo
                ? metric.title
                : (liveMetric?.title ?? metric.title.replace("October’s", "This Month’s"))}
            </h2>
            <div className={styles.metricPlate}>
              <div className={styles.metricValue}>
                <Image
                  src={metric.icon}
                  loading="eager"
                  width={42}
                  height={42}
                  alt=""
                  aria-hidden="true"
                />
                <span title={liveMetric?.exact}>
                  {isDemo ? metric.value : (liveMetric?.value ?? "—")}
                </span>
              </div>
              <p>
                {isDemo
                  ? metric.detail
                  : (liveMetric?.detail ??
                    (loadError ? "Financial data could not be loaded." : "Loading financial data…"))}
              </p>
            </div>
          </motion.article>
          );
        })}
      </motion.section>

      <div className={styles.divider} aria-hidden="true" />

      <motion.section
        data-lawyer-motion
        variants={earningsItem}
        className={styles.chartSection}
        aria-labelledby="earnings-chart-heading"
      >
        <div className={styles.sectionHeader}>
          <h1 className={styles.headingPill} id="earnings-chart-heading">
            Today’s Scheduled Consulations
          </h1>
          <div className={styles.filters}>
            <label className={styles.selectWrap}>
              <span className={styles.srOnly}>Chart period</span>
              <select value="month" disabled aria-label="Chart period">
                <option value="month">Filter by: MONTH</option>
              </select>
              <Image
                className={styles.filterArrow}
                src="/figma-earnings-dropdown.svg"
                loading="eager"
                width={26}
                height={26}
                alt=""
                aria-hidden="true"
              />
            </label>
            <label className={styles.selectWrap}>
              <span className={styles.srOnly}>Highlight month</span>
              <select
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(Number(event.target.value))
                }
                disabled={!isDemo && !live}
                aria-label="Highlight month"
              >
                {FULL_MONTHS.map((month, index) => (
                  <option value={index} key={month}>
                    {month}
                  </option>
                ))}
              </select>
              <Image
                className={styles.filterArrow}
                src="/figma-earnings-dropdown.svg"
                loading="eager"
                width={26}
                height={26}
                alt=""
                aria-hidden="true"
              />
            </label>
          </div>
        </div>

        <div className={styles.chartCard}>
          {isDemo ? (
            <div
              className={styles.chartScroll}
              role="img"
              aria-label={`Sample chart from the Figma design. ${FULL_MONTHS[selectedMonth]} selected.`}
            >
              <div className={styles.chartCanvas}>
                {[400, 300, 200, 100, 0].map((tick, index) => (
                  <div
                    className={styles.gridRow}
                    key={tick}
                    style={{ top: 8 + index * 58 }}
                  >
                    <span>{tick}</span>
                    <Image
                      src={
                        tick === 0
                          ? "/figma-earnings-chart-baseline.svg"
                          : "/figma-earnings-chart-grid.svg"
                      }
                      loading="eager"
                      width={tick === 0 ? 936 : 935}
                      height={1}
                      alt=""
                      aria-hidden="true"
                    />
                  </div>
                ))}
                {MONTHS.map((month, index) => (
                  <Image
                    className={styles.chartTick}
                    src="/figma-earnings-chart-tick.svg"
                    loading="eager"
                    width={1}
                    height={3}
                    alt=""
                    aria-hidden="true"
                    key={`${month}-tick`}
                    style={{ left: 36 + index * 85 }}
                  />
                ))}
                <Image
                  className={styles.chartLine}
                  src="/figma-earnings-chart-line.svg"
                  loading="eager"
                  width={936}
                  height={136}
                  alt=""
                  aria-hidden="true"
                />
                {CHART_MARKERS.map(([x, y], index) => (
                  <Image
                    className={styles.marker}
                    src="/figma-earnings-chart-marker.svg"
                    loading="eager"
                    width={9}
                    height={6}
                    alt=""
                    aria-hidden="true"
                    key={MONTHS[index]}
                    style={{ left: x, top: y }}
                  />
                ))}
                {MONTHS.map((month, index) => (
                  <span
                    className={styles.monthLabel}
                    style={{ left: 37 + index * 85 }}
                    key={month}
                  >
                    {month}
                  </span>
                ))}
              </div>
            </div>
          ) : earnings && liveChart ? (
            <div
              className={styles.chartScroll}
              role="img"
              aria-label={`Net earnings per month in ${earnings.year}. ${FULL_MONTHS[selectedMonth]}: ${peso(earnings.monthlyEarnings[selectedMonth])}.`}
            >
              <div className={styles.chartCanvas}>
                {liveChart.ticks.map((tick, index) => (
                  <div
                    className={styles.gridRow}
                    key={`${tick}-${index}`}
                    style={{ top: 8 + index * 58 }}
                  >
                    <span>{compactNumber(tick)}</span>
                    <Image
                      src={
                        tick === 0
                          ? "/figma-earnings-chart-baseline.svg"
                          : "/figma-earnings-chart-grid.svg"
                      }
                      loading="eager"
                      width={tick === 0 ? 936 : 935}
                      height={1}
                      alt=""
                      aria-hidden="true"
                    />
                  </div>
                ))}
                {MONTHS.map((month, index) => (
                  <Image
                    className={styles.chartTick}
                    src="/figma-earnings-chart-tick.svg"
                    loading="eager"
                    width={1}
                    height={3}
                    alt=""
                    aria-hidden="true"
                    key={`${month}-tick`}
                    style={{ left: 36 + index * 85 }}
                  />
                ))}
                <svg
                  width={984}
                  height={250}
                  viewBox="0 0 984 250"
                  fill="none"
                  aria-hidden="true"
                  style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
                >
                  <polyline
                    points={liveChart.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    stroke="#341512"
                    strokeWidth={2}
                    strokeLinejoin="bevel"
                  />
                </svg>
                {liveChart.points.map((point, index) => (
                  <Image
                    className={styles.marker}
                    src="/figma-earnings-chart-marker.svg"
                    loading="eager"
                    width={9}
                    height={6}
                    alt=""
                    aria-hidden="true"
                    title={`${FULL_MONTHS[index]}: ${peso(point.value)}`}
                    key={MONTHS[index]}
                    style={{ left: point.x - 3.5, top: point.y - 2.8 }}
                  />
                ))}
                {MONTHS.map((month, index) => (
                  <span
                    className={styles.monthLabel}
                    style={{ left: 37 + index * 85 }}
                    key={month}
                  >
                    {month}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.emptyChart}>
              {loadError ?? "Loading earnings…"}
            </div>
          )}
        </div>
      </motion.section>

      <section
        className={styles.exportCard}
        aria-labelledby="earnings-export-heading"
      >
        <Image
          src="/figma-earnings-download.svg"
          loading="eager"
          width={40}
          height={40}
          alt=""
          aria-hidden="true"
        />
        <div className={styles.exportCopy}>
          <h2 id="earnings-export-heading">Export Earnings Report</h2>
          <p>Download monthly or annual financial summaries.</p>
        </div>
        <div className={styles.exportActions}>
          <button
            type="button"
            className={styles.pdfButton}
            disabled={!live}
            onClick={downloadPdf}
            title={live ? "Opens a printable report. Choose “Save as PDF”." : "Available once your earnings have loaded"}
          >
            Download as PDF
          </button>
          <button
            type="button"
            className={styles.csvButton}
            disabled={!live}
            onClick={downloadCsv}
            title={live ? "Download this year’s earnings as CSV" : "Available once your earnings have loaded"}
          >
            Download as CSV
          </button>
        </div>
      </section>

      <div className={styles.divider} aria-hidden="true" />

      <motion.section
        data-lawyer-motion
        variants={earningsItem}
        className={styles.inquiriesSection}
        aria-label="Consultation inquiries"
      >
        <div className={styles.inquiryPanel}>
          <div
            className={styles.inquiryTabs}
            aria-label="Filter consultation inquiries"
          >
            {INQUIRY_TABS.map((tab) => (
              <button
                type="button"
                key={tab.key}
                aria-pressed={activeInquiryTab === tab.key}
                onClick={() => setActiveInquiryTab(tab.key)}
              >
                {tab.label} ({isDemo ? tab.demoCount : tabCounts[tab.key]})
              </button>
            ))}
          </div>
          <form
            className={styles.inquirySearchRow}
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(draftSearch.trim());
              setAppliedArea(draftArea);
            }}
          >
            <label className={styles.srOnly} htmlFor="earnings-inquiry-search">
              Search Client Name
            </label>
            <input
              id="earnings-inquiry-search"
              className={styles.inquirySearchInput}
              type="search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Search Client Name"
            />
            <button className={styles.inquirySearchButton} type="submit">
              <Image
                src="/figma-earnings-search.svg"
                loading="eager"
                width={14}
                height={14}
                alt=""
                aria-hidden="true"
              />
              Search
            </button>
            <label className={styles.areaSelectWrap}>
              <span className={styles.srOnly}>Consultation area</span>
              <select
                value={draftArea}
                onChange={(event) => setDraftArea(event.target.value)}
                aria-label="Consultation area"
              >
                <option value="Labor & Employment">
                  Labor &amp; Employment
                </option>
                <option value="all">All Practice Areas</option>
                {areaOptions
                  .filter((area) => area !== "Labor & Employment")
                  .map((area) => (
                    <option value={area} key={area}>
                      {area}
                    </option>
                  ))}
              </select>
              <Image
                className={styles.areaArrow}
                src="/figma-earnings-dropdown.svg"
                loading="eager"
                width={26}
                height={26}
                alt=""
                aria-hidden="true"
              />
            </label>
          </form>
        </div>
        <div className={styles.inquiryTableCard}>
          <div
            className={styles.inquiryTableScroll}
            role="table"
            aria-label="Consultation inquiries"
          >
            <div
              className={`${styles.inquiryTableRow} ${styles.inquiryTableHead}`}
              role="row"
            >
              <span role="columnheader">CLIENT NAME</span>
              <span role="columnheader">DATE AND TIME</span>
              <span role="columnheader">CONSULTATION AREA</span>
              <span role="columnheader">STATUS</span>
            </div>
            <AnimatePresence initial={false}>
            {visibleInquiries.map((inquiry) => (
              <motion.div
                data-lawyer-motion
                className={`${styles.inquiryTableRow} ${styles.inquiryTableBody}`}
                role="row"
                key={(inquiry as { id?: string }).id ?? `${inquiry.name}-${inquiry.date}`}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.25, ease: EASE }}
              >
                <span role="cell">{inquiry.name}</span>
                <span role="cell">{inquiry.date}</span>
                <span role="cell">{inquiry.area}</span>
                <span role="cell">
                  <span
                    className={`${styles.statusPill} ${styles[inquiry.status]}`}
                  >
                    {STATUS_LABELS[inquiry.status]}
                  </span>
                </span>
              </motion.div>
            ))}
            </AnimatePresence>
            {visibleInquiries.length === 0 && (
              <p className={styles.inquiryEmpty}>
                {!isDemo && !earnings
                  ? (loadError ?? "Loading consultations…")
                  : "No matching consultations."}
              </p>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

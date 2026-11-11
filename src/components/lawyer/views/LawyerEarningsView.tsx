"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./LawyerEarningsView.module.css";

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

export function LawyerEarningsView({ isDemo }: { isDemo: boolean }) {
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [payoutFilter, setPayoutFilter] = useState<
    "all" | "pending" | "completed"
  >("all");

  return (
    <div className={styles.page}>
      <section className={styles.metrics} aria-label="Earnings summary">
        {METRICS.map((metric) => (
          <article className={styles.metricCard} key={metric.title}>
            <h2>
              {isDemo
                ? metric.title
                : metric.title.replace("October’s", "This Month’s")}
            </h2>
            <div className={styles.metricPlate}>
              <div className={styles.metricValue}>
                <Image
                  src={metric.icon}
                  width={42}
                  height={42}
                  alt=""
                  aria-hidden="true"
                />
                <span>{isDemo ? metric.value : "—"}</span>
              </div>
              <p>
                {isDemo ? metric.detail : "Financial data is being connected."}
              </p>
            </div>
          </article>
        ))}
      </section>

      <div className={styles.divider} aria-hidden="true" />

      <section
        className={styles.chartSection}
        aria-labelledby="earnings-chart-heading"
      >
        <div className={styles.sectionHeader}>
          <h1 className={styles.headingPill} id="earnings-chart-heading">
            Earnings Overview
          </h1>
          <div className={styles.filters}>
            <label className={styles.selectWrap}>
              <span className={styles.srOnly}>Chart period</span>
              <select value="month" disabled aria-label="Chart period">
                <option value="month">Filter by: MONTH</option>
              </select>
              <span className={styles.chevron} aria-hidden="true" />
            </label>
            <label className={styles.selectWrap}>
              <span className={styles.srOnly}>Highlight month</span>
              <select
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(Number(event.target.value))
                }
                disabled={!isDemo}
                aria-label="Highlight month"
              >
                {FULL_MONTHS.map((month, index) => (
                  <option value={index} key={month}>
                    {month}
                  </option>
                ))}
              </select>
              <span className={styles.chevron} aria-hidden="true" />
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
                    <i />
                  </div>
                ))}
                <Image
                  className={styles.chartLine}
                  src="/figma-earnings-chart-line.svg"
                  width={936}
                  height={136}
                  alt=""
                  aria-hidden="true"
                />
                {CHART_MARKERS.map(([x, y], index) => (
                  <Image
                    className={`${styles.marker} ${selectedMonth === index ? styles.selectedMarker : ""}`}
                    src="/figma-earnings-chart-marker.svg"
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
          ) : (
            <div className={styles.emptyChart}>
              Earnings data will appear here when payouts are connected.
            </div>
          )}
        </div>
      </section>

      <section
        className={styles.exportCard}
        aria-labelledby="earnings-export-heading"
      >
        <Image
          src="/figma-earnings-download.svg"
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
            disabled
            title="PDF export will be available when payout data is connected"
          >
            Download as PDF
          </button>
          <button
            type="button"
            className={styles.csvButton}
            disabled
            title="CSV export will be available when payout data is connected"
          >
            Download as CSV
          </button>
        </div>
      </section>

      <div className={styles.divider} aria-hidden="true" />

      <section
        className={styles.payoutSection}
        aria-labelledby="payout-history-heading"
      >
        <div className={styles.payoutFilters}>
          <h2 id="payout-history-heading">Payout History</h2>
          <div className={styles.payoutTabs} aria-label="Filter payout history">
            {(["all", "pending", "completed"] as const).map((filter) => (
              <button
                type="button"
                key={filter}
                aria-pressed={payoutFilter === filter}
                onClick={() => setPayoutFilter(filter)}
              >
                {filter === "all"
                  ? "All Payouts"
                  : filter === "pending"
                    ? "Pending"
                    : "Completed"}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.payoutTable}>
          <div className={styles.tableHead} aria-hidden="true">
            <span>PERIOD</span>
            <span>GROSS EARNINGS</span>
            <span>FEES</span>
            <span>NET PAYOUT</span>
            <span>STATUS</span>
          </div>
          <p>
            No {payoutFilter === "all" ? "" : `${payoutFilter} `}payout records
            are available yet.
          </p>
        </div>
      </section>
    </div>
  );
}

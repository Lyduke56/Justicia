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

type InquiryTab =
  "all" | "pendingApproval" | "pendingPayment" | "upcoming" | "cancelled";
type InquiryStatus =
  "pendingApproval" | "pendingPayment" | "upcoming" | "cancelled";

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
  cancelled: "CANCELLED",
};

export function LawyerEarningsView({ isDemo }: { isDemo: boolean }) {
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [activeInquiryTab, setActiveInquiryTab] = useState<InquiryTab>("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [draftArea, setDraftArea] = useState("Labor & Employment");
  const [appliedArea, setAppliedArea] = useState("all");

  const visibleInquiries = (isDemo ? DEMO_INQUIRIES : []).filter((inquiry) => {
    if (activeInquiryTab !== "all" && inquiry.status !== activeInquiryTab)
      return false;
    if (appliedArea !== "all" && inquiry.area !== appliedArea) return false;
    return inquiry.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
                  loading="eager"
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
                disabled={!isDemo}
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
                {tab.label} ({isDemo ? tab.demoCount : 0})
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
                <option value="Criminal Law">Criminal Law</option>
                <option value="Civil Law">Civil Law</option>
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
            {visibleInquiries.map((inquiry) => (
              <div
                className={`${styles.inquiryTableRow} ${styles.inquiryTableBody}`}
                role="row"
                key={`${inquiry.name}-${inquiry.date}`}
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
              </div>
            ))}
            {visibleInquiries.length === 0 && (
              <p className={styles.inquiryEmpty}>No matching consultations.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

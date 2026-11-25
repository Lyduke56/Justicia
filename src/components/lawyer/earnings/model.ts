import type { EarningsInquiry, EarningsInquiryStatus, LawyerEarningsData } from '@/app/actions/consultationActions';

/** Pure helpers for the Earnings & Payouts tab (no React, unit-tested). */

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type ChartMetric = 'earnings' | 'sessions';

/** "PHP 84,900.00" (exports and exact figures). */
export const pesoExact = (n: number) =>
  `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "₱84,900" (headline figures). */
export const pesoWhole = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;

/** 84900 → "84.9k", 250 → "250", 1250000 → "1.3M" (axis ticks). */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  // Thresholds account for rounding, so 999.99 → "1k" (not "1000") and 999,960 → "1M".
  if (abs >= 999_950) return `${trim(value / 1_000_000)}M`;
  if (abs >= 999.5) return `${trim(value / 1_000)}k`;
  return String(Math.round(value));
}

/** Smallest "round" step (1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8 × 10^n) whose four grid lines cover the max. */
export function niceStep(rawMax: number, minStep = 100): number {
  if (rawMax <= 0) return minStep;
  const raw = rawMax / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10].find((m) => m * power >= raw) ?? 10;
  return Math.max(minStep, step * power);
}

/** Axis for the chart: five ticks from 0 up, and the value at the top line. */
export function chartScale(values: readonly number[], metric: ChartMetric) {
  const step = niceStep(Math.max(0, ...values), metric === 'sessions' ? 1 : 100);
  return { step, max: step * 4, ticks: [0, 1, 2, 3, 4].map((n) => n * step) };
}

export function monthValues(data: LawyerEarningsData, metric: ChartMetric): number[] {
  return metric === 'earnings' ? data.monthlyEarnings : data.monthlyConsultations;
}

/** Change from the month before (January compares with last December). null: nothing to compare. */
export function monthChange(data: LawyerEarningsData, month: number): { pct: number | null; previous: number; previousMonth: number } {
  const previousMonth = (month + 11) % 12;
  const previous = month === 0 ? data.previousDecemberEarnings : data.monthlyEarnings[previousMonth];
  const current = data.monthlyEarnings[month];
  const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { pct, previous, previousMonth };
}

/** Change of the chart metric from the month before. January sessions have nothing to compare. */
export function metricChange(data: LawyerEarningsData, metric: ChartMetric, month: number): number | null {
  if (metric === 'earnings') return monthChange(data, month).pct;
  if (month === 0) return null;
  const previous = data.monthlyConsultations[month - 1];
  return previous > 0 ? Math.round(((data.monthlyConsultations[month] - previous) / previous) * 100) : null;
}

export function earningsNote(data: LawyerEarningsData, month: number): string {
  const { pct, previousMonth } = monthChange(data, month);
  const prev = MONTHS_FULL[previousMonth];
  if (month > data.currentMonth) return `${MONTHS_FULL[month]} hasn't started yet.`;
  if (pct === null) return data.monthlyEarnings[month] > 0 ? `Up from ₱0 in ${prev}.` : 'No paid sessions yet.';
  if (pct > 0) return `Up ${pct}% from ${prev}.`;
  if (pct < 0) return `Down ${-pct}% from ${prev}.`;
  return `Same as ${prev}.`;
}

export const sum = (values: readonly number[]) => values.reduce((total, n) => total + n, 0);

/**
 * Smooth line through the points (monotone cubic, so it never overshoots between months, and
 * a flat month stays flat). Always the same commands for the same number of points, so the
 * path can animate from one data set to another.
 */
export function smoothPath(points: ReadonlyArray<{ x: number; y: number }>): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${points[0].x},${points[0].y}`;
  const dx = points.slice(1).map((p, i) => p.x - points[i].x);
  const slope = points.slice(1).map((p, i) => (p.y - points[i].y) / dx[i]);
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    const a = slope[i - 1];
    const b = slope[i];
    return a * b <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b);
  });
  const r = (v: number) => Math.round(v * 100) / 100;
  let d = `M${r(points[0].x)},${r(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${r(points[i].x + h)},${r(points[i].y + tangent[i] * h)} ${r(points[i + 1].x - h)},${r(points[i + 1].y - tangent[i + 1] * h)} ${r(points[i + 1].x)},${r(points[i + 1].y)}`;
  }
  return d;
}

// ─── Consultation inquiries ───────────────────────────────────────────────────
export type InquiryTab = 'all' | EarningsInquiryStatus;

export const INQUIRY_TABS: Array<{ key: InquiryTab; label: string; heading: string; empty: string }> = [
  { key: 'all', label: 'All Inquiries', heading: 'All Inquiries', empty: 'No consultation inquiries yet' },
  { key: 'pendingApproval', label: 'Pending Approval', heading: 'Pending Approval', empty: 'No requests waiting for you' },
  { key: 'pendingPayment', label: 'Pending Payment', heading: 'Pending Payment', empty: 'No payments outstanding' },
  { key: 'upcoming', label: 'Upcoming', heading: 'Upcoming Sessions', empty: 'No upcoming sessions' },
  { key: 'completed', label: 'Completed', heading: 'Completed Sessions', empty: 'No completed sessions yet' },
  { key: 'cancelled', label: 'Cancelled', heading: 'Cancelled & Declined', empty: 'Nothing cancelled or declined' },
];

export const ALL_AREAS = 'all';

export function inquiryCounts(all: readonly EarningsInquiry[]): Record<InquiryTab, number> {
  const counts: Record<InquiryTab, number> = { all: all.length, pendingApproval: 0, pendingPayment: 0, upcoming: 0, completed: 0, cancelled: 0 };
  for (const inquiry of all) counts[inquiry.status] += 1;
  return counts;
}

/** Inquiries for a tab, practice area and client-name search (newest session first, as served). */
export function visibleInquiries(all: readonly EarningsInquiry[], tab: InquiryTab, query: string, area: string): EarningsInquiry[] {
  const q = query.trim().toLowerCase();
  return all.filter(
    (i) =>
      (tab === 'all' || i.status === tab) &&
      (area === ALL_AREAS || i.area === area) &&
      (!q || i.name.toLowerCase().includes(q))
  );
}

/** Practice areas present in the inquiries, most common first. */
export function areasOf(all: readonly EarningsInquiry[]): string[] {
  const counts = new Map<string, number>();
  for (const i of all) counts.set(i.area, (counts.get(i.area) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([area]) => area);
}
